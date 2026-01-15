<?php
// bin/websocket-server.php - VERSIÓN MEJORADA Y CORREGIDA CON SSL/TLS
require __DIR__ . '/../vendor/autoload.php';

// 🔥 CARGAR CONFIGURACIÓN ANTES DE CUALQUIER OTRA COSA
require __DIR__ . '/websocket-config.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Foxia\Services\ChatServer;
use Clue\React\Redis\Factory as RedisFactory;
use React\EventLoop\Loop;
use React\Socket\Server as ReactServer;
use React\Socket\SecureServer;
use Foxia\Config\Database;

// ================================================
// 🔥 CLASES AUXILIARES MEJORADAS
// ================================================

class RedisConnectionManager {
    private $reconnectAttempts = 0;
    private $maxReconnectAttempts = 10;
    private $baseDelay = 1; // segundos
    private $maxDelay = 60; // segundos
    private $redisClient = null;
    private $metrics;

    public function __construct($metrics = null) {
        $this->metrics = $metrics;
    }

    public function handleReconnection($redisFactory, $redisUri, $chatServer, $server) {
        return function () use ($redisFactory, $redisUri, $chatServer, $server) {
            $this->reconnectAttempts++;

            if ($this->reconnectAttempts > $this->maxReconnectAttempts) {
                error_log("❌ Máximo de reconexiones Redis alcanzado. Deteniendo intentos.");
                $this->notifyAdmin("Redis connection failed after {$this->maxReconnectAttempts} attempts");
                return;
            }

            $delay = min($this->baseDelay * pow(2, $this->reconnectAttempts - 1), $this->maxDelay);
            error_log("🔄 Redis reconnect attempt {$this->reconnectAttempts}/{$this->maxReconnectAttempts} in {$delay}s");

            $server->loop->addTimer($delay, function() use ($redisFactory, $redisUri, $chatServer, $server) {
                $this->setupRedisConnection($redisFactory, $redisUri, $chatServer, $server);
            });
        };
    }

    public function setupRedisConnection($redisFactory, $redisUri, $chatServer, $server) {
        return $redisFactory->createClient($redisUri)->then(
            function ($redisClient) use ($chatServer, $server, $redisFactory, $redisUri) {
                echo "✅ Conectado a Redis exitosamente\n";
                $this->redisClient = $redisClient;
                $this->resetReconnectAttempts();

                // Configurar heartbeat Redis
                $this->setupRedisHeartbeat($redisClient, $server);

                // Suscribirse al canal de chat
                $redisClient->subscribe('canal-chat');
                echo "📡 Suscrito al canal 'canal-chat'\n";

                // Configurar manejador de mensajes Redis
                $redisClient->on('message', function ($channel, $payload) use ($chatServer) {
                    $this->processRedisMessage($payload, $chatServer);
                });

                // Manejar errores de Redis
                $redisClient->on('error', function (\Exception $e) {
                    error_log("❌ Error de Redis: " . $e->getMessage());
                    if ($this->metrics) {
                        $this->metrics->incrementErrors();
                    }
                });

                // Configurar reconexión automática
                $redisClient->on('close', $this->handleReconnection($redisFactory, $redisUri, $chatServer, $server));

                return $redisClient;
            },
            function (\Exception $e) use ($server, $redisFactory, $redisUri, $chatServer) {
                error_log("❌ Error en reconexión a Redis: " . $e->getMessage());
                $this->handleReconnection($redisFactory, $redisUri, $chatServer, $server)();
                throw $e;
            }
        );
    }

    private function setupRedisHeartbeat($redisClient, $server) {
        $server->loop->addPeriodicTimer(30, function() use ($redisClient) {
            try {
                $startTime = microtime(true);
                $redisClient->ping()->then(
                    function() use ($startTime) {
                        $latency = (microtime(true) - $startTime) * 1000;
                        if ($this->metrics) {
                            $this->metrics->recordRedisLatency($latency);
                        }
                    },
                    function($e) {
                        error_log("❌ Redis heartbeat failed: " . $e->getMessage());
                    }
                );
            } catch (Exception $e) {
                error_log("❌ Redis heartbeat exception: " . $e->getMessage());
            }
        });
    }

