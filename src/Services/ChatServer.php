<?php
// src/Services/ChatServer.php - VERSIÓN ACTUALIZADA CON MÉTRICAS

namespace Foxia\Services;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use SplObjectStorage;
use Exception;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Foxia\Services\ConfigService;

class ChatServer implements MessageComponentInterface
{
    protected $clients;
    private $userConnections;
    private $chatConnections;
    private $connectionUsers;
    private $connectionChats;
    private $metricsCallback;
    private $dbFactory;
    private $pdo;

    public function __construct($dbFactory = null)
    {
        $this->clients = new SplObjectStorage;
        $this->userConnections = [];
        $this->chatConnections = [];
        $this->connectionUsers = [];
        $this->connectionChats = [];
        $this->metricsCallback = null;
        $this->dbFactory = $dbFactory;
        $this->pdo = $dbFactory ? $dbFactory->getConnection() : null;
        error_log("🔄 Servidor de Chat Fox-IA iniciado...");
    }

    /**
     * 🔥 NUEVO MÉTODO: Establecer el callback para reportar métricas
     */
    public function setMetricsCallback(callable $callback): void
    {
        $this->metricsCallback = $callback;
        error_log("✅ Callback de métricas configurado en ChatServer");
    }

    /**
     * 🔥 MÉTODO AUXILIAR: Ejecutar callback de métricas de forma segura
     */
    private function reportMetric(string $type, $data = null): void
    {
        if ($this->metricsCallback && is_callable($this->metricsCallback)) {
            try {
                call_user_func($this->metricsCallback, $type, $data);
            } catch (Exception $e) {
                error_log("❌ Error ejecutando callback de métricas: " . $e->getMessage());
            }
        }
    }

    /**
     * @param ConnectionInterface|\stdClass $conn
     */
    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        $conn->authenticated = false;
        $conn->userId = null;

        // Inicializar array de chats para esta conexión
        $this->connectionChats[$conn->resourceId] = [];

        error_log("🔌 Nueva conexión: {$conn->resourceId}");

