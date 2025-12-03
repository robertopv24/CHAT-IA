<?php
// src/Middleware/AdminMiddleware.php

namespace Foxia\Middleware;

use Foxia\Config\Database;
use PDO;

class AdminMiddleware
{
    private $db;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public static function handle(): bool
    {
        return (new self())->verifyAdmin();
    }

    private function verifyAdmin(): bool
    {
        // 1. Verificar autenticación básica
        if (!AuthMiddleware::handle()) {
            return false;
        }

        // 2. Obtener usuario actual
        $user = $GLOBALS['current_user'] ?? null;
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return false;
        }

        // 3. Verificación en base de datos
        try {
            $query = "SELECT is_admin, email FROM users WHERE id = :user_id AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $user->id, PDO::PARAM_INT);
            $stmt->execute();

            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData || (int)$userData['is_admin'] !== 1) {
                error_log("❌ AdminMiddleware: User {$user->id} ({$userData['email']}) is not admin");

                http_response_code(403);
                echo json_encode([
                    'error' => 'Acceso prohibido. Se requiere rol de administrador.',
                    'debug' => [
                        'user_id' => $user->id,
                        'db_is_admin' => $userData['is_admin'] ?? 'null',
                        'required' => 1
                    ]
                ]);
                return false;
            }

            error_log("✅ AdminMiddleware: User {$user->id} ({$userData['email']}) verified as admin");
            return true;

        } catch (\PDOException $e) {
            error_log("❌ Error en AdminMiddleware: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Error verificando permisos de administrador']);
            return false;
        }
    }
}