    public function resetReconnectAttempts() {
        $this->reconnectAttempts = 0;
    }

    private function notifyAdmin($message) {
        // Implementar notificación a administrador (email, Slack, etc.)
        error_log("🚨 ADMIN ALERT: {$message}");
    }

    private function processRedisMessage($payload, $chatServer) {
        $startTime = microtime(true);

        try {
            $data = json_decode($payload, true);

            if (json_last_error() !== JSON_ERROR_NONE || !$data) {
                error_log("❌ Error decodificando JSON de Redis: " . json_last_error_msg());
                if ($this->metrics) {
                    $this->metrics->incrementErrors();
                }
                return;
            }

            // Validar estructura del mensaje
            if (!$this->validateMessageStructure($data)) {
                error_log("❌ Mensaje Redis con estructura inválida: " . json_encode($data));
                if ($this->metrics) {
                    $this->metrics->incrementErrors();
                }
                return;
            }

            // Procesar mensaje válido
            if (isset($data['type']) && in_array($data['type'], ['new_message', 'new_notification'])) {
                echo "🔄 Procesando mensaje Redis para chat: " . ($data['chat_uuid'] ?? 'notification') . "\n";
                $chatServer->processRedisMessage($data);
                if ($this->metrics) {
                    $this->metrics->incrementRedisMessages();
                }
            } else {
                echo "⚠️ Mensaje Redis con formato inesperado: " . ($data['type'] ?? 'sin tipo') . "\n";
            }
        } catch (\Exception $e) {
            error_log("❌ Error procesando mensaje Redis: " . $e->getMessage());
            if ($this->metrics) {
                $this->metrics->incrementErrors();
            }
        } finally {
            $processingTime = (microtime(true) - $startTime) * 1000;
            if ($this->metrics && method_exists($this->metrics, 'recordProcessingTime')) {
                $this->metrics->recordProcessingTime($processingTime);
            }
        }
    }

    private function validateMessageStructure($message): bool {
            if (!is_array($message)) return false;

            if (!isset($message['type'])) return false;

            switch ($message['type']) {
                case 'new_message':
                    $required = ['chat_uuid', 'message'];
                    foreach ($required as $field) {
                        if (!isset($message[$field])) return false;
                    }

                    if (!is_array($message['message'])) return false;

                    // =====================================================
                    // ✅ ¡AQUÍ ESTÁ LA CORRECCIÓN!
                    // =====================================================
                    // Cambiamos isset() por array_key_exists() para permitir user_id = null (IA)

                    $messageRequired = ['uuid', 'content', 'user_id', 'created_at'];
                    foreach ($messageRequired as $field) {
                        if (!array_key_exists($field, $message['message'])) { // <-- CAMBIO DE isset()
                            return false;
                        }
                    }
                    break;

                case 'new_notification':
                    if (!isset($message['notification']) || !is_array($message['notification'])) return false;

                    // Aplicamos la misma corrección aquí por consistencia
                    if (!array_key_exists('user_id', $message['notification'])) { // <-- CAMBIO DE isset()
                        return false;
                    }
                    break;

                default:
                    return false;
            }

            return true;
        }

    public function getClient() {
        return $this->redisClient;
    }
}

class WebSocketMetrics {
    private $connections = 0;
    private $messagesProcessed = 0;
    private $redisMessages = 0;
    private $errors = 0;
    private $startTime;
    private $redisLatencies = [];
    private $processingTimes = [];

    public function __construct() {
        $this->startTime = time();
    }

    public function incrementConnections() { $this->connections++; }
    public function decrementConnections() { $this->connections--; }
    public function incrementMessages() { $this->messagesProcessed++; }
    public function incrementRedisMessages() { $this->redisMessages++; }
    public function incrementErrors() { $this->errors++; }

    public function recordRedisLatency(float $latencyMs) {
        $this->redisLatencies[] = $latencyMs;
        // Mantener solo las últimas 1000 mediciones
        if (count($this->redisLatencies) > 1000) {
            array_shift($this->redisLatencies);
        }
    }

