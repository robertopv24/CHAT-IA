<?php

namespace Foxia\Config;

/**
 * Carga las variables de entorno desde un archivo .env en la raíz del proyecto.
 */
function loadEnv(): void {
    $envPath = __DIR__ . '/../../.env'; // Sube un nivel desde /config para encontrar la raíz

    if (!file_exists($envPath)) {
        // En un entorno de producción, esto debería lanzar una excepción o detener la ejecución.
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue; // Ignora los comentarios
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        // Limpia las comillas si existen
        if (substr($value, 0, 1) == '"' && substr($value, -1) == '"') {
            $value = substr($value, 1, -1);
        }

        if (!empty($name)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}
