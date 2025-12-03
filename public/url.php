<?php

// Activamos la visualización de todos los errores para el entorno de desarrollo.
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 1. Cargar el Autoloader de Composer
// Este es el "archivo mágico" que nos permite usar todas nuestras clases sin 'require'.
require_once __DIR__ . '/../vendor/autoload.php';

// 2. Cargar las Variables de Entorno (.env)
// Hacemos que las credenciales de la BD y otras claves estén disponibles.
require_once __DIR__ . '/../src/Config/env.php';

// Llamamos a la función loadEnv, ahora con su namespace completo.
// Esto soluciona el error "Call to undefined function".
\Foxia\Config\loadEnv();

// 3. Pasar el control al Enrutador
// El enrutador se encargará de manejar la petición actual.
require_once __DIR__ . '/../src/router.php';
