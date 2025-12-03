<?php
// src/middleware/AuthMiddleware.php

namespace Foxia\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use DomainException;
use InvalidArgumentException;
use UnexpectedValueException;
use Exception;
use Foxia\Services\ConfigService;

class AuthMiddleware
{
    public static function handle(): bool
    {
        // Obtener el encabezado Authorization
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;

        // Verificar si existe y tiene el formato correcto
        if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            self::sendErrorResponse('Token de autenticación no proporcionado o formato incorrecto');
            return false;
        }

        $jwt = $matches[1];

        // Verificar que el token no esté vacío
        if (empty($jwt)) {
            self::sendErrorResponse('Token de autenticación vacío');
            return false;
        }

        try {
            // Obtener la clave secreta desde las variables de entorno
            $secretKey = ConfigService::get('JWT_SECRET_KEY') ?? '';

            if (empty($secretKey)) {
                self::sendErrorResponse('Error de configuración del servidor', 500);
                return false;
            }

            // Decodificar el token
            $decoded = JWT::decode($jwt, new Key($secretKey, 'HS256'));

            // Almacenar el payload completo en una variable global para acceso en controladores
            $GLOBALS['jwt_payload'] = $decoded;

            // También almacenar específicamente los datos del usuario para fácil acceso
            if (isset($decoded->data)) {
                $GLOBALS['current_user'] = $decoded->data;

                // Opcional: Podemos almacenar también en la superglobal $_REQUEST para mayor compatibilidad
                $_REQUEST['authenticated_user'] = $decoded->data;
            }

            return true;

        } catch (ExpiredException $e) {
            self::sendErrorResponse('Token expirado');
            return false;
        } catch (SignatureInvalidException $e) {
            self::sendErrorResponse('Token con firma inválida');
            return false;
        } catch (DomainException | InvalidArgumentException | UnexpectedValueException $e) {
            self::sendErrorResponse('Token inválido');
            return false;
        } catch (Exception $e) {
            self::sendErrorResponse('Error al procesar el token');
            return false;
        }
    }

    private static function sendErrorResponse(string $message, int $statusCode = 401): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode(['error' => $message]);
    }
}
