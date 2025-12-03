<?php
// bin/websocket-config.php

// Cargar variables de entorno manualmente
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // Saltar comentarios
        
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        
        // Remover comillas si existen
        $value = trim($value, '"\'');
        
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
} else {
    echo "❌ Archivo .env no encontrado en: " . dirname($envFile) . "\n";
    echo "📁 Directorio actual: " . __DIR__ . "\n";
    echo "📁 Contenido del directorio:\n";
    foreach (scandir(__DIR__ . '/..') as $item) {
        if ($item !== '.' && $item !== '..') {
            echo "   - $item\n";
        }
    }
}

// Validar que JWT_SECRET_KEY esté configurada
if (empty($_ENV['JWT_SECRET_KEY'])) {
    echo "❌ ERROR: JWT_SECRET_KEY no está configurada en las variables de entorno\n";
    echo "💡 Solución: Asegúrate de que el archivo .env existe y contiene JWT_SECRET_KEY\n";
    exit(1);
}

echo "✅ Variables de entorno cargadas correctamente\n";
echo "✅ JWT_SECRET_KEY: " . substr($_ENV['JWT_SECRET_KEY'], 0, 10) . "..." . "\n";