        // 🔥 REPORTAR MÉTRICA: Conexión abierta
        $this->reportMetric('connection_opened', [
            'connection_id' => $conn->resourceId,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    }

    /**
     * @param ConnectionInterface|\stdClass $conn
     */
    public function onMessage(ConnectionInterface $conn, $msg)
    {
        error_log("📨 Mensaje WebSocket recibido de {$conn->resourceId}: $msg");
        try {
            $data = json_decode($msg, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->sendError($conn, 'JSON inválido');
                $this->reportMetric('error_occurred', [
                    'type' => 'json_decode_error',
                    'connection_id' => $conn->resourceId,
                    'message' => 'JSON inválido'
                ]);
                return;
            }

            if (!isset($data['type'])) {
                $this->sendError($conn, 'Tipo de mensaje no especificado');
                $this->reportMetric('error_occurred', [
                    'type' => 'missing_message_type',
                    'connection_id' => $conn->resourceId
                ]);
                return;
            }

            switch ($data['type']) {
                case 'auth':
                    error_log("🔐 Iniciando proceso de autenticación para conexión {$conn->resourceId}");
                    $this->handleAuthentication($conn, $data);
                    break;

                case 'subscribe':
                    $this->handleSubscription($conn, $data);
                    break;

                case 'unsubscribe':
                    $this->handleUnsubscription($conn, $data);
                    break;

                case 'ping':
                    $conn->send(json_encode(['type' => 'pong', 'timestamp' => date('Y-m-d H:i:s')]));
                    break;

                case 'get_chat_updates':
                    $this->handleChatUpdates($conn, $data);
                    break;

                default:
                    $this->sendError($conn, 'Tipo de mensaje no reconocido: ' . $data['type']);
                    $this->reportMetric('error_occurred', [
                        'type' => 'unknown_message_type',
                        'connection_id' => $conn->resourceId,
                        'message_type' => $data['type']
                    ]);
            }

            // 🔥 REPORTAR MÉTRICA: Mensaje procesado exitosamente
            $this->reportMetric('message_processed', [
                'connection_id' => $conn->resourceId,
                'message_type' => $data['type'],
                'user_id' => $conn->userId ?? null
            ]);

        } catch (Exception $e) {
            error_log("❌ Error en onMessage: " . $e->getMessage());
            $this->sendError($conn, 'Error procesando mensaje');

            // 🔥 REPORTAR MÉTRICA: Error en procesamiento de mensaje
            $this->reportMetric('error_occurred', [
                'type' => 'message_processing_error',
                'connection_id' => $conn->resourceId,
                'error' => $e->getMessage(),
                'user_id' => $conn->userId ?? null
            ]);
        }
    }

    /**
     * @param ConnectionInterface|\stdClass $conn
     */
    public function onClose(ConnectionInterface $conn)
    {
        // Limpiar suscripciones de chat primero
        if (isset($this->connectionChats[$conn->resourceId])) {
            foreach ($this->connectionChats[$conn->resourceId] as $chatUuid) {
                $this->unsubscribeFromChat($conn, $chatUuid);
            }
        }

        // Eliminar la asociación de usuario si existe
    if (isset($conn->userId)) {
        $userId = $conn->userId;
        if (isset($this->userConnections[$userId])) {
            // Filtrar las conexiones para remover solo la actual
            $this->userConnections[$userId] = array_filter(
                $this->userConnections[$userId],
                function($c) use ($conn) {
                    return $c->resourceId !== $conn->resourceId;
                }
            );
            
            // Si no quedan conexiones, limpiar la entrada
            if (empty($this->userConnections[$userId])) {
                unset($this->userConnections[$userId]);
            }
        }
        unset($this->connectionUsers[$conn->resourceId]);
        error_log("👋 Conexión {$conn->resourceId} del usuario {$userId} cerrada");
    } else {
            error_log("👋 Conexión no autenticada {$conn->resourceId} desconectada.");
        }

        // Limpiar el almacenamiento de chats de la conexión
        unset($this->connectionChats[$conn->resourceId]);

        $this->clients->detach($conn);

        // 🔥 REPORTAR MÉTRICA: Conexión cerrada
        $this->reportMetric('connection_closed', [
            'connection_id' => $conn->resourceId,
            'user_id' => $conn->userId ?? null,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    }

    /**
     * @param ConnectionInterface|\stdClass $conn
     */
    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        error_log("❌ Error en conexión {$conn->resourceId}: {$e->getMessage()}");

        // 🔥 REPORTAR MÉTRICA: Error de conexión
        $this->reportMetric('error_occurred', [
            'type' => 'connection_error',
            'connection_id' => $conn->resourceId,
            'user_id' => $conn->userId ?? null,
            'error' => $e->getMessage()
        ]);

        $conn->close();
    }

    /**
     * Procesar mensajes Redis del ChatController
     */
    public function processRedisMessage(array $redisData)
    {
        error_log("📨 Mensaje Redis recibido: " . json_encode($redisData));

        // Validar estructura del mensaje
        if (!$this->validateRedisMessage($redisData)) {
            error_log("❌ Mensaje Redis con estructura inválida");
            return;
        }

        // Manejar notificaciones
        if ($redisData['type'] === 'new_notification') {
            $this->handleNewNotification($redisData);
            return;
        }

        // 🆕 Manejar nuevo chat
        if ($redisData['type'] === 'new_chat') {
            $this->handleNewChat($redisData);
            return;
        }

        $chatUuid = $redisData['chat_uuid'] ?? null;
        $messageData = $redisData['message'] ?? null;
        $senderId = $redisData['sender_id'] ?? null;
        $isReply = $redisData['is_reply'] ?? false;

        if (!$chatUuid || !$messageData) {
            error_log("❌ Mensaje Redis incompleto para tipo " . $redisData['type']);
            return;
        }

        // Construir mensaje completo
        $messageForClients = [
            'type' => 'new_message',
            'chat_uuid' => $chatUuid,
            'chat_type' => $redisData['chat_type'] ?? 'user_to_user',
            'chat_title' => $redisData['chat_title'] ?? 'Chat',
            'message' => $messageData,
            'sender_info' => [
                'id' => $senderId,
                'name' => $redisData['sender_name'] ?? 'Usuario',
                'uuid' => $redisData['sender_uuid'] ?? null
            ],
            'is_reply' => $isReply,
            'replying_to' => $isReply ? [
                'message_uuid' => $redisData['replying_to_uuid'] ?? null,
                'content' => $redisData['replied_content'] ?? 'Mensaje original',
                'author_name' => $redisData['replied_author_name'] ?? 'Usuario'
            ] : null,
            'timestamp' => $redisData['timestamp'] ?? date('Y-m-d H:i:s')
        ];

        // Enviar a todos los suscriptores del chat (incluyendo al remitente para que se renderice en su UI)
        $this->broadcastToChat($chatUuid, json_encode($messageForClients), null);

        // Notificaciones mejoradas
        $this->sendCorrectedPushNotifications($redisData, $senderId);

        // 🔥 REPORTAR MÉTRICA: Mensaje Redis procesado
        $this->reportMetric('redis_message_processed', [
            'chat_uuid' => $chatUuid,
            'sender_id' => $senderId,
            'message_type' => $redisData['type'] ?? 'unknown'
        ]);
    }

    /**
     * Manejar notificaciones en tiempo real
     */
    private function handleNewNotification(array $data)
    {
        if (!isset($data['notification'])) {
            error_log("❌ Notificación sin datos");
            return;
        }

        $notification = $data['notification'];
        $userId = $notification['user_id'] ?? null;

        if (!$userId) {
            error_log("❌ Notificación sin user_id");
            return;
        }

        // Enviar notificación solo al usuario destinatario
        $notificationMessage = [
            'type' => 'new_notification',
            'notification' => $notification,
            'timestamp' => $data['timestamp'] ?? date('Y-m-d H:i:s')
        ];

        if ($this->sendToUser($userId, json_encode($notificationMessage))) {
            error_log("🔔 Notificación enviada a usuario {$userId}: {$notification['title']}");
        } else {
            error_log("⚠️ Usuario {$userId} no conectado, notificación pendiente");
        }
    }

    /**
     * Validar estructura del mensaje Redis
     */
     private function validateRedisMessage(array $message): bool
         {
             if (!is_array($message)) return false;

             if (!isset($message['type'])) {
                 error_log("❌ ChatServer Validation Fail: Campo 'type' ausente.");
                 return false;
             }

             switch ($message['type']) {
                 case 'new_message':
                     $required = ['chat_uuid', 'message'];
                     foreach ($required as $field) {
                         if (!isset($message[$field])) {
                              error_log("❌ ChatServer Validation Fail: Falta '$field' en new_message.");
                             return false;
                         }
                     }

                     if (!is_array($message['message'])) {
                          error_log("❌ ChatServer Validation Fail: 'message' no es un array.");
                         return false;
                     }

                     // =====================================================
                     // ✅ LA CORRECCIÓN CLAVE ESTÁ AQUÍ
                     // =====================================================
                     // Campos requeridos dentro del objeto 'message'
                     $messageInternalRequired = ['uuid', 'content', 'user_id', 'created_at'];

                     foreach ($messageInternalRequired as $field) {
                         // Usamos array_key_exists() para permitir user_id = null (para la IA)
                         if (!array_key_exists($field, $message['message'])) {
                              error_log("❌ ChatServer Validation Fail: Falta '$field' en message.*");
                              // Loguear el mensaje problemático para depuración
                              error_log("Mensaje problemático: " . json_encode($message));
                             return false;
                         }
                     }
                     break;

                 case 'new_notification':
                     if (!isset($message['notification']) || !is_array($message['notification'])) {
                         error_log("❌ ChatServer Validation Fail: 'notification' ausente o no es array.");
                         return false;
                     }

                     // Usamos array_key_exists() aquí también por consistencia
                     if (!array_key_exists('user_id', $message['notification'])) {
                         error_log("❌ ChatServer Validation Fail: Falta 'user_id' en notification.*");
                         return false;
                     }
                     break;

                 case 'new_chat':
                     $required = ['chat_uuid', 'chat_type', 'participants'];
                     foreach ($required as $field) {
                         if (!isset($message[$field])) {
                             error_log("❌ ChatServer Validation Fail: Falta '$field' en new_chat.");
                             return false;
                         }
                     }
                     break;

                 default:
                     error_log("❌ ChatServer Validation Fail: Tipo desconocido '{$message['type']}'.");
                     return false;
             }

             // Si pasa todas las validaciones
             return true;
         }

    /**
     * Broadcast a todos los clientes suscritos al chat
     */
    private function broadcastToChat(string $chatUuid, string $message, ?int $excludeSenderId = null)
    {
        if (!isset($this->chatConnections[$chatUuid]) || empty($this->chatConnections[$chatUuid])) {
            error_log("⚠️  No hay clientes suscritos al chat: {$chatUuid}");
            return;
        }

        $sentCount = 0;
        $errorCount = 0;

        foreach ($this->chatConnections[$chatUuid] as $client) {
            // Excluir al remitente original para evitar duplicados
            if ($excludeSenderId !== null && isset($client->userId) && $client->userId === $excludeSenderId) {
                continue;
            }

            try {
                $client->send($message);
                $sentCount++;
                error_log("📤 Mensaje enviado a cliente {$client->resourceId} (usuario: {$client->userId})");
            } catch (Exception $e) {
                $errorCount++;
                error_log("❌ Error enviando a cliente {$client->resourceId}: {$e->getMessage()}");
                $this->removeClientFromChat($client, $chatUuid);
            }
        }

        error_log("✅ Mensaje enviado a {$sentCount} clientes en chat {$chatUuid}" . ($errorCount > 0 ? " ({$errorCount} errores)" : ""));
    }

    /**
     * Notificaciones push corregidas
     */
    private function sendCorrectedPushNotifications(array $messageData, ?int $senderId)
    {
        $chatUuid = $messageData['chat_uuid'];
        $senderName = $messageData['sender_name'] ?? 'Usuario';
        $messageContent = $messageData['message']['content'] ?? 'Nuevo mensaje';
        $chatTitle = $messageData['chat_title'] ?? 'Chat';
        $isReply = $messageData['is_reply'] ?? false;

        foreach ($this->userConnections as $userId => $connections) { // Iterar sobre el array de conexiones
            // No notificar al remitente
            if ($userId == $senderId) continue;

            // Verificar si alguna de las conexiones del usuario está suscrita al chat
            $isSubscribed = false;
            foreach ($connections as $conn) {
                if (isset($this->connectionChats[$conn->resourceId]) &&
                    in_array($chatUuid, $this->connectionChats[$conn->resourceId])) {
                    $isSubscribed = true;
                    break;
                }
            }

            // Enviar notificación push SOLO si el usuario NO está viendo el chat activamente
            if (!$isSubscribed) {
                $preview = substr($messageContent, 0, 100);
                if (strlen($messageContent) > 100) {
                    $preview .= '...';
                }

                $notification = [
                    'type' => 'chat_notification',
                    'notification' => [
                        'type' => $isReply ? 'reply_notification' : 'new_message_notification',
                        'chat_uuid' => $chatUuid,
                        'chat_title' => $chatTitle,
                        'sender_name' => $senderName,
                        'message_preview' => $preview,
                        'is_reply' => $isReply,
                        'timestamp' => date('Y-m-d H:i:s')
                    ]
                ];

                if ($this->sendToUser($userId, json_encode($notification))) {
                    error_log("🔔 Notificación push enviada a usuario {$userId}");
                }
            } else {
                error_log("👁️  Usuario {$userId} está viendo el chat, no se envía notificación push");
            }
        }
    }

    /**
     * Manejar autenticación JWT
     */
    private function handleAuthentication(ConnectionInterface $from, array $data)
    {
        if (!isset($data['token'])) {
            error_log("❌ Error auth: Token no proporcionado para conexión {$from->resourceId}");
            $this->sendError($from, 'Token no proporcionado');
            return;
        }

        error_log("🔑 Validando token para conexión {$from->resourceId}...");
        $userId = $this->validateJWT($data['token']);

        if ($userId) {
            $from->authenticated = true;
            $from->userId = $userId;

            // Almacenar la conexión en un array para el usuario
            if (!isset($this->userConnections[$userId])) {
                $this->userConnections[$userId] = [];
            }
            $this->userConnections[$userId][] = $from;
            $this->connectionUsers[$from->resourceId] = $userId;
            error_log("✅ Usuario {$userId} autenticado exitosamente en conexión {$from->resourceId}");

            // Suscribir a chats si se especifican
            if (isset($data['chats']) && is_array($data['chats'])) {
                error_log("📡 Suscribiendo automáticamente a " . count($data['chats']) . " chats");
                foreach ($data['chats'] as $chatUuid) {
                    $this->subscribeToChat($from, $chatUuid);
                }
            }

            $from->send(json_encode([
                'type' => 'auth_success',
                'user_id' => $userId,
                'timestamp' => date('Y-m-d H:i:s')
            ]));

            error_log("✅ Notificación auth_success enviada a usuario {$userId}");
        } else {
            error_log("❌ Error auth: Token JWT inválido para conexión {$from->resourceId}");
            $this->sendError($from, 'Token inválido');
            $from->close();
        }
    }

    /**
     * Manejar suscripción a chat
     */
    private function handleSubscription(ConnectionInterface $from, array $data)
    {
        if (!$from->authenticated) {
            error_log("❌ Error suscripción: Conexión {$from->resourceId} no autenticada");
            $this->sendError($from, 'Debe autenticarse primero');
            return;
        }

        if (!isset($data['chat_uuid'])) {
            $this->sendError($from, 'chat_uuid requerido');
            return;
        }

        $chatUuid = $data['chat_uuid'];
        error_log("📡 Verificando membresía para conexión {$from->resourceId} (Usuario: {$from->userId}) al chat: $chatUuid");

        if (!$this->isUserParticipant($from->userId, $chatUuid)) {
            error_log("❌ Acceso denegado: Usuario {$from->userId} NO es participante del chat $chatUuid");
            $this->sendError($from, 'No tienes permiso para acceder a este chat');
            return;
        }

        $this->subscribeToChat($from, $chatUuid);

        $from->send(json_encode([
            'type' => 'subscribe_success',
            'chat_uuid' => $chatUuid
        ]));

        error_log("✅ Usuario {$from->userId} suscrito a chat {$chatUuid}");
    }

    /**
     * Manejar desuscripción de chat
     */
    private function handleUnsubscription(ConnectionInterface $from, array $data)
    {
        if (!$from->authenticated) {
            $this->sendError($from, 'Debe autenticarse primero');
            return;
        }

        if (!isset($data['chat_uuid'])) {
            $this->sendError($from, 'chat_uuid requerido');
            return;
        }

        $chatUuid = $data['chat_uuid'];
        $this->unsubscribeFromChat($from, $chatUuid);

        $from->send(json_encode([
            'type' => 'unsubscribe_success',
            'chat_uuid' => $chatUuid
        ]));

        error_log("🔕 Usuario {$from->userId} desuscrito de chat {$chatUuid}");
    }

    /**
     * Suscribir conexión a chat
     */
    private function subscribeToChat(ConnectionInterface $conn, string $chatUuid)
    {
        if (!isset($this->chatConnections[$chatUuid])) {
            $this->chatConnections[$chatUuid] = [];
        }

        if (!in_array($conn, $this->chatConnections[$chatUuid])) {
            $this->chatConnections[$chatUuid][] = $conn;

            // Agregar chat a la lista de chats de la conexión
            if (!isset($this->connectionChats[$conn->resourceId])) {
                $this->connectionChats[$conn->resourceId] = [];
            }
            if (!in_array($chatUuid, $this->connectionChats[$conn->resourceId])) {
                $this->connectionChats[$conn->resourceId][] = $chatUuid;
            }
        }
    }

    /**
     * Desuscribir conexión de chat
     */
    private function unsubscribeFromChat(ConnectionInterface $conn, string $chatUuid)
    {
        $this->removeClientFromChat($conn, $chatUuid);
    }

    /**
     * Remover cliente de chat
     */
    private function removeClientFromChat(ConnectionInterface $conn, string $chatUuid)
    {
        if (isset($this->chatConnections[$chatUuid])) {
            $this->chatConnections[$chatUuid] = array_filter(
                $this->chatConnections[$chatUuid],
                function($client) use ($conn) {
                    return $client !== $conn;
                }
            );

            if (empty($this->chatConnections[$chatUuid])) {
                unset($this->chatConnections[$chatUuid]);
            }
        }

        if (isset($this->connectionChats[$conn->resourceId])) {
            $this->connectionChats[$conn->resourceId] = array_filter(
                $this->connectionChats[$conn->resourceId],
                function($chat) use ($chatUuid) {
                    return $chat !== $chatUuid;
                }
            );
            if (empty($this->connectionChats[$conn->resourceId])) {
                unset($this->connectionChats[$conn->resourceId]);
            }
        }
    }

    /**
     * 🆕 Manejar nuevo chat en tiempo real
     */
    private function handleNewChat(array $data)
    {
        $participants = $data['participants'] ?? [];
        $creatorId = $data['creator_id'] ?? null;

        $payload = [
            'type' => 'new_chat',
            'chat_uuid' => $data['chat_uuid'],
            'chat_type' => $data['chat_type'],
            'title' => $data['title'],
            'creator_name' => $data['creator_name'],
            'timestamp' => $data['created_at']
        ];

        error_log("📡 Difundiendo new_chat a " . count($participants) . " participantes");

        foreach ($participants as $userId) {
            // No enviar al creador si ya lo manejó el frontend?
            // En realidad es mejor enviarlo a todos para que el estado se sincronice en todas sus pestañas
            $this->sendToUser((int)$userId, json_encode($payload));
        }
    }

    /**
     * Envía un mensaje a todas las conexiones de un usuario específico
     */
    private function sendToUser(int $userId, string $message): bool
    {
        $sent = false;
        if (isset($this->userConnections[$userId])) {
            foreach ($this->userConnections[$userId] as $conn) {
                try {
                    $conn->send($message);
                    $sent = true;
                } catch (Exception $e) {
                    error_log("❌ Error enviando a usuario {$userId} (conexión {$conn->resourceId}): " . $e->getMessage());
                    // Considerar limpiar la conexión muerta aquí si es necesario
                }
            }
        }
        return $sent;
    }

    /**
     * Validar JWT y obtener user ID
     */
    private function validateJWT(string $token): ?int
    {
        try {
            $secretKey = ConfigService::get('JWT_SECRET_KEY') ?? '';
            if (!$secretKey) return null;

            $decoded = JWT::decode($token, new Key($secretKey, 'HS256'));
            return $decoded->data->id ?? null;

        } catch (Exception $e) {
            error_log("❌ Error JWT: " . $e->getMessage());
            return null;
        }
    }

    private function sendError(ConnectionInterface $conn, string $message)
    {
        $conn->send(json_encode([
            'type' => 'error',
            'message' => $message
        ]));
    }

    /**
     * Manejar solicitud de actualizaciones de chat
     */
    private function handleChatUpdates(ConnectionInterface $conn, array $data)
    {
        if (!$conn->authenticated) {
            $this->sendError($conn, 'No autenticado');
            return;
        }

        // Enviar estadísticas de conexión
        $stats = $this->getConnectionStats($conn);
        $conn->send(json_encode([
            'type' => 'chat_updates',
            'stats' => $stats,
            'timestamp' => date('Y-m-d H:i:s')
        ]));
    }

    /**
     * Obtener estadísticas de conexión
     */
    private function getConnectionStats(ConnectionInterface $conn): array
    {
        return [
            'user_id' => $conn->userId,
            'chats_subscribed' => $this->connectionChats[$conn->resourceId] ?? [],
            'total_chats' => count($this->chatConnections),
            'total_users' => count($this->userConnections)
        ];
    }

    /**
     * Limpiar conexiones huérfanas
     */
    public function cleanupOrphanedConnections(): int
    {
        $cleaned = 0;
        foreach ($this->clients as $client) {
            try {
                $client->send(json_encode(['type' => 'ping']));
            } catch (Exception $e) {
                $this->onClose($client);
                $cleaned++;
            }
        }
        return $cleaned;
    }

    /**
     * Método para debug
     */
    public function debugConnections()
    {
        error_log("=== DEBUG CONEXIONES ===");
        error_log("Total conexiones: " . count($this->connectionChats));
        foreach ($this->connectionChats as $connId => $chats) {
            $userId = $this->connectionUsers[$connId] ?? 'No autenticado';
            error_log("Conexión {$connId} (Usuario: {$userId}): " . implode(', ', $chats));
        }
        error_log("=== FIN DEBUG ===");
    }

    /**
     * 🔥 NUEVO MÉTODO: Enviar ping a conexiones (compatibilidad con websocket-server.php mejorado)
     */
    public function sendPingToConnections(): int
    {
        $activeCount = 0;
        foreach ($this->clients as $client) {
            try {
                $client->send(json_encode(['type' => 'ping']));
                $activeCount++;
            } catch (Exception $e) {
                // La conexión está muerta, se limpiará en el próximo cleanup
            }
        }
        return $activeCount;
    }

    /**
     * 🔥 NUEVO MÉTODO: Notificar clientes sobre shutdown (para graceful shutdown)
     */
    public function notifyClientsAboutShutdown(): int
    {
        $notifiedCount = 0;
        foreach ($this->clients as $client) {
            try {
                $client->send(json_encode([
                    'type' => 'server_shutdown',
                    'message' => 'El servidor se está cerrando para mantenimiento',
                    'timestamp' => date('Y-m-d H:i:s')
                ]));
                $notifiedCount++;
            } catch (Exception $e) {
                // Ignorar errores durante el shutdown
            }
        }
        return $notifiedCount;
    }

    /**
     * 🔥 NUEVO MÉTODO: Asegura que la conexión a la base de datos esté activa
     */
    private function ensureDbConnection(): ?\PDO
    {
        if (!$this->dbFactory) return null;

        try {
            // Intentar una consulta simple para ver si la conexión sigue viva
            if ($this->pdo) {
                $this->pdo->query("SELECT 1");
            } else {
                $this->pdo = $this->dbFactory->getConnection();
            }
        } catch (\PDOException $e) {
            error_log("🔄 Detectada conexión de BD perdida, intentando reconectar...");
            try {
                $this->dbFactory->resetConnection();
                $this->pdo = $this->dbFactory->getConnection();
                error_log("✅ Reconexión a BD exitosa");
            } catch (\Exception $reconnectError) {
                error_log("❌ Fallo crítico en reconexión a BD: " . $reconnectError->getMessage());
                $this->pdo = null;
            }
        }

        return $this->pdo;
    }

    /**
     * Verificar si un usuario es participante de un chat - SEGURIDAD CRÍTICA
     */
    private function isUserParticipant(int $userId, string $chatUuid): bool
    {
        $pdo = $this->ensureDbConnection();
        
        if (!$pdo) {
            error_log("⚠️ ChatServer: No hay conexión a base de datos para validar membresía. Permitiendo por defecto (Riesgo).");
            return true;
        }

        try {
            // Verificar si el chat existe y el usuario es participante
            $query = "SELECT 1 FROM chat_participants cp
                     JOIN chats c ON cp.chat_id = c.id
                     WHERE cp.user_id = :user_id AND c.uuid = :chat_uuid";

            $stmt = $pdo->prepare($query);
            $stmt->execute(['user_id' => $userId, 'chat_uuid' => $chatUuid]);

            return (bool)$stmt->fetch();

        } catch (Exception $e) {
            error_log("❌ Error validando membresía en ChatServer: " . $e->getMessage());
            
            // Si el error es específicamente de conexión perdida, intentamos reconectar una vez más
            if (strpos($e->getMessage(), 'gone away') !== false || strpos($e->getMessage(), 'Lost connection') !== false) {
                error_log("🔄 Error de conexión detectado en consulta, reintentando...");
                $pdo = $this->ensureDbConnection();
                if ($pdo) {
                    try {
                        $stmt = $pdo->prepare($query);
                        $stmt->execute(['user_id' => $userId, 'chat_uuid' => $chatUuid]);
                        return (bool)$stmt->fetch();
                    } catch (Exception $retryError) {
                        error_log("❌ Fallo en reintento de consulta: " . $retryError->getMessage());
                    }
                }
            }
            
            // En caso de error de BD persistente, por seguridad denegamos el acceso
            return false;
        }
    }
}
