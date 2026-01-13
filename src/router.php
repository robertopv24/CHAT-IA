<?php
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Cargar autoloader de Composer y configuración de entorno
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/Config/env.php';

// Verificar que el autoloader funciona
if (!class_exists('Foxia\Config\Env')) {
    // Forzar la carga manual si el autoloader falla
    require_once __DIR__ . '/../src/Config/env.php';
}

// Cargar entorno
\Foxia\Config\loadEnv();

// Importar controladores con use statements
use Foxia\Controllers\AuthController;
use Foxia\Controllers\UserController;
use Foxia\Controllers\ChatController;
use Foxia\Controllers\NotificationController;
use Foxia\Controllers\AdminController;
use Foxia\Controllers\AIController;
use Foxia\Middleware\AuthMiddleware;
use Foxia\Middleware\AdminMiddleware;
use Foxia\Config\Database;
use Foxia\Services\ConfigService;
use Foxia\Services\CsrfService;

// Configuración de zona horaria
date_default_timezone_set('America/Mexico_City');

// Configuración de cabeceras CORS MEJORADA
$allowedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'https://foxia.duckdns.org',
    'https://www.foxia.duckdns.org'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $requestOrigin");
} else {
    // En desarrollo, permitir cualquier origen para testing
    if ((ConfigService::get('APP_ENV') ?? 'development') === 'development') {
        header("Access-Control-Allow-Origin: *");
    } else {
        header("Access-Control-Allow-Origin: " . ($allowedOrigins[0] ?? ''));
    }
}

header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH");
header("Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, X-CSRF-Token, X-API-Key, Accept");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");

// Manejar Content-Type para FormData - CORREGIDO
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'PATCH') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    // Para FormData, no procesar como JSON
    if (strpos($contentType, 'multipart/form-data') === 0) {
        // No hacer nada, dejar que PHP maneje los archivos normalmente
        $_POST = $_POST ?: [];
    } else if (strpos($contentType, 'application/x-www-form-urlencoded') === 0) {
        // Procesar form data normal
        $_POST = $_POST ?: [];
    } else if (strpos($contentType, 'application/json') === 0) {
        // Solo procesar JSON si el content-type es application/json
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $GLOBALS['input_json'] = $input;
        }
    }
}

// Manejar solicitudes pre-flight (OPTIONS) - MEJORADO
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Establecer cabecera para respuestas JSON solo para rutas API
if (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false) {
    header("Content-Type: application/json; charset=UTF-8");
}

// Manejo de errores global
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    
    // Ignorar errores menores en producción
    if (in_array($errno, [E_NOTICE, E_DEPRECATED, E_USER_DEPRECATED])) {
        return true;
    }
    $errorTypes = [
        E_ERROR => 'Error',
        E_WARNING => 'Warning',
        E_PARSE => 'Parse Error',
        E_NOTICE => 'Notice',
        E_DEPRECATED => 'Deprecated'
    ];

    $errorType = $errorTypes[$errno] ?? 'Unknown Error';
    $msg = "🚨 Error PHP [{$errorType}]: $errstr en $errfile línea $errline";
    error_log($msg);

    if ((ConfigService::get('APP_ENV') ?? 'development') === 'production') {
        $errorMessage = 'Error interno del servidor';
    } else {
        $errorMessage = "{$errorType}: $errstr en $errfile:$errline";
    }

    http_response_code(500);
    echo json_encode(['error' => $errorMessage]);
    exit();
});

set_exception_handler(function($exception) {
    $msg = "💥 Excepción no capturada: " . $exception->getMessage() . " en " . $exception->getFile() . ":" . $exception->getLine() . "\nTrace: " . $exception->getTraceAsString();
    error_log($msg);

    if ((ConfigService::get('APP_ENV') ?? 'development') === 'production') {
        $errorMessage = 'Error interno del servidor';
    } else {
        $errorMessage = 'Error interno del servidor: ' . $exception->getMessage();
    }

    http_response_code(500);
    echo json_encode(['error' => $errorMessage]);
    exit();
});

// Validación de método HTTP
$validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, $validMethods)) {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit();
}