    public function recordProcessingTime(float $processingTimeMs) {
        $this->processingTimes[] = $processingTimeMs;
        if (count($this->processingTimes) > 1000) {
            array_shift($this->processingTimes);
        }
    }

    public function getMetrics() {
        $uptime = time() - $this->startTime;

        $redisStats = $this->getRedisStats();
        $processingStats = $this->getProcessingStats();

        return [
            'uptime' => $uptime,
            'uptime_human' => $this->formatUptime($uptime),
            'active_connections' => $this->connections,
            'messages_processed' => $this->messagesProcessed,
            'redis_messages' => $this->redisMessages,
            'error_rate' => $this->messagesProcessed > 0 ? round(($this->errors / $this->messagesProcessed) * 100, 2) : 0,
            'messages_per_second' => $uptime > 0 ? round($this->messagesProcessed / $uptime, 2) : 0,
            'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2) . ' MB',
            'memory_peak' => round(memory_get_peak_usage(true) / 1024 / 1024, 2) . ' MB',
            'redis_avg_latency' => $redisStats['avg_latency'] . 'ms',
            'processing_avg_time' => $processingStats['avg_time'] . 'ms'
        ];
    }

    private function getRedisStats(): array {
        if (empty($this->redisLatencies)) {
            return ['avg_latency' => 0, 'p95_latency' => 0];
        }

        sort($this->redisLatencies);
        $count = count($this->redisLatencies);

        return [
            'avg_latency' => round(array_sum($this->redisLatencies) / $count, 2),
            'p95_latency' => round($this->redisLatencies[floor($count * 0.95)], 2)
        ];
    }

    private function getProcessingStats(): array {
        if (empty($this->processingTimes)) {
            return ['avg_time' => 0, 'p95_time' => 0];
        }

        sort($this->processingTimes);
        $count = count($this->processingTimes);

        return [
            'avg_time' => round(array_sum($this->processingTimes) / $count, 2),
            'p95_time' => round($this->processingTimes[floor($count * 0.95)], 2)
        ];
    }

    private function formatUptime($seconds) {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $seconds = $seconds % 60;
        return sprintf("%02d:%02d:%02d", $hours, $minutes, $seconds);
    }

    public function healthCheck() {
        $metrics = $this->getMetrics();
        $status = 'healthy';

        if ($metrics['error_rate'] > 5) $status = 'degraded';
        if (memory_get_usage(true) > 100 * 1024 * 1024) $status = 'warning'; // 100MB
        if ($this->connections === 0 && $metrics['uptime'] > 300) $status = 'unhealthy'; // 5 minutos sin conexiones

        return ['status' => $status, 'metrics' => $metrics];
    }

    public function logStatus() {
        $health = $this->healthCheck();
        $metrics = $health['metrics'];

        $statusMessage = "📊 [{$health['status']}] Connections: {$metrics['active_connections']} | " .
                        "Messages: {$metrics['messages_processed']} | " .
                        "Redis: {$metrics['redis_messages']} | " .
                        "Error Rate: {$metrics['error_rate']}% | " .
                        "Redis Latency: {$metrics['redis_avg_latency']} | " .
                        "Uptime: {$metrics['uptime_human']}";

        echo $statusMessage . "\n";
        return $health;
    }
}

class MemoryManager {
    private $memoryLimit;
    private $checkInterval;
    private $chatServer;

    public function __construct($memoryLimitMB = 100, $checkInterval = 30) {
        $this->memoryLimit = $memoryLimitMB * 1024 * 1024;
        $this->checkInterval = $checkInterval;
    }

    public function setChatServer($chatServer) {
        $this->chatServer = $chatServer;
    }

    public function startMemoryMonitoring($server) {
        $server->loop->addPeriodicTimer($this->checkInterval, function() {
            $currentUsage = memory_get_usage(true);

            if ($currentUsage > $this->memoryLimit * 0.8) {
                $this->handleHighMemoryUsage();
            }

            // Log memory usage cada 5 minutos
            if (time() % 300 === 0) {
                error_log("🧠 Memory usage: " . round($currentUsage / 1024 / 1024, 2) . "MB");
            }
        });
    }

