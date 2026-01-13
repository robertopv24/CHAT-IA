<?php
// src/Controllers/AdminController.php

namespace Foxia\Controllers;

use Foxia\Config\Database;
use Foxia\Services\CsrfService;
use PDO;

class AdminController
{
    private $db;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    /**
     * Verificación mejorada de permisos de administrador
     */
    private function verifyAdminInDatabase(int $userId): bool
    {
        try {
            $query = "SELECT is_admin, email FROM users WHERE id = :user_id AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                error_log("❌ ADMIN VERIFICATION FAILED - User not found: $userId");
                return false;
            }

            $isAdmin = (int)$user['is_admin'] === 1;

            if ($isAdmin) {
                error_log("✅ ADMIN VERIFIED - User: {$user['email']} (ID: $userId)");
            } else {
                error_log("❌ ADMIN DENIED - User: {$user['email']} (ID: $userId)");
            }

            return $isAdmin;

        } catch (\PDOException $e) {
            error_log("❌ Database error in admin verification: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtener todas las configuraciones del sistema - CORREGIDO
     */
    public function getSettings()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode([
                'error' => 'Se requieren permisos de administrador',
                'debug' => [
                    'user_id' => $userId,
                    'user_email' => $currentUser->email ?? 'N/A',
                    'timestamp' => date('Y-m-d H:i:s')
                ]
            ]);
            return;
        }

        try {
            // CONSULTA CORREGIDA: usar setting_type en lugar de data_type
            $stmt = $this->db->query("
                SELECT id, setting_key, setting_value, description, setting_type, is_public, updated_at
                FROM system_settings
                ORDER BY setting_key ASC
            ");
            $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'settings' => $settings,
                'count' => count($settings),
                'metadata' => [
                    'last_updated' => date('Y-m-d H:i:s'),
                    'admin_user' => $currentUser->email
                ]
            ]);

        } catch (\PDOException $e) {
            error_log("❌ Error en AdminController::getSettings: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Error en la base de datos: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Actualizar configuración del sistema
     */
    public function updateSetting()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Se requieren permisos de administrador']);
            return;
        }

        // Validar token CSRF
        $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!CsrfService::validateToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['error' => 'Token CSRF inválido o ausente']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['key']) || !isset($input['value'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requieren key y value']);
            return;
        }

        $key = trim($input['key']);
        $value = trim($input['value']);

        try {
            // Actualizar también updated_by si existe en la tabla
            $query = "UPDATE system_settings SET setting_value = :value, updated_at = NOW()";

            // Si la tabla tiene updated_by, inclúyelo
            $query .= " WHERE setting_key = :key";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':value', $value);
            $stmt->bindParam(':key', $key);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                error_log("⚙️ Setting updated - Key: $key, Value: $value, By: {$currentUser->email}");

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Configuración actualizada correctamente',
                    'updated_setting' => [
                        'key' => $key,
                        'value' => $value
                    ]
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Configuración no encontrada']);
            }

        } catch (\PDOException $e) {
            error_log("❌ Error updating setting: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar la configuración: ' . $e->getMessage()]);
        }
    }

    /**
     * Obtener estadísticas del sistema mejoradas
     */
    public function getSystemStats()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Se requieren permisos de administrador']);
            return;
        }

        try {
            // Estadísticas completas del sistema
            $stats = [];

            // Usuarios
            $usersStmt = $this->db->query("
                SELECT
                    COUNT(*) as total_users,
                    SUM(is_active = 1) as active_users,
                    SUM(is_admin = 1) as admin_users,
                    SUM(email_verified = 1) as verified_users,
                    COUNT(*) - SUM(is_active = 1) as inactive_users
                FROM users
            ");
            $stats['users'] = $usersStmt->fetch(PDO::FETCH_ASSOC);

            // Chats
            $chatsStmt = $this->db->query("
                SELECT
                    COUNT(*) as total_chats,
                    COUNT(DISTINCT created_by) as users_with_chats,
                    AVG((SELECT COUNT(*) FROM messages WHERE chat_id = chats.id)) as avg_messages_per_chat
                FROM chats
            ");
            $stats['chats'] = $chatsStmt->fetch(PDO::FETCH_ASSOC);

            // Mensajes
            $messagesStmt = $this->db->query("
                SELECT
                    COUNT(*) as total_messages,
                    SUM(deleted = 1) as deleted_messages,
                    COUNT(DISTINCT user_id) as users_with_messages,
                    MAX(created_at) as last_message_date
                FROM messages
            ");
            $stats['messages'] = $messagesStmt->fetch(PDO::FETCH_ASSOC);

            // Actividad reciente (últimas 24 horas)
            $recentStmt = $this->db->query("
                SELECT
                    (SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL 24 HOUR) as active_users_24h,
                    (SELECT COUNT(*) FROM messages WHERE created_at >= NOW() - INTERVAL 24 HOUR) as messages_24h,
                    (SELECT COUNT(*) FROM chats WHERE created_at >= NOW() - INTERVAL 24 HOUR) as new_chats_24h
            ");
            $stats['recent_activity'] = $recentStmt->fetch(PDO::FETCH_ASSOC);

            // Sistema
            $stats['system'] = [
                'server_time' => date('Y-m-d H:i:s'),
                'php_version' => PHP_VERSION,
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'N/A',
                'memory_usage' => memory_get_usage(true),
                'memory_peak' => memory_get_peak_usage(true)
            ];

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'stats' => $stats,
                'timestamp' => date('Y-m-d H:i:s'),
                'collected_by' => $currentUser->email
            ]);

        } catch (\PDOException $e) {
            error_log("❌ Error obteniendo estadísticas: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Error en la base de datos: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Obtener lista de usuarios (solo para admins)
     */
    public function getUsers()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Se requieren permisos de administrador']);
            return;
        }

        try {
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = min(50, max(10, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            // Filtros
            $search = $_GET['search'] ?? '';
            $status = $_GET['status'] ?? '';
            $role = $_GET['role'] ?? '';

            $query = "
                SELECT
                    id, uuid, email, name, avatar_url,
                    is_active, is_admin, email_verified,
                    created_at, updated_at, last_login,
                    (SELECT COUNT(*) FROM messages WHERE user_id = users.id) as message_count,
                    (SELECT COUNT(*) FROM chats WHERE created_by = users.id) as chat_count
                FROM users
                WHERE 1=1
            ";

            $params = [];
            $types = [];

            if (!empty($search)) {
                $query .= " AND (email LIKE :search OR name LIKE :search)";
                $params[':search'] = "%$search%";
                $types[':search'] = PDO::PARAM_STR;
            }

            if ($status === 'active') {
                $query .= " AND is_active = 1";
            } elseif ($status === 'inactive') {
                $query .= " AND is_active = 0";
            }

            if ($role === 'admin') {
                $query .= " AND is_admin = 1";
            } elseif ($role === 'user') {
                $query .= " AND is_admin = 0";
            }

            // Contar total para paginación
            $countQuery = "SELECT COUNT(*) as total FROM ($query) as filtered";
            $countStmt = $this->db->prepare($countQuery);
            foreach ($params as $key => $value) {
                $countStmt->bindValue($key, $value, $types[$key] ?? PDO::PARAM_STR);
            }
            $countStmt->execute();
            $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Ordenar y paginar
            $query .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            $params[':limit'] = $limit;
            $types[':limit'] = PDO::PARAM_INT;
            $params[':offset'] = $offset;
            $types[':offset'] = PDO::PARAM_INT;

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value, $types[$key] ?? PDO::PARAM_STR);
            }
            $stmt->execute();

            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'users' => $users,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ],
                'filters' => [
                    'search' => $search,
                    'status' => $status,
                    'role' => $role
                ]
            ]);

        } catch (\PDOException $e) {
            error_log("❌ Error obteniendo usuarios: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Error en la base de datos: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Gestión de usuarios (activar/desactivar, cambiar rol)
     */
    public function manageUser()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Se requieren permisos de administrador']);
            return;
        }

        // Validar token CSRF
        $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!CsrfService::validateToken($csrfToken)) {
            http_response_code(403);
            echo json_encode(['error' => 'Token CSRF inválido o ausente']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['user_id']) || !isset($input['action'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requieren user_id y action']);
            return;
        }

        $targetUserId = intval($input['user_id']);
        $action = $input['action'];

        // No permitir modificar a uno mismo
        if ($targetUserId === $userId) {
            http_response_code(400);
            echo json_encode(['error' => 'No puedes modificar tu propio usuario']);
            return;
        }

        try {
            $allowedActions = ['activate', 'deactivate', 'make_admin', 'remove_admin'];
            if (!in_array($action, $allowedActions)) {
                http_response_code(400);
                echo json_encode(['error' => 'Acción no válida']);
                return;
            }

            switch ($action) {
                case 'activate':
                    $query = "UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = :user_id";
                    $logMessage = "Usuario activado";
                    break;
                case 'deactivate':
                    $query = "UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = :user_id";
                    $logMessage = "Usuario desactivado";
                    break;
                case 'make_admin':
                    $query = "UPDATE users SET is_admin = 1, updated_at = NOW() WHERE id = :user_id";
                    $logMessage = "Permisos de admin concedidos";
                    break;
                case 'remove_admin':
                    $query = "UPDATE users SET is_admin = 0, updated_at = NOW() WHERE id = :user_id";
                    $logMessage = "Permisos de admin revocados";
                    break;
            }

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $targetUserId, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                error_log("👤 User management - Action: $action, Target: $targetUserId, By: {$currentUser->email}");

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => $logMessage,
                    'action' => $action,
                    'user_id' => $targetUserId
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado o sin cambios']);
            }

        } catch (\PDOException $e) {
            error_log("❌ Error en manageUser: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * Obtener logs del sistema
     */
    public function getSystemLogs()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUser = $GLOBALS['current_user'];
        $userId = $currentUser->id;

        if (!$this->verifyAdminInDatabase($userId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Se requieren permisos de administrador']);
            return;
        }

        try {
            $limit = min(100, max(10, intval($_GET['limit'] ?? 50)));
            $level = $_GET['level'] ?? '';
            $search = $_GET['search'] ?? '';

            // En un sistema real, esto leería de archivos de log o una tabla de logs
            // Por ahora simulamos algunos logs
            $logs = [
                [
                    'timestamp' => date('Y-m-d H:i:s'),
                    'level' => 'INFO',
                    'message' => 'Panel de administración accedido por ' . $currentUser->email,
                    'user_id' => $userId,
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
                ],
                [
                    'timestamp' => date('Y-m-d H:i:s', time() - 300),
                    'level' => 'DEBUG',
                    'message' => 'Verificación de permisos de administrador completada',
                    'user_id' => $userId,
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
                ]
            ];

            // Simular más logs para demostración
            for ($i = 0; $i < 20; $i++) {
                $levels = ['INFO', 'DEBUG', 'WARNING', 'ERROR'];
                $messages = [
                    'Usuario autenticado correctamente',
                    'Consulta a base de datos ejecutada',
                    'Archivo subido exitosamente',
                    'Error en validación de formulario',
                    'Conexión a API externa establecida'
                ];

                $logs[] = [
                    'timestamp' => date('Y-m-d H:i:s', time() - ($i * 360)),
                    'level' => $levels[array_rand($levels)],
                    'message' => $messages[array_rand($messages)],
                    'user_id' => rand(1, 10),
                    'ip' => '192.168.1.' . rand(1, 255)
                ];
            }

            // Aplicar filtros
            if (!empty($level)) {
                $logs = array_filter($logs, function($log) use ($level) {
                    return $log['level'] === $level;
                });
            }

            if (!empty($search)) {
                $logs = array_filter($logs, function($log) use ($search) {
                    return stripos($log['message'], $search) !== false;
                });
            }

            // Limitar resultados
            $logs = array_slice($logs, 0, $limit);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'logs' => $logs,
                'total' => count($logs),
                'filters' => [
                    'level' => $level,
                    'search' => $search,
                    'limit' => $limit
                ]
            ]);

        } catch (\PDOException $e) {
            error_log("❌ Error obteniendo logs: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Error obteniendo logs: ' . $e->getMessage()
            ]);
        }
    }
}