// Obtener la ruta solicitada - CORREGIDO
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = '/public';
$route = str_replace($basePath, '', $requestUri);

// Si no hay cambios, usar la ruta original
if ($route === $requestUri) {
    $route = $requestUri;
}

// Limpiar la ruta
$route = rtrim($route, '/');
if (empty($route)) {
    $route = '/';
}

// Logging estructurado para debugging
error_log("🌐 [" . date('Y-m-d H:i:s') . "] Ruta: $route | Método: $method | IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

// Rate Limiting básico
function checkRateLimit() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = 'rate_limit_' . md5($clientIP);
    $limit = 100;
    $window = 60;

    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = [
            'count' => 1,
            'start' => time()
        ];
    } else {
        $data = $_SESSION[$key];

        if (time() - $data['start'] > $window) {
            $_SESSION[$key] = [
                'count' => 1,
                'start' => time()
            ];
        } else {
            $data['count']++;
            $_SESSION[$key] = $data;

            if ($data['count'] > $limit) {
                http_response_code(429);
                echo json_encode(['error' => 'Demasiadas solicitudes. Por favor, espera un momento.']);
                exit();
            }
        }
    }
}

// Iniciar sesión para rate limiting
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Aplicar rate limiting a todas las rutas excepto health check
if ($route !== '/api/health') {
    checkRateLimit();
}

// Cargar manualmente las clases si el autoloader falla
function loadControllerIfNeeded($controllerClass) {
    if (!class_exists($controllerClass)) {
        $controllerFile = __DIR__ . '/controllers/' . str_replace('Foxia\\Controllers\\', '', $controllerClass) . '.php';
        if (file_exists($controllerFile)) {
            require_once $controllerFile;
        }
    }
}

