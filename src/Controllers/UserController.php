<?php
// src/controllers/UserController.php

namespace Foxia\Controllers;

use finfo;
use Foxia\Config\Database;
use Foxia\Services\FileUploadService;
use PDO;
use PDOException;
use Exception;

class UserController
{
    private $db;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getProfile()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $userId = $GLOBALS['current_user']->id;

        try {
            // --- CONSULTA ACTUALIZADA CON NUEVOS CAMPOS ---
            $query = "SELECT
                        id, uuid, email, name, avatar_url,
                        bio, location, website, phone, date_of_birth,
                        privacy_settings,
                        is_active, is_admin, created_at, updated_at, last_login
                      FROM users
                      WHERE id = :id AND is_active = 1";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $userId, PDO::PARAM_INT);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado']);
                return;
            }

            // Obtener estadísticas del usuario
            $stats = $this->getUserStats($userId);

            http_response_code(200);
            echo json_encode([
                'message' => 'Perfil obtenido exitosamente',
                'profile' => $user,
                'stats' => $stats
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function updateProfile()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos JSON inválidos']);
            return;
        }

        // Campos permitidos para actualización
        $allowedFields = [
            'name' => 'string',
            'bio' => 'string',
            'location' => 'string',
            'website' => 'string',
            'phone' => 'string',
            'date_of_birth' => 'date'
        ];

        $updateData = [];
        $updateParams = [':user_id' => $currentUserId];

        try {
            // Construir dinámicamente la consulta UPDATE
            $updateFields = [];

            foreach ($allowedFields as $field => $type) {
                if (isset($input[$field])) {
                    $value = $input[$field];

                    // Validar según el tipo
                    if ($type === 'string') {
                        $value = htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
                        if (empty($value)) {
                            $value = null;
                        }
                    } elseif ($type === 'date') {
                        if (!empty($value) && !$this->isValidDate($value)) {
                            http_response_code(400);
                            echo json_encode(['error' => "Formato de fecha inválido para $field"]);
                            return;
                        }
                        if (empty($value)) {
                            $value = null;
                        }
                    }

                    $updateFields[] = "$field = :$field";
                    $updateParams[":$field"] = $value;
                }
            }

            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['error' => 'No hay campos válidos para actualizar']);
                return;
            }

            $updateFields[] = "updated_at = NOW()";

            $query = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = :user_id AND is_active = TRUE";