    private function handleHighMemoryUsage() {
        error_log("⚠️  High memory usage detected, forcing garbage collection");
        gc_collect_cycles();

        // Limpiar conexiones inactivas si está disponible
        if ($this->chatServer) {
            $cleaned = $this->chatServer->cleanupOrphanedConnections();
            error_log("🧹 Cleaned $cleaned orphaned connections due to memory pressure");
        }
    }
}

class RedisCircuitBreaker {
    private $failureCount = 0;
    private $lastFailureTime = 0;
    private $state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    private $threshold = 5;
    private $timeout = 60;

    public function execute(callable $redisOperation) {
        if ($this->state === 'OPEN') {
            if (time() - $this->lastFailureTime > $this->timeout) {
                $this->state = 'HALF_OPEN';
            } else {
                throw new Exception('Circuit breaker open - Redis no disponible');
            }
        }

        try {
            $result = $redisOperation();
            $this->onSuccess();
            return $result;
        } catch (Exception $e) {
            $this->onFailure();
            throw $e;
        }
    }

    private function onSuccess() {
        $this->failureCount = 0;
        $this->state = 'CLOSED';
    }

    private function onFailure() {
        $this->failureCount++;
        $this->lastFailureTime = time();

        if ($this->failureCount >= $this->threshold) {
            $this->state = 'OPEN';
            error_log("🚨 Redis circuit breaker OPEN after {$this->failureCount} failures");
        }
    }

    public function getState(): string {
        return $this->state;
    }
}

// ================================================
// 🔥 CONFIGURACIÓN PRINCIPAL DEL SERVIDOR
// ================================================

// Configuración del servidor WebSocket
$port = 4431;
$host = '0.0.0.0';