// Definir las rutas
$routes = [
    'POST' => [
        '/api/auth/register' => function() {
            loadControllerIfNeeded('Foxia\Controllers\AuthController');
            (new AuthController())->register();
        },
        '/api/auth/login' => function() {
            loadControllerIfNeeded('Foxia\Controllers\AuthController');
            (new AuthController())->login();
        },

        '/api/user/contacts/add' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->addContact();
        },
        '/api/user/contacts/update-nickname' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->updateContactNickname();
        },
        '/api/user/contacts/toggle-block' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->toggleBlockContact();
        },
        '/api/user/contacts/delete' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->deleteContact();
        },
        '/api/chat/create' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->createChat();
        },
        '/api/chat/find-or-create' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->findOrCreateChat();
        },
        '/api/chat/rename' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->renameChat();
        },
        '/api/chat/delete' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->deleteChat();
        },
        '/api/chat/send-message' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->sendMessage();
        },
        '/api/chat/upload-file' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->uploadFile();
        },
        '/api/chat/messages/delete' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->deleteMessage();
        },
        '/api/user/avatar' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->updateAvatar();
        },
        '/api/notifications/mark-read' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\NotificationController');
            (new NotificationController())->markAsRead();
        },
        '/api/notifications/mark-all-read' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\NotificationController');
            (new NotificationController())->markAllAsRead();
        },
        // NUEVAS RUTAS DE ADMINISTRACIÓN
        '/api/admin/update-setting' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->updateSetting();
        },
        '/api/ai/register-node' => function() {
            (new Foxia\Controllers\AIController())->registerNode();
        },
        '/api/admin/manage-user' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->manageUser();
        },
        '/api/logs/error' => function() {
            // Ruta silenciosa para registrar errores del frontend
            $input = $GLOBALS['input_json'] ?? json_decode(file_get_contents('php://input'), true);
            error_log("💻 Frontend Error: " . json_encode($input));
            http_response_code(200);
            echo json_encode(['status' => 'logged']);
        }
    ],
    'GET' => [
        '/api/auth/csrf-token' => function() {
            header('Content-Type: application/json');
            echo json_encode(['csrf_token' => CsrfService::generateToken()]);
        },
        '/api/auth/verify-email' => function() {
            try {
                loadControllerIfNeeded('Foxia\Controllers\AuthController');

                // Crear instancia del controlador
                $authController = new AuthController();

                // Ejecutar verificación - manejar la lógica dentro del controlador
                $authController->verifyEmail();

                // Si el controlador no redirige, hacerlo aquí
                if (!headers_sent()) {
                    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                    $host = $_SERVER['HTTP_HOST'];
                    $frontendBaseUrl = $protocol . '://' . $host;

                    // Redirigir basado en el código de respuesta HTTP
                    $httpCode = http_response_code();
                    if ($httpCode === 200) {
                        $redirectUrl = $frontendBaseUrl . '?email_verified=1';
                    } else {
                        $errorMessage = 'Error en la verificación';
                        if ($httpCode === 400) $errorMessage = 'Token inválido o expirado';
                        if ($httpCode === 500) $errorMessage = 'Error del servidor';
                        $redirectUrl = $frontendBaseUrl . '?verification_error=1&message=' . urlencode($errorMessage);
                    }

                    header('Location: ' . $redirectUrl);
                    exit;
                }

            } catch (Exception $e) {
                error_log("❌ Error en verify-email route: " . $e->getMessage());

                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'];
                $frontendBaseUrl = $protocol . '://' . $host;

                $redirectUrl = $frontendBaseUrl . '?verification_error=1&message=' . urlencode($e->getMessage());
                header('Location: ' . $redirectUrl);
                exit;
            }
        },
        '/api/user/profile' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->getProfile();
        },
        '/api/user/contacts' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->getContacts();
        },
        '/api/user/privacy-settings' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->getPrivacySettings();
        },
        '/api/notifications/list' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\NotificationController');
            (new NotificationController())->getUnread();
        },
        '/api/notifications/unread' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\NotificationController');
            (new NotificationController())->getUnread();
        },
        '/api/notifications/history' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\NotificationController');
            (new NotificationController())->getHistory();
        },
        '/api/chat/list' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->getChats();
        },
        '/api/chat/messages' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->getMessages();
        },
        '/api/chat/search' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\ChatController');
            (new ChatController())->searchMessages();
        },
        '/api/ai/config' => function() {
            (new Foxia\Controllers\AIController())->getConfig();
        },
        '/api/health' => function() {
            $status = 'ok';
            $services = [];

            try {
                $database = new Database();
                $db = $database->getConnection();
                $db->query('SELECT 1');
                $services['database'] = 'connected';
            } catch (Exception $e) {
                $services['database'] = 'error';
                $status = 'degraded';
            }

            try {
                $redisHost = ConfigService::get('REDIS_HOST') ?? '127.0.0.1';
                $redisPort = ConfigService::get('REDIS_PORT') ?? 6379;
                
                $redis = new Predis\Client([
                    'host' => $redisHost,
                    'port' => $redisPort,
                ]);
                $redis->ping();
                $services['redis'] = 'connected';
            } catch (Exception $e) {
                $services['redis'] = 'error';
                $status = 'degraded';
            }

            // Verificar servicio de archivos
            try {
                $uploadStats = \Foxia\Services\FileUploadService::getStorageStats();
                $services['file_upload'] = 'connected';
            } catch (Exception $e) {
                $services['file_upload'] = 'error';
                $status = 'degraded';
            }

            http_response_code($status === 'ok' ? 200 : 503);
            echo json_encode([
                'status' => $status,
                'timestamp' => date('Y-m-d H:i:s'),
                'service' => 'Fox-IA API',
                'version' => '1.0.0',
                'environment' => ConfigService::get('APP_ENV') ?? 'development',
                'services' => $services,
                'upload_stats' => $uploadStats ?? null
            ]);
        },
        '/api/system/info' => function() {
            if (!AuthMiddleware::handle()) return;
            http_response_code(200);
            echo json_encode([
                'php_version' => PHP_VERSION,
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
                'server_name' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
                'memory_usage' => memory_get_usage(true),
                'memory_peak' => memory_get_peak_usage(true),
                'uptime' => exec('uptime -p') ?: 'Unknown'
            ]);
        },
        '/api/system/storage-stats' => function() {
            if (!AuthMiddleware::handle()) return;
            try {
                $storageStats = \Foxia\Services\FileUploadService::getStorageStats();
                http_response_code(200);
                echo json_encode([
                    'storage_stats' => $storageStats,
                    'timestamp' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Error obteniendo estadísticas de almacenamiento: ' . $e->getMessage()]);
            }
        },
        // RUTAS DE ADMINISTRACIÓN
        '/api/admin/settings' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->getSettings();
        },
        '/api/admin/stats' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->getSystemStats();
        },
        '/api/admin/users' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->getUsers();
        },
        '/api/admin/logs' => function() {
            if (!AdminMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\AdminController');
            (new AdminController())->getSystemLogs();
        },
        // Ruta para servir el panel de administración HTML
        '/admin' => function() {
            $adminHtmlPath = __DIR__ . '/../admin/index.html';
            if (file_exists($adminHtmlPath)) {
                header('Content-Type: text/html');
                readfile($adminHtmlPath);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Panel de administración no encontrado']);
            }
        },
        '/admin/' => function() {
            $adminHtmlPath = __DIR__ . '/../admin/index.html';
            if (file_exists($adminHtmlPath)) {
                header('Content-Type: text/html');
                readfile($adminHtmlPath);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Panel de administración no encontrado']);
            }
        }
    ],
    'PUT' => [
        '/api/user/profile' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->updateProfile();
        },
        '/api/user/password' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->changePassword();
        },
        '/api/user/privacy' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->updatePrivacySettings();
        }
    ],
    'DELETE' => [
        '/api/user/account' => function() {
            if (!AuthMiddleware::handle()) return;
            loadControllerIfNeeded('Foxia\Controllers\UserController');
            (new UserController())->deactivateAccount();
        }
    ]
];

