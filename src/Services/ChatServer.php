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
    private $metricsCallback; // 🔥 NUEVA PROPIEDAD PARA EL CALLBACK DE MÉTRICAS

    public function __construct()
    {
        $this->clients = new SplObjectStorage;
        $this->userConnections = [];
        $this->chatConnections = [];
        $this->connectionUsers = [];
        $this->connectionChats = [];
        $this->metricsCallback = null; // 🔥 INICIALIZAR EL CALLBACK COMO NULL
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

    public function onMessage(ConnectionInterface $from, $msg)
    {
        try {
            $data = json_decode($msg, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->sendError($from, 'JSON inválido');
                $this->reportMetric('error_occurred', [
                    'type' => 'json_decode_error',
                    'connection_id' => $from->resourceId,
                    'message' => 'JSON inválido'
                ]);
                return;
            }

            if (!isset($data['type'])) {
                $this->sendError($from, 'Tipo de mensaje no especificado');
                $this->reportMetric('error_occurred', [
                    'type' => 'missing_message_type',
                    'connection_id' => $from->resourceId
                ]);
                return;
            }

            switch ($data['type']) {
                case 'auth':
                    $this->handleAuthentication($from, $data);
                    break;

                case 'subscribe':
                    $this->handleSubscription($from, $data);
                    break;

                case 'unsubscribe':
                    $this->handleUnsubscription($from, $data);
                    break;

                case 'ping':
                    $from->send(json_encode(['type' => 'pong', 'timestamp' => date('Y-m-d H:i:s')]));
                    break;

                case 'get_chat_updates':
                    $this->handleChatUpdates($from, $data);
                    break;

                default:
                    $this->sendError($from, 'Tipo de mensaje no reconocido: ' . $data['type']);
                    $this->reportMetric('error_occurred', [
                        'type' => 'unknown_message_type',
                        'connection_id' => $from->resourceId,
                        'message_type' => $data['type']
                    ]);
            }

            // 🔥 REPORTAR MÉTRICA: Mensaje procesado exitosamente
            $this->reportMetric('message_processed', [
                'connection_id' => $from->resourceId,
                'message_type' => $data['type'],
                'user_id' => $from->userId ?? null
            ]);

        } catch (Exception $e) {
            error_log("❌ Error en onMessage: " . $e->getMessage());
            $this->sendError($from, 'Error procesando mensaje');

            // 🔥 REPORTAR MÉTRICA: Error en procesamiento de mensaje
            $this->reportMetric('error_occurred', [
                'type' => 'message_processing_error',
                'connection_id' => $from->resourceId,
                'error' => $e->getMessage(),
                'user_id' => $from->userId ?? null
            ]);
        }
    }

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
            unset($this->userConnections[$userId]);
            unset($this->connectionUsers[$conn->resourceId]);
            error_log("👋 Usuario {$userId} desconectado");
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

    public function onError(ConnectionInterface $conn, Exception $e)
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

        $chatUuid = $redisData['chat_uuid'];
        $messageData = $redisData['message'];
        $senderId = $redisData['sender_id'] ?? null;
        $isReply = $redisData['is_reply'] ?? false;

        // Manejar notificaciones
        if ($redisData['type'] === 'new_notification') {
            $this->handleNewNotification($redisData);
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

        // Enviar a todos los suscriptores del chat
        $this->broadcastToChat($chatUuid, json_encode($messageForClients), $senderId);

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

        foreach ($this->userConnections as $userId => $connection) {
            // No notificar al remitente
            if ($userId == $senderId) continue;

            // Verificar si está suscrito al chat
            $isSubscribed = isset($this->connectionChats[$connection->resourceId]) &&
                           in_array($chatUuid, $this->connectionChats[$connection->resourceId]);

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
    private function handleAuthentication(ConnectionInterface $conn, array $data)
    {
        if (!isset($data['token'])) {
            $this->sendError($conn, 'Token no proporcionado');
            return;
        }

        $userId = $this->validateJWT($data['token']);

        if ($userId) {
            $conn->authenticated = true;
            $conn->userId = $userId;

            $this->userConnections[$userId] = $conn;
            $this->connectionUsers[$conn->resourceId] = $userId;

            // Suscribir a chats si se especifican
            if (isset($data['chats']) && is_array($data['chats'])) {
                foreach ($data['chats'] as $chatUuid) {
                    $this->subscribeToChat($conn, $chatUuid);
                }
            }

            $conn->send(json_encode([
                'type' => 'auth_success',
                'user_id' => $userId,
                'timestamp' => date('Y-m-d H:i:s')
            ]));

            error_log("✅ Usuario {$userId} autenticado");
        } else {
            $this->sendError($conn, 'Token inválido');
            $conn->close();
        }
    }

    /**
     * Manejar suscripción a chat
     */
    private function handleSubscription(ConnectionInterface $conn, array $data)
    {
        if (!$conn->authenticated) {
            $this->sendError($conn, 'Debe autenticarse primero');
            return;
        }

        if (!isset($data['chat_uuid'])) {
            $this->sendError($conn, 'chat_uuid requerido');
            return;
        }

        $chatUuid = $data['chat_uuid'];
        $this->subscribeToChat($conn, $chatUuid);

        $conn->send(json_encode([
            'type' => 'subscribe_success',
            'chat_uuid' => $chatUuid
        ]));

        error_log("✅ Usuario {$conn->userId} suscrito a chat {$chatUuid}");
    }

    /**
     * Manejar desuscripción de chat
     */
    private function handleUnsubscription(ConnectionInterface $conn, array $data)
    {
        if (!$conn->authenticated) {
            $this->sendError($conn, 'Debe autenticarse primero');
            return;
        }

        if (!isset($data['chat_uuid'])) {
            $this->sendError($conn, 'chat_uuid requerido');
            return;
        }

        $chatUuid = $data['chat_uuid'];
        $this->unsubscribeFromChat($conn, $chatUuid);

        $conn->send(json_encode([
            'type' => 'unsubscribe_success',
            'chat_uuid' => $chatUuid
        ]));

        error_log("🔕 Usuario {$conn->userId} desuscrito de chat {$chatUuid}");
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
        }
    }

    /**
     * Enviar mensaje a usuario específico
     */
    private function sendToUser(int $userId, string $message)
    {
        if (isset($this->userConnections[$userId])) {
            try {
                $this->userConnections[$userId]->send($message);
                return true;
            } catch (Exception $e) {
                unset($this->userConnections[$userId]);
            }
        }
        return false;
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
}
