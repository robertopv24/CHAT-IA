<?php
// src/controllers/AuthController.php

namespace Foxia\Controllers;

use Foxia\Config\Database;
use Foxia\Services\PHPMailerService;
use Firebase\JWT\JWT;
use PDO;
use PDOException;
use Exception;
use Foxia\Services\ConfigService;

class AuthController
{
    private $db;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function register()
    {
        header('Content-Type: application/json');

        // Obtener y validar datos de entrada
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['email']) || !isset($input['password']) || !isset($input['name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email, password y name son requeridos']);
            return;
        }

        $email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);
        $password = $input['password'];
        $name = htmlspecialchars($input['name'], ENT_QUOTES, 'UTF-8');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email no válido']);
            return;
        }

        if (strlen($password) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'La contraseña debe tener al menos 8 caracteres']);
            return;
        }

        if (strlen($name) < 2) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre debe tener al menos 2 caracteres']);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Verificar si el email ya existe
            $checkEmailQuery = "SELECT id FROM users WHERE email = :email";
            $stmt = $this->db->prepare($checkEmailQuery);
            $stmt->bindParam(':email', $email);
            $stmt->execute();

            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'El email ya está registrado']);
                $this->db->rollBack();
                return;
            }

            // Hashear la contraseña
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);

            // Insertar nuevo usuario
            $insertUserQuery = "INSERT INTO users (uuid, email, password_hash, name, is_active, email_verified)
                               VALUES (UUID(), :email, :password_hash, :name, TRUE, FALSE)";
            $stmt = $this->db->prepare($insertUserQuery);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':password_hash', $passwordHash);
            $stmt->bindParam(':name', $name);
            $stmt->execute();

            $userId = $this->db->lastInsertId();

            // Generar token de verificación
            $verificationToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

            // Insertar token en la tabla de verificaciones
            $insertTokenQuery = "INSERT INTO email_verifications (user_id, verification_token, expires_at)
                                VALUES (:user_id, :verification_token, :expires_at)";
            $stmt = $this->db->prepare($insertTokenQuery);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':verification_token', $verificationToken);
            $stmt->bindParam(':expires_at', $expiresAt);
            $stmt->execute();

            // Enviar email de verificación
            $verificationLink = ConfigService::get('APP_URL') . "/verify-email?token=" . $verificationToken;
            $emailSent = PHPMailerService::sendVerificationEmail($email, $verificationLink);

            if (!$emailSent) {
                throw new Exception("Error al enviar el email de verificación");
            }

            $this->db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Usuario registrado correctamente. Por favor verifica tu email.',
                'user_id' => $userId
            ]);

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error al enviar email: ' . $e->getMessage()]);
        }
    }

    public function verifyEmail()
    {
        header('Content-Type: application/json');

        if (!isset($_GET['token'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Token de verificación requerido']);
            return;
        }

        $token = strip_tags($_GET['token']);

        try {
            $this->db->beginTransaction();

            // Buscar token válido y no expirado
            $findTokenQuery = "SELECT ev.user_id, u.email_verified
                              FROM email_verifications ev
                              JOIN users u ON ev.user_id = u.id
                              WHERE ev.verification_token = :token
                              AND ev.expires_at > NOW()";
            $stmt = $this->db->prepare($findTokenQuery);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            $verification = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$verification) {
                http_response_code(400);
                echo json_encode(['error' => 'Token inválido o expirado']);
                return;
            }

            if ($verification['email_verified']) {
                http_response_code(400);
                echo json_encode(['error' => 'El email ya ha sido verificado']);
                return;
            }

            // Actualizar usuario como verificado
            $updateUserQuery = "UPDATE users SET email_verified = TRUE WHERE id = :user_id";
            $stmt = $this->db->prepare($updateUserQuery);
            $stmt->bindParam(':user_id', $verification['user_id']);
            $stmt->execute();

            // Eliminar token de verificación
            $deleteTokenQuery = "DELETE FROM email_verifications WHERE verification_token = :token";
            $stmt = $this->db->prepare($deleteTokenQuery);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            $this->db->commit();

            http_response_code(200);
            echo json_encode(['message' => 'Email verificado correctamente']);

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    public function login()
    {
        header('Content-Type: application/json');

        // Verificar que la solicitud sea POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
            return;
        }

        // Obtener y validar datos de entrada
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['email']) || !isset($input['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email y password son requeridos']);
            return;
        }

        $email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);
        $password = $input['password'];

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email y password no pueden estar vacíos']);
            return;
        }

        try {
            // Buscar usuario por email
            $query = "SELECT id, uuid, email, password_hash, name, is_active, email_verified
                     FROM users
                     WHERE email = :email AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                http_response_code(401);
                echo json_encode(['error' => 'Credenciales inválidas']);
                return;
            }

            // Verificar contraseña
            if (!password_verify($password, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Credenciales inválidas']);
                return;
            }

            // Verificar si el email está verificado
            if (!$user['email_verified']) {
                http_response_code(403);
                echo json_encode(['error' => 'Debes verificar tu email antes de iniciar sesión']);
                return;
            }

            // Actualizar last_login del usuario
            try {
                $updateQuery = "UPDATE users SET last_login = NOW() WHERE id = :user_id";
                $updateStmt = $this->db->prepare($updateQuery);
                $updateStmt->bindParam(':user_id', $user['id'], PDO::PARAM_INT);
                $updateStmt->execute();
            } catch (PDOException $e) {
                // Log the error but don't interrupt the login flow
                error_log("Error updating last_login for user {$user['id']}: " . $e->getMessage());
            }

            // Generar token JWT
            $secretKey = ConfigService::get('JWT_SECRET_KEY');
            if (!$secretKey) {
                http_response_code(500);
                echo json_encode(['error' => 'Error de configuración del servidor']);
                return;
            }

            $issuedAt = time();
            $expirationTime = $issuedAt + 86400; // 24 horas

            $payload = [
                'iat' => $issuedAt,
                'exp' => $expirationTime,
                'data' => [
                    'id' => $user['id'],
                    'uuid' => $user['uuid'],
                    'email' => $user['email'],
                    'name' => $user['name']
                ]
            ];

            try {
                $jwt = JWT::encode($payload, $secretKey, 'HS256');

                http_response_code(200);
                echo json_encode([
                    'message' => 'Login exitoso',
                    'token' => $jwt,
                    'user' => [
                        'id' => $user['id'],
                        'uuid' => $user['uuid'],
                        'email' => $user['email'],
                        'name' => $user['name']
                    ]
                ]);

            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Error al generar el token: ' . $e->getMessage()]);
            }

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }
}