// Búsqueda de rutas
$matchedRoute = null;
$routeParams = [];

// Buscar coincidencia exacta primero
if (isset($routes[$method][$route])) {
    $matchedRoute = $route;
} else {
    // Búsqueda con parámetros
    foreach ($routes[$method] as $routePattern => $handler) {
        $pattern = preg_replace('/\{[^}]+\}/', '([^/]+)', $routePattern);
        $pattern = '#^' . $pattern . '$#';

        if (preg_match($pattern, $route, $matches)) {
            $matchedRoute = $routePattern;
            preg_match_all('/\{[^}]+\}/', $routePattern, $paramNames);
            $paramNames = array_map(function($name) {
                return trim($name, '{}');
            }, $paramNames[0]);

            $routeParams = array_combine($paramNames, array_slice($matches, 1));
            break;
        }
    }
}

// Ejecutar la ruta correspondiente
if ($matchedRoute && isset($routes[$method][$matchedRoute])) {
    try {
        if (!empty($routeParams)) {
            $GLOBALS['route_params'] = $routeParams;
        }

        $routes[$method][$matchedRoute]();

        error_log("✅ Ruta ejecutada: $matchedRoute | Método: $method | Status: OK");

    } catch (Exception $e) {
        error_log("❌ Error ejecutando ruta $matchedRoute: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'error' => 'Error interno del servidor',
            'message' => (ConfigService::get('APP_ENV') ?? 'development') === 'development' ? $e->getMessage() : 'Contacte al administrador'
        ]);
    }
} else {
    // Ruta no encontrada - MEJORADO
    error_log("❌ Ruta no encontrada: $route (Método: $method)");

    // Para rutas API, devolver JSON
    if (strpos($route, '/api/') === 0) {
        http_response_code(404);

        $availableRoutes = [];
        foreach ($routes as $httpMethod => $methodRoutes) {
            $availableRoutes[$httpMethod] = array_keys($methodRoutes);
        }

        echo json_encode([
            'error' => 'Ruta no encontrada',
            'requested_route' => $route,
            'method' => $method,
            'available_methods' => array_keys($routes),
            'suggestions' => $availableRoutes[$method] ?? []
        ]);
    } else {
        // Para rutas no-API, servir página 404 o redirigir
        http_response_code(404);
        header('Content-Type: text/html');
        echo "<!DOCTYPE html>
        <html>
        <head>
            <title>404 - Página No Encontrada</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #666; }
            </style>
        </head>
        <body>
            <h1>404 - Página No Encontrada</h1>
            <p>La ruta solicitada no existe: $route</p>
            <a href='/'>Volver al inicio</a>
        </body>
        </html>";
    }
}
