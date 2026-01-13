<?php
// src/Services/CsrfService.php

namespace Foxia\Services;

class CsrfService
{
    /**
     * Generar un token CSRF y guardarlo en la sesión
     */
    public static function generateToken(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['csrf_token'];
    }

    /**
     * Validar un token CSRF
     */
    public static function validateToken(?string $token): bool
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (empty($token) || empty($_SESSION['csrf_token'])) {
            return false;
        }

        return hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Obtener el token actual sin regenerar (a menos que no exista)
     */
    public static function getToken(): string
    {
        return self::generateToken();
    }
}