// Verificar que las variables críticas estén configuradas
$requiredEnvVars = ['JWT_SECRET_KEY', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
foreach ($requiredEnvVars as $var) {
    if (empty($_ENV[$var])) {
        echo "❌ ERROR CRÍTICO: $var no está configurada\n";
        exit(1);
    }
}

// Crear instancia del servidor de chat
try {
    $database = new Database();
    $chatServer = new ChatServer($database);
    echo "✅ Servidor de chat inicializado con factoría de base de datos\n";
} catch (\Exception $e) {
    echo "❌ Error inicializando servidor de chat: " . $e->getMessage() . "\n";
    exit(1);
}

// Crear servidor WebSocket SEGURO con SSL/TLS
try {
    // 🔒 CONFIGURACIÓN SSL/TLS MEJORADA
    $loop = Loop::get();

    // Crear socket TCP base
    $socket = new ReactServer("$host:$port", $loop);

    // Configurar SSL/TLS
    $secureSocket = new SecureServer($socket, $loop, [
        'local_cert' => '/etc/letsencrypt/live/foxia.duckdns.org/fullchain.pem',
        'local_pk' => '/etc/letsencrypt/live/foxia.duckdns.org/privkey.pem',
        'allow_self_signed' => false,
        'verify_peer' => false,
        'verify_peer_name' => false
    ]);

    // Crear servidor IoServer con el socket seguro
    $server = new IoServer(
        new HttpServer(
            new WsServer($chatServer)
        ),
        $secureSocket,
        $loop
    );

    // ================================================
    // 🔥 INICIALIZACIÓN DE COMPONENTES MEJORADOS
    // ================================================

    $metrics = new WebSocketMetrics();
    $redisManager = new RedisConnectionManager($metrics);
    $memoryManager = new MemoryManager(100, 30); // 100MB límite, verificar cada 30s
    $memoryManager->setChatServer($chatServer);
    $circuitBreaker = new RedisCircuitBreaker();

    // ================================================
    // 🔥 CONEXIÓN REDIS MEJORADA
    // ================================================

    // Configurar conexión a Redis para Pub/Sub
    $redisHost = $_ENV['REDIS_HOST'] ?? '127.0.0.1';
    $redisPort = $_ENV['REDIS_PORT'] ?? 6379;
    $redisPassword = $_ENV['REDIS_PASSWORD'] ?? '';
    $redisDb = $_ENV['REDIS_DB'] ?? 0;

    // Construir URI de Redis correctamente para clue/redis-react
    $redisUri = "redis://";
    if (!empty($redisPassword)) {
        $redisUri .= ":$redisPassword@";
    }
    $redisUri .= "$redisHost:$redisPort";
    if ($redisDb > 0) {
        $redisUri .= "/$redisDb";
    }

    echo "🔗 Conectando a Redis: " . str_replace($redisPassword, '***', $redisUri) . "\n";

    // Crear factory de Redis React
    $redisFactory = new RedisFactory($server->loop);

    // Conectar a Redis de forma asíncrona usando el manager mejorado
    $circuitBreaker->execute(function() use ($redisManager, $redisFactory, $redisUri, $chatServer, $server) {
        return $redisManager->setupRedisConnection($redisFactory, $redisUri, $chatServer, $server);
    })->then(
        function ($redisClient) {
            echo "✅ Redis connection established and managed\n";
        },
        function (\Exception $e) use ($redisUri, $redisPassword) {
            echo "❌ ERROR: No se pudo conectar a Redis\n";
            echo "   Mensaje: " . $e->getMessage() . "\n";
            echo "   URI utilizada: " . str_replace($redisPassword ?? '', '***', $redisUri) . "\n";
            echo "💡 El servidor WebSocket funcionará sin Redis, pero las notificaciones en tiempo real no estarán disponibles\n";
        }
    );

    // ================================================
    // 🔥 CONFIGURACIÓN DE TEMPORIZADORES MEJORADOS
    // ================================================

    // Temporizador para limpieza periódica de conexiones
    $server->loop->addPeriodicTimer(300, function() use ($chatServer, $metrics) {
        $cleaned = $chatServer->cleanupOrphanedConnections();
        if ($cleaned > 0) {
            echo "🧹 Limpiadas {$cleaned} conexiones huérfanas\n";
        }
    });

    // Temporizador para monitoreo de estado mejorado
    $server->loop->addPeriodicTimer(60, function() use ($metrics) {
        $health = $metrics->logStatus();

        // Alertar si el estado no es healthy
        if ($health['status'] !== 'healthy') {
            echo "⚠️  ALERTA: Estado del servidor - " . $health['status'] . "\n";
        }

        // Liberar memoria periódicamente
        gc_collect_cycles();
    });

    // Temporizador para ping de conexiones activas con throttling
    $pingBatchSize = 50;
    $server->loop->addPeriodicTimer(30, function() use ($chatServer, $pingBatchSize) {
        static $lastPingIndex = 0;

        // En producción, implementar sendPingToConnectionsBatch
        $activeCount = $chatServer->sendPingToConnections();
        if ($activeCount > 0 && $lastPingIndex % 10 === 0) { // Log cada 10 ciclos
            echo "🏓 Ping enviado a conexiones activas (total: $activeCount)\n";
        }
        $lastPingIndex++;
    });

    // Iniciar monitoreo de memoria
    $memoryManager->startMemoryMonitoring($server);

    // ================================================
    // 🔥 MANEJADOR DE CIERRE ELEGANTE (GRACEFUL SHUTDOWN)
    // ================================================

    $shutdownHandler = function ($signal) use ($server, $redisManager, $chatServer, $metrics) {
        $signalNames = [
            SIGTERM => 'SIGTERM',
            SIGINT => 'SIGINT',
            SIGHUP => 'SIGHUP'
        ];

        $signalName = $signalNames[$signal] ?? $signal;
        echo "\n🛑 Recibida señal {$signalName}. Cerrando elegantemente...\n";

        // Log métricas finales
        $finalMetrics = $metrics->getMetrics();
        error_log("📊 Métricas finales: " . json_encode($finalMetrics));

        // 1. Notificar a todos los clientes conectados
        $connectionsCount = 0;
        if (method_exists($chatServer, 'notifyClientsAboutShutdown')) {
            $connectionsCount = $chatServer->notifyClientsAboutShutdown();
        }
        echo "📢 Notificado a {$connectionsCount} clientes sobre el cierre\n";

        // 2. Cerrar conexión Redis limpiamente
        $redisClient = $redisManager->getClient();
        if ($redisClient) {
            $redisClient->close();
            echo "🔌 Conexión Redis cerrada\n";
        }

        // 3. Esperar brevemente para que los mensajes se envíen
        echo "⏳ Esperando 2 segundos para finalización de mensajes...\n";
        $server->loop->addTimer(2, function() use ($server) {
            // 4. Detener el bucle de eventos
            $server->loop->stop();
            echo "✅ Servidor cerrado elegantemente\n";
            exit(0);
        });
    };

    // Registrar manejadores de señales para graceful shutdown
    if (extension_loaded('pcntl')) {
        $server->loop->addSignal(SIGTERM, $shutdownHandler);
        $server->loop->addSignal(SIGINT, $shutdownHandler);
        $server->loop->addSignal(SIGHUP, $shutdownHandler);
        echo "🔧 Manejadores de señales registrados (SIGTERM, SIGINT, SIGHUP)\n";
    } else {
        echo "⚠️  Extensión pcntl no disponible. Graceful shutdown limitado.\n";
    }

    // ================================================
    // 🔥 INFORMACIÓN DE INICIO MEJORADA
    // ================================================

    echo "========================================\n";
    echo "🦊 Fox-IA WebSocket Server - MEJORADO CON SSL/TLS\n";
    echo "========================================\n";
    echo "📍 Escuchando en: {$host}:{$port}\n";
    echo "🔒 Conexión segura: wss://foxia.duckdns.org:4431\n";
    echo "📁 Archivos estáticos: https://foxia.duckdns.org/\n";
    echo "🔐 JWT Key: " . (isset($_ENV['JWT_SECRET_KEY']) ? '✅ Configurada' : '❌ Faltante') . "\n";
    echo "🔗 Redis: " . (isset($_ENV['REDIS_HOST']) ? '✅ Configurado' : '❌ Faltante') . "\n";
    echo "📊 Métricas: ✅ Implementadas\n";
    echo "🔄 Reconexión Redis: ✅ Mejorada\n";
    echo "🧠 Gestión Memoria: ✅ Activada\n";
    echo "⚡ Circuit Breaker: ✅ Implementado\n";
    echo "🔒 SSL/TLS: ✅ Activado\n";
    echo "🛑 Graceful Shutdown: " . (extension_loaded('pcntl') ? '✅ Activado' : '❌ No disponible') . "\n";
    echo "🚀 Servidor iniciado: " . date('Y-m-d H:i:s') . "\n";
    echo "⏹️  Presiona Ctrl+C para detener elegantemente\n";
    echo "========================================\n\n";

    // ================================================
    // 🔥 INYECCIÓN DE MÉTRICAS EN EL CHAT SERVER
    // ================================================

    // Método para actualizar métricas desde el ChatServer
    $chatServer->setMetricsCallback(function($type, $data = null) use ($metrics) {
        switch ($type) {
            case 'connection_opened':
                $metrics->incrementConnections();
                break;
            case 'connection_closed':
                $metrics->decrementConnections();
                break;
            case 'message_processed':
                $metrics->incrementMessages();
                break;
            case 'redis_message_processed':
                $metrics->incrementRedisMessages();
                break;
            case 'error_occurred':
                $metrics->incrementErrors();
                break;
        }
    });

    // Iniciar servidor
    $server->run();

} catch (\Exception $e) {
    echo "❌ Error iniciando servidor WebSocket: " . $e->getMessage() . "\n";
    echo "💡 Verifica que el puerto {$port} no esté en uso y los certificados SSL existan\n";
    echo "💡 Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

// ================================================
// 🔥 FUNCIÓN DE COMPATIBILIDAD (para llamadas recursivas)
// ================================================

/**
 * Función de compatibilidad para mantener la interfaz original
 * @deprecated Usar RedisConnectionManager en su lugar
 */
function setupRedisConnection($redisFactory, $redisUri, $chatServer, $server) {
    static $redisManager = null;

    if ($redisManager === null) {
        $redisManager = new RedisConnectionManager();
    }

    return $redisManager->setupRedisConnection($redisFactory, $redisUri, $chatServer, $server);
}