            $stmt = $this->db->prepare($query);
            $stmt->execute($updateParams);

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode([
                    'message' => 'Perfil actualizado exitosamente',
                    'updated_fields' => array_keys($input)
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado o sin cambios']);
            }

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function changePassword()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['current_password']) || !isset($input['new_password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requieren current_password y new_password']);
            return;
        }

        $currentPassword = $input['current_password'];
        $newPassword = $input['new_password'];

        if (strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'La nueva contraseña debe tener al menos 8 caracteres']);
            return;
        }

        try {
            // Verificar contraseña actual
            $query = "SELECT password_hash FROM users WHERE id = :user_id AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado']);
                return;
            }

            if (!password_verify($currentPassword, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Contraseña actual incorrecta']);
                return;
            }

            // Actualizar contraseña
            $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);

            $updateQuery = "UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :user_id";
            $stmt = $this->db->prepare($updateQuery);
            $stmt->bindParam(':password_hash', $newPasswordHash);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(['message' => 'Contraseña actualizada exitosamente']);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function updateAvatar()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        // VERIFICACIÓN MEJORADA
        if (empty($_FILES) || !isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode([
                'error' => 'No se proporcionó un archivo de avatar válido',
                'debug' => [
                    'files_received' => !empty($_FILES),
                    'avatar_file_exists' => isset($_FILES['avatar']),
                    'avatar_error' => isset($_FILES['avatar']) ? $_FILES['avatar']['error'] : 'no file',
                    'error_messages' => [
                        0 => 'No hay error',
                        1 => 'Tamaño excede upload_max_filesize',
                        2 => 'Tamaño excede MAX_FILE_SIZE',
                        3 => 'Archivo subido parcialmente',
                        4 => 'No se subió ningún archivo',
                        6 => 'Falta carpeta temporal',
                        7 => 'No se pudo escribir en disco',
                        8 => 'Extensión PHP detuvo la subida'
                    ]
                ]
            ]);
            return;
        }

        $avatarFile = $_FILES['avatar'];

        try {
            // Validaciones básicas mejoradas
            if (!isset($avatarFile['tmp_name']) || !file_exists($avatarFile['tmp_name'])) {
                throw new Exception('Archivo temporal no encontrado');
            }

            if (!is_uploaded_file($avatarFile['tmp_name'])) {
                throw new Exception('Archivo no subido mediante HTTP POST');
            }

            // Validar que el archivo no esté vacío
            if ($avatarFile['size'] === 0) {
                throw new Exception('El archivo está vacío');
            }

            // OBTENER MIME TYPE REAL - MÉTODO MEJORADO
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $realMimeType = $finfo->file($avatarFile['tmp_name']);

            // También obtener el MIME type reportado por el navegador
            $reportedMimeType = $avatarFile['type'];

            error_log("🔍 MIME Type Analysis:");
            error_log(" - Real MIME: " . $realMimeType);
            error_log(" - Reported MIME: " . $reportedMimeType);
            error_log(" - File name: " . $avatarFile['name']);
            error_log(" - File size: " . $avatarFile['size']);

            // LISTA AMPLIADA DE MIME TYPES PERMITIDOS
            $allowedMimeTypes = [
                'image/avif',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/x-jpeg',
                'image/x-png',
                'image/x-gif',
                'image/svg+xml'
            ];

            // Validar tipo MIME real
            if (!in_array($realMimeType, $allowedMimeTypes)) {
                throw new Exception(
                    "Tipo de archivo no permitido. " .
                    "Tipo detectado: {$realMimeType}, " .
                    "Tipos permitidos: " . implode(', ', $allowedMimeTypes)
                );
            }

            // Validar extensión del archivo por seguridad adicional
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
            $fileExtension = strtolower(pathinfo($avatarFile['name'], PATHINFO_EXTENSION));

            if (!in_array($fileExtension, $allowedExtensions)) {
                throw new Exception(
                    "Extensión de archivo no permitida. " .
                    "Extensión: {$fileExtension}, " .
                    "Extensiones permitidas: " . implode(', ', $allowedExtensions)
                );
            }

            // Validar tamaño (2MB máximo)
            if ($avatarFile['size'] > 2 * 1024 * 1024) {
                throw new Exception('La imagen no debe superar los 2MB');
            }

            // Validar dimensiones mínimas
            $imageInfo = getimagesize($avatarFile['tmp_name']);
            if (!$imageInfo) {
                throw new Exception('No se pudieron leer las dimensiones de la imagen');
            }

            $width = $imageInfo[0];
            $height = $imageInfo[1];

            if ($width < 10 || $height < 10) {
                throw new Exception('La imagen es demasiado pequeña (mínimo 10x10 píxeles)');
            }

            error_log("✅ Validaciones pasadas - Dimensiones: {$width}x{$height}");

            // Usar el servicio de subida de archivos
            $avatarUrl = FileUploadService::uploadAvatar($avatarFile, $currentUserId);

            if (!$avatarUrl) {
                throw new Exception('Error al procesar el avatar');
            }

            // Obtener el avatar anterior para eliminarlo después
            $oldAvatarQuery = "SELECT avatar_url FROM users WHERE id = :user_id";
            $stmt = $this->db->prepare($oldAvatarQuery);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();
            $oldAvatar = $stmt->fetch(PDO::FETCH_ASSOC);

            // Actualizar en la base de datos
            $updateQuery = "UPDATE users SET avatar_url = :avatar_url, updated_at = NOW() WHERE id = :user_id";
            $stmt = $this->db->prepare($updateQuery);
            $stmt->bindParam(':avatar_url', $avatarUrl);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);

            if (!$stmt->execute()) {
                throw new Exception('Error al actualizar el avatar en la base de datos');
            }

            // Eliminar el avatar anterior si existe
            if ($oldAvatar && $oldAvatar['avatar_url']) {
                try {
                    FileUploadService::deleteAvatar($oldAvatar['avatar_url']);
                } catch (Exception $e) {
                    error_log("⚠️ No se pudo eliminar el avatar anterior: " . $e->getMessage());
                    // No fallar la operación principal por esto
                }
            }

            http_response_code(200);
            echo json_encode([
                'message' => 'Avatar actualizado exitosamente',
                'avatar_url' => $avatarUrl,
                'debug_info' => [
                    'file_size' => $avatarFile['size'],
                    'mime_type_real' => $realMimeType,
                    'mime_type_reported' => $reportedMimeType,
                    'dimensions' => "{$width}x{$height}",
                    'user_id' => $currentUserId
                ]
            ]);

        } catch (PDOException $e) {
            error_log("❌ Error de base de datos en updateAvatar: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        } catch (Exception $e) {
            error_log("❌ Error en updateAvatar: " . $e->getMessage());
            http_response_code(400);
            echo json_encode([
                'error' => $e->getMessage(),
                'debug' => [
                    'file_name' => $avatarFile['name'] ?? 'unknown',
                    'file_size' => $avatarFile['size'] ?? 0,
                    'file_type' => $avatarFile['type'] ?? 'unknown'
                ]
            ]);
        }
    }

    public function updatePrivacySettings()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input || !is_array($input)) {
            http_response_code(400);
            echo json_encode(['error' => 'Configuración de privacidad inválida']);
            return;
        }

        // Configuración de privacidad por defecto
        $defaultPrivacySettings = [
            'profile_visibility' => 'public', // public, contacts, private
            'online_status' => true,
            'last_seen' => true,
            'read_receipts' => true,
            'allow_chat_requests' => true,
            'search_visibility' => true
        ];

        // Validar y fusionar con valores por defecto
        $validSettings = [];
        foreach ($defaultPrivacySettings as $key => $defaultValue) {
            if (isset($input[$key])) {
                $value = $input[$key];
                // Validaciones específicas por tipo
                if ($key === 'profile_visibility' && !in_array($value, ['public', 'contacts', 'private'])) {
                    $value = $defaultValue;
                } elseif (in_array($key, ['online_status', 'last_seen', 'read_receipts', 'allow_chat_requests', 'search_visibility'])) {
                    $value = (bool)$value;
                }
                $validSettings[$key] = $value;
            } else {
                $validSettings[$key] = $defaultValue;
            }
        }

        try {
            $privacyJson = json_encode($validSettings);

            $query = "UPDATE users SET privacy_settings = :privacy_settings, updated_at = NOW() WHERE id = :user_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':privacy_settings', $privacyJson);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode([
                'message' => 'Configuración de privacidad actualizada',
                'privacy_settings' => $validSettings
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function deactivateAccount()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        // Confirmación opcional
        $confirm = $input['confirm'] ?? false;

        if (!$confirm) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Se requiere confirmación para desactivar la cuenta',
                'message' => 'Envíe {"confirm": true} para confirmar la desactivación'
            ]);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Soft delete: marcar como inactivo en lugar de eliminar
            $query = "UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = :user_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                // Opcional: Cerrar todas las sesiones activas
                $deleteSessionsQuery = "UPDATE user_sessions SET revoked = TRUE WHERE user_id = :user_id";
                $stmtSessions = $this->db->prepare($deleteSessionsQuery);
                $stmtSessions->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
                $stmtSessions->execute();

                $this->db->commit();

                http_response_code(200);
                echo json_encode([
                    'message' => 'Cuenta desactivada exitosamente',
                    'note' => 'Tu cuenta ha sido desactivada. Puedes contactar al soporte para reactivarla.'
                ]);
            } else {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado']);
            }

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function addContact()
    {
        header('Content-Type: application/json');

        // Verificar que el usuario está autenticado
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        // Obtener y validar datos de entrada
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['contact_identifier'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere email o UUID del contacto']);
            return;
        }

        $contactIdentifier = strip_tags($input['contact_identifier']);

        try {
            $this->db->beginTransaction();

            // Buscar usuario por email o UUID
            $findUserQuery = "SELECT id FROM users
                             WHERE (email = :email_identifier OR uuid = :uuid_identifier OR name = :name_identifier)
                             AND is_active = 1
                             AND id != :current_user_id";

            $stmt = $this->db->prepare($findUserQuery);
            $stmt->bindParam(':email_identifier', $contactIdentifier);
            $stmt->bindParam(':uuid_identifier', $contactIdentifier);
            $stmt->bindParam(':name_identifier', $contactIdentifier); // Vinculamos la misma variable a ambos
            $stmt->bindParam(':current_user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            $contactUser = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$contactUser) {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado o no válido']);
                return;
            }

            $contactId = $contactUser['id'];

            // Verificar si el contacto ya existe
            $checkContactQuery = "SELECT id FROM user_contacts
                                 WHERE user_id = :user_id AND contact_id = :contact_id";

            $stmt = $this->db->prepare($checkContactQuery);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':contact_id', $contactId, PDO::PARAM_INT);
            $stmt->execute();

            if ($stmt->fetch()) {
                $this->db->rollBack();
                http_response_code(409);
                echo json_encode(['error' => 'El contacto ya existe en tu lista']);
                return;
            }

            // Insertar nuevo contacto
            $insertContactQuery = "INSERT INTO user_contacts (user_id, contact_id)
                                  VALUES (:user_id, :contact_id)";

            $stmt = $this->db->prepare($insertContactQuery);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':contact_id', $contactId, PDO::PARAM_INT);
            $stmt->execute();

            $this->db->commit();

            http_response_code(201);
            echo json_encode(['message' => 'Contacto agregado exitosamente']);

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function getContacts()
    {
        header('Content-Type: application/json');

        // Verificar que el usuario está autenticado
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        try {
            // Consultar los contactos del usuario
            $query = "SELECT
                        u.uuid,
                        u.name,
                        u.email,
                        u.avatar_url,
                        u.bio,
                        u.location,
                        u.is_active,
                        u.last_login,
                        uc.created_at as added_at,
                        uc.is_blocked,
                        uc.nickname
                     FROM user_contacts uc
                     INNER JOIN users u ON uc.contact_id = u.id
                     WHERE uc.user_id = :user_id
                     ORDER BY u.name ASC";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Devolver la lista de contactos
            http_response_code(200);
            echo json_encode([
                'message' => 'Contactos obtenidos exitosamente',
                'contacts' => $contacts,
                'count' => count($contacts)
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    // Función de ayuda para obtener ID desde UUID
    private function getUserIdByUuid(string $uuid): ?int
    {
        $query = "SELECT id FROM users WHERE uuid = :uuid AND is_active = 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':uuid', $uuid);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['id'] : null;
    }

    // Método para actualizar el apodo
    public function updateContactNickname()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['contact_uuid'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere contact_uuid']);
            return;
        }

        $contactId = $this->getUserIdByUuid($input['contact_uuid']);
        if (!$contactId) {
            http_response_code(404);
            echo json_encode(['error' => 'Contacto no encontrado']);
            return;
        }

        $nickname = isset($input['nickname']) ? htmlspecialchars(trim($input['nickname']), ENT_QUOTES, 'UTF-8') : null;

        try {
            $query = "UPDATE user_contacts SET nickname = :nickname WHERE user_id = :user_id AND contact_id = :contact_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':nickname', $nickname);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':contact_id', $contactId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(['message' => 'Apodo del contacto actualizado.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    // Método para bloquear/desbloquear
    public function toggleBlockContact()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['contact_uuid'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere contact_uuid']);
            return;
        }

        $contactId = $this->getUserIdByUuid($input['contact_uuid']);
        if (!$contactId) {
            http_response_code(404);
            echo json_encode(['error' => 'Contacto no encontrado']);
            return;
        }

        try {
            $query = "UPDATE user_contacts SET is_blocked = NOT(is_blocked) WHERE user_id = :user_id AND contact_id = :contact_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':contact_id', $contactId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(['message' => 'Estado de bloqueo del contacto actualizado.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    // Método para eliminar contacto
    public function deleteContact()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['contact_uuid'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere contact_uuid']);
            return;
        }

        $contactId = $this->getUserIdByUuid($input['contact_uuid']);
        if (!$contactId) {
            http_response_code(404);
            echo json_encode(['error' => 'Contacto no encontrado']);
            return;
        }

        try {
            $query = "DELETE FROM user_contacts WHERE user_id = :user_id AND contact_id = :contact_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':contact_id', $contactId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(['message' => 'Contacto eliminado.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    /**
     * 🔥 NUEVOS MÉTODOS PARA FUNCIONALIDADES DE PERFIL
     */

    /**
     * Obtener estadísticas del usuario
     */
    private function getUserStats(int $userId): array
    {
        try {
            $stats = [];

            // Total de chats
            $chatsQuery = "SELECT COUNT(DISTINCT chat_id) as total_chats
                          FROM chat_participants
                          WHERE user_id = :user_id";
            $stmt = $this->db->prepare($chatsQuery);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            $stats['total_chats'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total_chats'] ?? 0;

            // Total de mensajes
            $messagesQuery = "SELECT COUNT(*) as total_messages
                             FROM messages
                             WHERE user_id = :user_id AND deleted = FALSE";
            $stmt = $this->db->prepare($messagesQuery);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            $stats['total_messages'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total_messages'] ?? 0;

            // Total de contactos
            $contactsQuery = "SELECT COUNT(*) as total_contacts
                             FROM user_contacts
                             WHERE user_id = :user_id";
            $stmt = $this->db->prepare($contactsQuery);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            $stats['total_contacts'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['total_contacts'] ?? 0;

            // Días desde registro
            $daysQuery = "SELECT DATEDIFF(NOW(), created_at) as days_registered
                         FROM users
                         WHERE id = :user_id";
            $stmt = $this->db->prepare($daysQuery);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();
            $stats['days_registered'] = (int)$stmt->fetch(PDO::FETCH_ASSOC)['days_registered'] ?? 0;

            return $stats;

        } catch (PDOException $e) {
            error_log("Error obteniendo estadísticas de usuario: " . $e->getMessage());
            return [
                'total_chats' => 0,
                'total_messages' => 0,
                'total_contacts' => 0,
                'days_registered' => 0
            ];
        }
    }

    /**
     * Validar formato de fecha
     */
    private function isValidDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    /**
     * Obtener configuración de privacidad actual
     */
    public function getPrivacySettings()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        try {
            $query = "SELECT privacy_settings FROM users WHERE id = :user_id AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                http_response_code(404);
                echo json_encode(['error' => 'Usuario no encontrado']);
                return;
            }

            $privacySettings = $user['privacy_settings'] ? json_decode($user['privacy_settings'], true) : [];

            // Configuración por defecto si no existe
            $defaultPrivacySettings = [
                'profile_visibility' => 'public',
                'online_status' => true,
                'last_seen' => true,
                'read_receipts' => true,
                'allow_chat_requests' => true,
                'search_visibility' => true
            ];

            $mergedSettings = array_merge($defaultPrivacySettings, $privacySettings);

            http_response_code(200);
            echo json_encode([
                'message' => 'Configuración de privacidad obtenida',
                'privacy_settings' => $mergedSettings
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }
}
