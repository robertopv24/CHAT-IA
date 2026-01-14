<?php
// src/Controllers/ChatController.php - VERSIÓN COMPLETAMENTE CORREGIDA

namespace Foxia\Controllers;

use Foxia\Config\Database;
use Foxia\Services\FileUploadService;
use Foxia\Services\AIService;
use Foxia\Services\ConfigService;
use PDO;
use PDOException;
use Exception;
use Predis\Client as RedisClient;

class ChatController
{
    private $db;
    private $redis;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();

        // Inicializar cliente Redis para publicación en tiempo real
        try {
            $this->redis = new RedisClient([
                'scheme' => 'tcp',
                'host'   => ConfigService::get('REDIS_HOST') ?? '127.0.0.1',
                'port'   => ConfigService::get('REDIS_PORT') ?? 6379,
                'password' => ConfigService::get('REDIS_PASSWORD') ?? null,
                'database' => ConfigService::get('REDIS_DB') ?? 0,
                // Timeout corto para no bloquear la subida
                'timeout' => 1.0, 
            ]);
        } catch (Exception $e) {
            error_log("⚠️ Error inicializando Redis: " . $e->getMessage());
            $this->redis = null;
        }
    }

    /**
     * Crea un nuevo chat (AI o usuario a usuario)
     */
    public function createChat()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = $GLOBALS['input_json'] ?? [];

        if (!isset($input['chat_type'])) {
            http_response_code(400);
            echo json_encode(['error' => 'El campo chat_type es requerido']);
            return;
        }

        $chatType = strip_tags($input['chat_type']);
    $participantUuids = $input['participant_uuids'] ?? [];
    $title = isset($input['title']) ? htmlspecialchars($input['title'], ENT_QUOTES, 'UTF-8') : null;

    if (!in_array($chatType, ['ai', 'user_to_user', 'group'])) {
        http_response_code(400);
        echo json_encode(['error' => 'chat_type debe ser "ai", "user_to_user" o "group"']);
        return;
    }

    if ($chatType === 'group' && empty($title)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los chats grupales requieren un título']);
        return;
    }

    if (in_array($chatType, ['user_to_user', 'group']) && empty($participantUuids)) {
        http_response_code(400);
        echo json_encode(['error' => "Se requieren participant_uuids para chats $chatType"]);
        return;
    }

        try {
            $this->db->beginTransaction();

            $chatUuid = null;
            $chatId = null;
            $isGroup = ($chatType === 'group' || ($chatType === 'user_to_user' && count($participantUuids) > 1));

            // 1. DEDUPLICACIÓN PARA AI e INDIVIDUALES
            if ($chatType === 'ai') {
                $checkAiQuery = "SELECT uuid, id FROM chats WHERE chat_type = 'ai' AND created_by = :user_id LIMIT 1";
                $stmt = $this->db->prepare($checkAiQuery);
                $stmt->execute([':user_id' => $currentUserId]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $this->db->rollBack();
                    echo json_encode(['message' => 'Chat IA existente', 'chat_uuid' => $existing['uuid'], 'chat_id' => $existing['id'], 'chat_type' => 'ai', 'is_group' => false, 'created' => false]);
                    return;
                }
            } elseif ($chatType === 'user_to_user' && count($participantUuids) === 1) {
                // Si es individual, redirigir a lógica findOrCreate (o similar)
                $participantId = $this->getUserIdByUuid($participantUuids[0]);
                if ($participantId) {
                    $findChatQuery = "SELECT c.uuid, c.id FROM chats c 
                                    JOIN chat_participants cp1 ON c.id = cp1.chat_id 
                                    JOIN chat_participants cp2 ON c.id = cp2.chat_id 
                                    WHERE c.chat_type = 'user_to_user' AND c.is_group = FALSE 
                                    AND cp1.user_id = :u1 AND cp2.user_id = :u2 LIMIT 1";
                    $stmt = $this->db->prepare($findChatQuery);
                    $stmt->execute([':u1' => $currentUserId, ':u2' => $participantId]);
                    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($existing) {
                        $this->db->rollBack();
                        echo json_encode(['message' => 'Chat existente encontrado', 'chat_uuid' => $existing['uuid'], 'chat_id' => $existing['id'], 'chat_type' => 'user_to_user', 'is_group' => false, 'created' => false]);
                        return;
                    }
                }
            }

            // 2. CREACIÓN DEL CHAT
            $chatUuid = $this->generateUuid();
            $insertChatQuery = "INSERT INTO chats (uuid, chat_type, title, created_by, is_group) 
                               VALUES (:uuid, :chat_type, :title, :created_by, :is_group)";
            $stmt = $this->db->prepare($insertChatQuery);
            $stmt->execute([
                ':uuid' => $chatUuid,
                ':chat_type' => $chatType,
                ':title' => $title,
                ':created_by' => $currentUserId,
                ':is_group' => $isGroup
            ]);
            $chatId = $this->db->lastInsertId();

            // 3. AGREGAR PARTICIPANTES
            $this->addParticipant($chatId, $currentUserId, true);
            $participantIds = [$currentUserId];

            if ($chatType !== 'ai') {
                foreach ($participantUuids as $pUuid) {
                    $pId = $this->getUserIdByUuid($pUuid);
                    if ($pId) {
                        $this->addParticipant($chatId, $pId);
                        $participantIds[] = (int)$pId;
                    }
                }
            }

            $this->db->commit();

            // 4. NOTIFICACIÓN EN TIEMPO REAL (REDIS)
            $this->publishNewChatEvent($chatUuid, $chatType, $title, $participantIds);

            http_response_code(201);
            echo json_encode([
                'message' => 'Chat creado exitosamente',
                'chat_uuid' => $chatUuid,
                'chat_id' => $chatId,
                'chat_type' => $chatType,
                'is_group' => $isGroup,
                'created' => true
            ]);

        } catch (PDOException $e) {

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Busca un chat existente entre dos usuarios o crea uno nuevo
     */
    public function findOrCreateChat()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = $GLOBALS['input_json'] ?? [];

        if (!isset($input['participant_uuid'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere el UUID del participante']);
            return;
        }

        $participantUuid = strip_tags($input['participant_uuid']);
        $participantId = $this->getUserIdByUuid($participantUuid);

        if (!$participantId) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario contacto no encontrado']);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Buscar chat existente 1 a 1
            $findChatQuery = "SELECT c.uuid, c.id, c.title
                            FROM chats c
                            JOIN chat_participants cp1 ON c.id = cp1.chat_id
                            JOIN chat_participants cp2 ON c.id = cp2.chat_id
                            WHERE c.chat_type = 'user_to_user'
                            AND c.is_group = FALSE
                            AND cp1.user_id = :current_user_id
                            AND cp2.user_id = :participant_id";

            $stmt = $this->db->prepare($findChatQuery);
            $stmt->execute([':current_user_id' => $currentUserId, ':participant_id' => $participantId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existingChat) {
            $this->db->commit();
            
            // NOTIFICACIÓN EN TIEMPO REAL (REDIS) - Por si acaso
            $this->publishNewChatEvent($existingChat['uuid'], 'user_to_user', $existingChat['title'], [$currentUserId, $participantId]);

            http_response_code(200);
            echo json_encode([
                'message' => 'Chat existente encontrado',
                'chat_uuid' => $existingChat['uuid'],
                'chat_id' => $existingChat['id'],
                'chat_title' => $existingChat['title'],
                'created' => false
            ]);
            return;
        }

        // Crear nuevo chat si no existe
        $stmt = $this->db->prepare("SELECT name FROM users WHERE id = :participant_id");
        $stmt->execute([':participant_id' => $participantId]);
        $participantUser = $stmt->fetch(PDO::FETCH_ASSOC);

        $chatTitle = "Chat con " . $participantUser['name'];
        $chatUuid = $this->generateUuid();

        $insertChatQuery = "INSERT INTO chats (uuid, chat_type, title, created_by, is_group) 
                        VALUES (:uuid, 'user_to_user', :title, :created_by, FALSE)";
        $stmt = $this->db->prepare($insertChatQuery);
        $stmt->execute([
            ':uuid' => $chatUuid,
            ':title' => $chatTitle,
            ':created_by' => $currentUserId
        ]);
        $chatId = $this->db->lastInsertId();

        $this->addParticipant($chatId, $currentUserId, true);
        $this->addParticipant($chatId, $participantId, false);

        $this->db->commit();

        // NOTIFICACIÓN EN TIEMPO REAL (REDIS)
        $this->publishNewChatEvent($chatUuid, 'user_to_user', $chatTitle, [$currentUserId, $participantId]);

        http_response_code(201);
        echo json_encode([
            'message' => 'Chat creado exitosamente',
            'chat_uuid' => $chatUuid,
            'chat_id' => $chatId,
            'chat_title' => $chatTitle,
            'created' => true
        ]);

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * Renombra un chat
     */
    public function renameChat()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = $GLOBALS['input_json'] ?? [];

        if (!isset($input['chat_uuid'], $input['new_title'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere chat_uuid y new_title']);
            return;
        }

        $chatUuid = strip_tags($input['chat_uuid']);
        $newTitle = htmlspecialchars(trim($input['new_title']), ENT_QUOTES, 'UTF-8');

        if (empty($newTitle)) {
            http_response_code(400);
            echo json_encode(['error' => 'El título no puede estar vacío']);
            return;
        }

        try {
            // CORRECCIÓN: Verificar permisos primero
            $checkQuery = "SELECT c.id FROM chats c
                          JOIN chat_participants cp ON c.id = cp.chat_id
                          WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";
            $stmt = $this->db->prepare($checkQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permisos para renombrar este chat']);
                return;
            }

            $query = "UPDATE chats SET title = :new_title, updated_at = NOW()
                      WHERE uuid = :chat_uuid";
            $stmt = $this->db->prepare($query);
            $stmt->execute([
                ':new_title' => $newTitle,
                ':chat_uuid' => $chatUuid
            ]);

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode([
                    'message' => 'Chat renombrado correctamente',
                    'new_title' => $newTitle
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Chat no encontrado']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * Elimina un chat
     */
    public function deleteChat()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = $GLOBALS['input_json'] ?? [];

        if (!isset($input['chat_uuid'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere chat_uuid']);
            return;
        }

        $chatUuid = strip_tags($input['chat_uuid']);

        try {
            $this->db->beginTransaction();

            // CORRECCIÓN: Verificar que el usuario es participante del chat
            $checkQuery = "SELECT c.id, c.created_by FROM chats c
                          JOIN chat_participants cp ON c.id = cp.chat_id
                          WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";
            $stmt = $this->db->prepare($checkQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                $this->db->rollBack();
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permisos para eliminar este chat']);
                return;
            }

            // Solo el creador puede eliminar el chat completamente
            if ($chat['created_by'] == $currentUserId) {
                $query = "DELETE FROM chats WHERE uuid = :chat_uuid";
                $stmt = $this->db->prepare($query);
                $stmt->execute([':chat_uuid' => $chatUuid]);

                if ($stmt->rowCount() > 0) {
                    $chatId = $chat['id'];
                    FileUploadService::deleteChatFiles($chatId);
                    $this->db->commit();
                    http_response_code(200);
                    echo json_encode(['message' => 'Chat eliminado correctamente']);
                } else {
                    $this->db->rollBack();
                    http_response_code(404);
                    echo json_encode(['error' => 'Chat no encontrado']);
                }
            } else {
                // Para otros participantes, solo los removemos del chat
                $query = "DELETE FROM chat_participants
                         WHERE chat_id = :chat_id AND user_id = :user_id";
                $stmt = $this->db->prepare($query);
                $stmt->execute([':chat_id' => $chat['id'], ':user_id' => $currentUserId]);

                $this->db->commit();
                http_response_code(200);
                echo json_encode(['message' => 'Has abandonado el chat correctamente']);
            }

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * Sube un archivo al chat
     */
    public function uploadFile()
    {
        error_log("🚀 [ChatController] Iniciando uploadFile");
        
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            error_log("❌ [ChatController] Usuario no autenticado");
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        // 🔓 Liberar sesión PHP para evitar bloqueos durante subidas largas
        // Permite que el WebSocket reconecte mientras el archivo se procesa
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        if (empty($_FILES) || !isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No se proporcionó un archivo válido']);
            return;
        }

        $chatUuid = $_POST['chat_uuid'] ?? null;
        $replyingToUuid = $_POST['replying_to_uuid'] ?? null;

        if (!$chatUuid) {
            http_response_code(400);
            echo json_encode(['error' => 'El campo chat_uuid es requerido']);
            return;
        }

        $file = $_FILES['file'];

        try {
            $this->db->beginTransaction();

            $checkChatQuery = "SELECT c.id, c.chat_type, c.title, c.uuid as chat_uuid
                            FROM chats c
                            INNER JOIN chat_participants cp ON c.id = cp.chat_id
                            WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";

            $stmt = $this->db->prepare($checkChatQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                $this->db->rollBack();
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permisos en este chat']);
                return;
            }

            $chatId = $chat['id'];
            $chatTitle = $chat['title'];
            $actualChatUuid = $chat['chat_uuid'];
            $chatType = $chat['chat_type'];

            if (!is_uploaded_file($file['tmp_name'])) {
                throw new Exception('Archivo no válido');
            }

            $messageType = $this->determineMessageType($file['type']);

            try {
                $fileInfo = FileUploadService::uploadChatFile($file, $currentUserId, $chatId);
            } catch (Exception $e) {
                throw new Exception('Error al subir archivo: ' . $e->getMessage());
            }

            $content = json_encode([
                'file_url' => $fileInfo['file_path'],
                'original_name' => $fileInfo['original_name'],
                'file_size' => $fileInfo['file_size'],
                'mime_type' => $fileInfo['mime_type'],
                'upload_token' => $fileInfo['upload_token']
            ]);

            $replyingToId = null;
            $replyingToMessage = null;

            if ($replyingToUuid) {
                $stmt = $this->db->prepare("SELECT id, content, user_id FROM messages WHERE uuid = :replying_to_uuid");
                $stmt->execute([':replying_to_uuid' => $replyingToUuid]);
                $replyingToMessage = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($replyingToMessage) $replyingToId = $replyingToMessage['id'];
            }

            $messageUuid = $this->generateUuid();
            $insertMessageQuery = "INSERT INTO messages (uuid, chat_id, user_id, content, message_type, replying_to_id)
                                VALUES (:uuid, :chat_id, :user_id, :content, :message_type, :replying_to_id)";

            $stmt = $this->db->prepare($insertMessageQuery);
            $stmt->execute([
                ':uuid' => $messageUuid,
                ':chat_id' => $chatId,
                ':user_id' => $currentUserId,
                ':content' => $content,
                ':message_type' => $messageType,
                ':replying_to_id' => $replyingToId
            ]);

            $messageId = $this->db->lastInsertId();

            $updateChatQuery = "UPDATE chats SET last_message_at = NOW(), updated_at = NOW() WHERE id = :chat_id";
            $stmt = $this->db->prepare($updateChatQuery);
            $stmt->execute([':chat_id' => $chatId]);

            $messageQuery = "SELECT m.uuid, m.chat_id, m.user_id, m.content, m.message_type, m.ai_model, m.created_at,
                                u.name as user_name, u.uuid as user_uuid, c.uuid as chat_uuid, c.title as chat_title, c.chat_type,
                                rm.uuid as replied_uuid, rm.content as replied_content, ru.name as replied_author_name
                            FROM messages m
                            JOIN users u ON m.user_id = u.id
                            JOIN chats c ON m.chat_id = c.id
                            LEFT JOIN messages rm ON m.replying_to_id = rm.id
                            LEFT JOIN users ru ON rm.user_id = ru.id
                            WHERE m.id = :message_id";

            $stmt = $this->db->prepare($messageQuery);
            $stmt->execute([':message_id' => $messageId]);
            $fullMessage = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$fullMessage) {
                throw new Exception("No se pudo obtener el mensaje completo");
            }

            $fileContent = json_decode($fullMessage['content'], true);
            $redisPayload = [
                'type' => 'new_message',
                'chat_uuid' => $fullMessage['chat_uuid'],
                'chat_title' => $fullMessage['chat_title'],
                'chat_type' => $fullMessage['chat_type'],
                'message' => [
                    'uuid' => $fullMessage['uuid'],
                    'user_id' => $fullMessage['user_id'],
                    'content' => $fileContent,
                    'message_type' => $fullMessage['message_type'],
                    'ai_model' => $fullMessage['ai_model'],
                    'created_at' => $fullMessage['created_at'],
                    'user_name' => $fullMessage['user_name'],
                    'user_uuid' => $fullMessage['user_uuid']
                ],
                'sender_id' => $currentUserId,
                'sender_name' => $GLOBALS['current_user']->name,
                'sender_uuid' => $GLOBALS['current_user']->uuid,
                'timestamp' => date('Y-m-d H:i:s'),
                'is_reply' => !empty($replyingToId),
                'replying_to_uuid' => $replyingToUuid,
                'replied_content' => $fullMessage['replied_content'] ?? null,
                'replied_author_name' => $fullMessage['replied_author_name'] ?? null,
                'file_info' => $fileContent
            ];

            // 🛡️ Redis protegido: Publicar solo si está disponible y capturar errores
            if ($this->redis) {
                try {
                    $this->redis->publish('canal-chat', json_encode($redisPayload));
                } catch (Exception $e) {
                    error_log("⚠️ Error publicando en Redis (uploadFile): " . $e->getMessage());
                }
            }

            $notificationContent = $this->getFileNotificationContent($messageType, $fileInfo['original_name']);
            $this->createEnhancedNotifications($chatId, $currentUserId, $notificationContent, $chatTitle, !empty($replyingToId), $replyingToMessage);

            $this->db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Archivo enviado exitosamente',
                'message_uuid' => $messageUuid,
                'message_id' => $messageId,
                'file_info' => $fileInfo,
                'message_type' => $messageType,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("❌ [ChatController] PDOException: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        } catch (\Throwable $e) {
            $this->db->rollBack();
            error_log("❌ [ChatController] Throwable/Exception: " . $e->getMessage());
            error_log("❌ [ChatController] Trace: " . $e->getTraceAsString());
            http_response_code(500); 
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Envía un mensaje de texto (integrado con IA)
     */
    public function sendMessage()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $replyingToMessage = null;
        $currentUserId = $GLOBALS['current_user']->id;

        $input = $GLOBALS['input_json'] ?? [];

        if (!isset($input['chat_uuid']) || !isset($input['content']) || empty(trim($input['content']))) {
            http_response_code(400);
            echo json_encode(['error' => 'chat_uuid y content son requeridos']);
            return;
        }

        $chatUuid = strip_tags($input['chat_uuid']);
        $content = trim($input['content']);
        $messageType = $input['message_type'] ?? 'text';
        $replyingToUuid = $input['replying_to_uuid'] ?? null;
        $replyingToId = null;

        try {
            $this->db->beginTransaction();

            $checkChatQuery = "SELECT c.id, c.chat_type, c.title, c.uuid as chat_uuid
                             FROM chats c
                             INNER JOIN chat_participants cp ON c.id = cp.chat_id
                             WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";

            $stmt = $this->db->prepare($checkChatQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                $this->db->rollBack();
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permisos para enviar mensajes en este chat']);
                return;
            }

            // --- VALIDACIÓN DE BLOQUEO DE CONTACTOS ---
            if ($chat['chat_type'] === 'user_to_user') {
                $stmt = $this->db->prepare("
                    SELECT cp.user_id
                    FROM chat_participants cp
                    WHERE cp.chat_id = :chat_id AND cp.user_id != :sender_id
                ");
                $stmt->execute([':chat_id' => $chat['id'], ':sender_id' => $currentUserId]);
                $otherParticipant = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($otherParticipant) {
                    $otherId = $otherParticipant['user_id'];
                    $stmt = $this->db->prepare("
                        SELECT 1 FROM user_contacts
                        WHERE user_id = :recipient_id AND contact_id = :sender_id AND is_blocked = 1
                    ");
                    $stmt->execute([':recipient_id' => $otherId, ':sender_id' => $currentUserId]);
                    if ($stmt->fetch()) {
                        http_response_code(403);
                        echo json_encode(['error' => 'No puedes enviar mensajes a este usuario porque te ha bloqueado']);
                        return;
                    }
                }
            }

            $chatId = $chat['id'];
            $chatType = $chat['chat_type'];
            $chatTitle = $chat['title'];
            $actualChatUuid = $chat['chat_uuid'];

            if ($replyingToUuid) {
                $stmt = $this->db->prepare("SELECT id, content, user_id FROM messages WHERE uuid = :replying_to_uuid");
                $stmt->execute([':replying_to_uuid' => $replyingToUuid]);
                $replyingToMessage = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($replyingToMessage) $replyingToId = $replyingToMessage['id'];
            }

            // Insertar mensaje del usuario
            $messageUuid = $this->generateUuid();
            $insertMessageQuery = "INSERT INTO messages (uuid, chat_id, user_id, content, message_type, replying_to_id)
                                 VALUES (:uuid, :chat_id, :user_id, :content, :message_type, :replying_to_id)";

            $stmt = $this->db->prepare($insertMessageQuery);
            $stmt->execute([
                ':uuid' => $messageUuid,
                ':chat_id' => $chatId,
                ':user_id' => $currentUserId,
                ':content' => $content,
                ':message_type' => $messageType,
                ':replying_to_id' => $replyingToId
            ]);

            $messageId = $this->db->lastInsertId();

            $updateChatQuery = "UPDATE chats SET last_message_at = NOW(), updated_at = NOW() WHERE id = :chat_id";
            $stmt = $this->db->prepare($updateChatQuery);
            $stmt->execute([':chat_id' => $chatId]);

            // Obtener el mensaje completo para Redis
            $messageQuery = "SELECT m.uuid, m.chat_id, m.user_id, m.content, m.message_type, m.ai_model, m.created_at,
                                u.name as user_name, u.uuid as user_uuid, c.uuid as chat_uuid, c.title as chat_title, c.chat_type,
                                rm.uuid as replied_uuid, rm.content as replied_content, ru.name as replied_author_name
                            FROM messages m
                            JOIN users u ON m.user_id = u.id
                            JOIN chats c ON m.chat_id = c.id
                            LEFT JOIN messages rm ON m.replying_to_id = rm.id
                            LEFT JOIN users ru ON rm.user_id = ru.id
                            WHERE m.id = :message_id";

            $stmt = $this->db->prepare($messageQuery);
            $stmt->execute([':message_id' => $messageId]);
            $fullMessage = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($fullMessage) {
                // Publicar mensaje del usuario en Redis inmediatamente
                $redisPayload = [
                    'type' => 'new_message',
                    'chat_uuid' => $fullMessage['chat_uuid'],
                    'chat_title' => $fullMessage['chat_title'],
                    'chat_type' => $fullMessage['chat_type'],
                    'message' => [
                        'uuid' => $fullMessage['uuid'],
                        'user_id' => $fullMessage['user_id'],
                        'content' => $fullMessage['content'],
                        'message_type' => $fullMessage['message_type'],
                        'ai_model' => $fullMessage['ai_model'],
                        'created_at' => $fullMessage['created_at'],
                        'user_name' => $fullMessage['user_name'],
                        'user_uuid' => $fullMessage['user_uuid']
                    ],
                    'sender_id' => $currentUserId,
                    'sender_name' => $GLOBALS['current_user']->name,
                    'sender_uuid' => $GLOBALS['current_user']->uuid,
                    'timestamp' => date('Y-m-d H:i:s'),
                    'is_reply' => !empty($replyingToId),
                    'replying_to_uuid' => $replyingToUuid,
                    'replied_content' => $fullMessage['replied_content'] ?? null,
                    'replied_author_name' => $fullMessage['replied_author_name'] ?? null
                ];

                // 🛡️ Redis protegido: Publicar solo si está disponible y capturar errores
                if ($this->redis) {
                    try {
                        $this->redis->publish('canal-chat', json_encode($redisPayload));
                    } catch (Exception $e) {
                        error_log("⚠️ Error publicando en Redis (sendMessage): " . $e->getMessage());
                    }
                }
            }

            // Crear notificaciones para otros usuarios
            $this->createEnhancedNotifications($chatId, $currentUserId, $content, $chatTitle, !empty($replyingToId), $replyingToMessage);

            // =====================================================
            // 🤖 INTEGRACIÓN ASÍNCRONA CON IA
            // =====================================================
            if ($chatType === 'ai') {
                $launcherScriptPath = __DIR__ . '/../../bin/launch-ai-job.sh';
                $debugLog = '/tmp/ai_launcher.log';
                $args = "--chat_id=$chatId --message_id=$messageId";
                $command = "bash $launcherScriptPath $args";
                shell_exec("$command >> $debugLog 2>&1 &");
                error_log("✅ AI-DEBUG: Comando SH disparado: " . $command);
            }

            $this->db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Mensaje enviado exitosamente',
                'message_uuid' => $messageUuid,
                'message_id' => $messageId,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Obtiene la lista de chats del usuario
     */
    public function getChats()
    {
        header('Content-Type: application/json');

        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        try {
            $queryChats = "SELECT
                            c.id,
                            c.uuid,
                            c.chat_type,
                            c.is_group,
                            c.title,
                            c.created_at,
                            c.last_message_at,
                            (SELECT content FROM messages WHERE chat_id = c.id AND deleted = 0 ORDER BY created_at DESC LIMIT 1) as last_message_content,
                            (SELECT COUNT(*) FROM notifications n WHERE n.related_chat_id = c.id AND n.user_id = :user_id_notif AND n.is_read = FALSE) as unread_count
                        FROM chats c
                        JOIN chat_participants cp ON c.id = cp.chat_id
                        WHERE cp.user_id = :user_id_cp
                        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC";

            $stmtChats = $this->db->prepare($queryChats);
            $stmtChats->execute([
                ':user_id_notif' => $currentUserId,
                ':user_id_cp' => $currentUserId
            ]);
            $chats = $stmtChats->fetchAll(PDO::FETCH_ASSOC);

            if (empty($chats)) {
                http_response_code(200);
                echo json_encode(['message' => 'No hay chats', 'chats' => []]);
                return;
            }

            $chatIds = array_column($chats, 'id');
            $placeholders = implode(',', array_fill(0, count($chatIds), '?'));

            $queryParticipants = "SELECT
                                    cp.chat_id,
                                    u.id as user_id,
                                    u.name,
                                    u.avatar_url,
                                    u.uuid as user_uuid
                                FROM chat_participants cp
                                JOIN users u ON cp.user_id = u.id
                                WHERE cp.chat_id IN ($placeholders) AND cp.user_id != ?";

            $stmtParticipants = $this->db->prepare($queryParticipants);
            $params = array_merge($chatIds, [$currentUserId]);
            $stmtParticipants->execute($params);
            $participantsData = $stmtParticipants->fetchAll(PDO::FETCH_ASSOC);

            $participantsByChat = [];
            foreach ($participantsData as $participant) {
                $chatId = $participant['chat_id'];
                if (!isset($participantsByChat[$chatId])) {
                    $participantsByChat[$chatId] = [];
                }
                $participantsByChat[$chatId][] = [
                    'user_id' => $participant['user_id'],
                    'name' => $participant['name'],
                    'avatar_url' => $participant['avatar_url'],
                    'user_uuid' => $participant['user_uuid']
                ];
            }

            foreach ($chats as &$chat) {
                $chatId = $chat['id'];
                if ($chat['chat_type'] === 'ai') {
                    $chat['title'] = 'Asistente Fox-IA';
                    $chat['avatar_url'] = '/public/assets/images/ai-avatar.png';
                    $chat['participants'] = [];
                } elseif (!$chat['is_group'] && $chat['chat_type'] === 'user_to_user') {
                    if (isset($participantsByChat[$chatId]) && !empty($participantsByChat[$chatId])) {
                        $otherParticipant = $participantsByChat[$chatId][0];
                        $chat['title'] = $otherParticipant['name'];
                        $chat['avatar_url'] = $otherParticipant['avatar_url'];
                        $chat['participants'] = $participantsByChat[$chatId];
                    } else {
                        $chat['title'] = 'Chat sin participantes';
                        $chat['avatar_url'] = '/public/assets/images/default-avatar.png';
                        $chat['participants'] = [];
                    }
                } else {
                    $chat['participants'] = $participantsByChat[$chatId] ?? [];
                    if (empty($chat['avatar_url'])) {
                        $chat['avatar_url'] = '/public/assets/images/group-avatar.png';
                    }
                }
                $chat['avatar_url'] = $chat['avatar_url'] ?? '/public/assets/images/default-avatar.png';
                $chat['participants'] = $chat['participants'] ?? [];

                // Procesar último mensaje para archivos
                if (!empty($chat['last_message_content'])) {
                    try {
                        $lastMessageData = json_decode($chat['last_message_content'], true);
                        if (json_last_error() === JSON_ERROR_NONE && isset($lastMessageData['original_name'])) {
                            $chat['last_message_content'] = $lastMessageData['original_name'];
                        }
                    } catch (Exception $e) {
                        // Mantener el contenido original si hay error
                    }
                }
            }

            http_response_code(200);
            echo json_encode(['message' => 'Chats obtenidos exitosamente', 'chats' => $chats]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    /**
     * Obtiene los mensajes de un chat específico
     */
    public function getMessages()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $chatUuid = $_GET['chat_uuid'] ?? null;
        $limit = $_GET['limit'] ?? 50;
        $offset = $_GET['offset'] ?? 0;

        if (!$chatUuid) {
            http_response_code(400);
            echo json_encode(['error' => 'El parámetro chat_uuid es requerido']);
            return;
        }

        try {
            $checkAccessQuery = "SELECT c.id FROM chats c
                                INNER JOIN chat_participants cp ON c.id = cp.chat_id
                                WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";

            $stmt = $this->db->prepare($checkAccessQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes acceso a este chat']);
                return;
            }

            $chatId = $chat['id'];

            // Marcar notificaciones del chat como leídas
            $updateReadQuery = "UPDATE notifications SET is_read = TRUE
                               WHERE related_chat_id = :chat_id AND user_id = :user_id AND is_read = FALSE";
            $stmt = $this->db->prepare($updateReadQuery);
            $stmt->execute([':chat_id' => $chatId, ':user_id' => $currentUserId]);

            $getMessagesQuery = "SELECT
                                    m.uuid,
                                    m.user_id,
                                    m.content,
                                    m.message_type,
                                    m.ai_model,
                                    m.created_at,
                                    m.updated_at,
                                    m.deleted,
                                    u.name as user_name,
                                    u.avatar_url,
                                    u.uuid as user_uuid,
                                    replied_msg.uuid as replied_uuid,
                                    replied_msg.content as replied_content,
                                    replied_msg.deleted as replied_deleted,
                                    replied_user.name as replied_author_name
                                FROM messages m
                                LEFT JOIN users u ON m.user_id = u.id
                                LEFT JOIN messages replied_msg ON m.replying_to_id = replied_msg.id
                                LEFT JOIN users replied_user ON replied_msg.user_id = replied_user.id
                                WHERE m.chat_id = :chat_id AND m.deleted = FALSE
                                ORDER BY m.created_at DESC
                                LIMIT :limit OFFSET :offset";

            $stmt = $this->db->prepare($getMessagesQuery);
            $stmt->bindParam(':chat_id', $chatId, PDO::PARAM_INT);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Revertir para tener el orden cronológico correcto
            $messages = array_reverse($messages);

            $processedMessages = array_map(function($message) {
                if (in_array($message['message_type'], ['image', 'file']) && !empty($message['content'])) {
                    try {
                        $fileData = json_decode($message['content'], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $message['file_data'] = $fileData;
                            $message['content'] = $fileData['original_name'] ?? 'Archivo';
                        }
                    } catch (Exception $e) {
                        error_log("Error parseando contenido de archivo: " . $e->getMessage());
                    }
                }
                return $message;
            }, $messages);

            http_response_code(200);
            echo json_encode([
                'message' => 'Mensajes obtenidos exitosamente',
                'messages' => $processedMessages,
                'count' => count($processedMessages),
                'chat_id' => $chatId
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]);
        }
    }

    /**
     * Busca mensajes dentro de un chat
     */
    public function searchMessages()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $chatUuid = $_GET['chat_uuid'] ?? null;
        $term = $_GET['term'] ?? '';

        if (!$chatUuid) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere el parámetro chat_uuid']);
            return;
        }

        $term = trim($term);
        if (strlen($term) < 2) {
            http_response_code(400);
            echo json_encode(['error' => 'El término de búsqueda debe tener al menos 2 caracteres']);
            return;
        }

        try {
            $checkAccessQuery = "SELECT c.id FROM chats c
                               INNER JOIN chat_participants cp ON c.id = cp.chat_id
                               WHERE c.uuid = :chat_uuid AND cp.user_id = :user_id";
            $stmt = $this->db->prepare($checkAccessQuery);
            $stmt->execute([':chat_uuid' => $chatUuid, ':user_id' => $currentUserId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes acceso a este chat']);
                return;
            }

            $chatId = $chat['id'];
            $searchQuery = "SELECT m.uuid, m.content, m.message_type, m.created_at, u.name as user_name, u.uuid as user_uuid
                       FROM messages m
                       LEFT JOIN users u ON m.user_id = u.id
                       WHERE m.chat_id = :chat_id AND m.deleted = FALSE
                       AND (m.content LIKE :search_term OR (m.message_type IN ('file', 'image') AND m.content LIKE :search_term_file))
                       ORDER BY m.created_at DESC";

            $stmt = $this->db->prepare($searchQuery);
            $searchTerm = '%' . $term . '%';
            $searchTermFile = '%"original_name":"%' . $term . '%"%';
            $stmt->execute([':chat_id' => $chatId, ':search_term' => $searchTerm, ':search_term_file' => $searchTermFile]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $processedMessages = array_map(function($message) {
                if (in_array($message['message_type'], ['image', 'file']) && !empty($message['content'])) {
                    try {
                        $fileData = json_decode($message['content'], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $message['file_data'] = $fileData;
                        }
                    } catch (Exception $e) {
                        error_log("Error parseando contenido de archivo en búsqueda: " . $e->getMessage());
                    }
                }
                return $message;
            }, $messages);

            http_response_code(200);
            echo json_encode([
                'message' => 'Búsqueda completada',
                'messages' => $processedMessages,
                'count' => count($processedMessages)
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error inesperado: ' . $e->getMessage()]);
        }
    }

    /**
     * Elimina un mensaje (Soft Delete)
     */
    public function deleteMessage()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = $GLOBALS['input_json'] ?? [];
        $messageUuid = $input['message_uuid'] ?? null;

        if (!$messageUuid) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere message_uuid']);
            return;
        }

        try {
            $messageQuery = "SELECT m.id, m.message_type, m.content, m.chat_id, c.uuid as chat_uuid
                           FROM messages m
                           JOIN chats c ON m.chat_id = c.id
                           WHERE m.uuid = :message_uuid AND m.user_id = :user_id";
            $stmt = $this->db->prepare($messageQuery);
            $stmt->execute([':message_uuid' => $messageUuid, ':user_id' => $currentUserId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$message) {
                http_response_code(404);
                echo json_encode(['error' => 'Mensaje no encontrado o no tienes permisos']);
                return;
            }

            if (in_array($message['message_type'], ['image', 'file']) && !empty($message['content'])) {
                try {
                    $fileData = json_decode($message['content'], true);
                    if (isset($fileData['file_url'])) {
                        FileUploadService::deleteChatFile($fileData['file_url']);
                    }
                } catch (Exception $e) {
                    error_log("Error eliminando archivo físico: " . $e->getMessage());
                }
            }

            $query = "UPDATE messages SET deleted = TRUE, updated_at = NOW()
                      WHERE uuid = :message_uuid AND user_id = :user_id";
            $stmt = $this->db->prepare($query);
            $stmt->execute([':message_uuid' => $messageUuid, ':user_id' => $currentUserId]);

            // Publicar evento de eliminación en Redis
            $redisPayload = [
                'type' => 'message_deleted',
                'chat_uuid' => $message['chat_uuid'],
                'message_uuid' => $messageUuid,
                'timestamp' => date('Y-m-d H:i:s')
            ];
            $this->redis->publish('canal-chat', json_encode($redisPayload));

            http_response_code(200);
            echo json_encode(['message' => 'Mensaje eliminado correctamente']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    // =====================================================
    // MÉTODOS PRIVADOS AUXILIARES
    // =====================================================

    /**
     * Obtiene el historial reciente de un chat para la IA
     */
    private function getChatHistory(int $chatId, int $limit = 10): array
    {
        try {
            $query = "SELECT user_id, content, ai_model FROM messages
                      WHERE chat_id = :chat_id
                      AND deleted = FALSE
                      AND message_type = 'text'
                      ORDER BY created_at DESC
                      LIMIT :limit";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':chat_id', $chatId, PDO::PARAM_INT);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();

            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $messages = array_reverse($messages);

            $history = [];
            foreach ($messages as $msg) {
                $role = $msg['user_id'] ? 'user' : 'assistant';
                $history[] = [
                    'rol' => $role,
                    'contenido' => $msg['content']
                ];
            }
            return $history;

        } catch (Exception $e) {
            error_log("Error obteniendo historial de chat: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Publica un evento de nuevo chat en Redis
     */
    private function publishNewChatEvent($chatUuid, $chatType, $title, $participantIds)
    {
        try {
            if (!$this->redis) return;

            $event = [
                'type' => 'new_chat',
                'chat_uuid' => $chatUuid,
                'chat_type' => $chatType,
                'title' => $title,
                'participants' => $participantIds,
                'created_at' => date('Y-m-d H:i:s'),
                'creator_id' => $GLOBALS['current_user']->id,
                'creator_name' => $GLOBALS['current_user']->name
            ];

            $this->redis->publish('canal-chat', json_encode($event));
            error_log("📡 Evento new_chat publicado en Redis para chat: $chatUuid");

        } catch (Exception $e) {
            error_log("❌ Error publicando evento new_chat en Redis: " . $e->getMessage());
        }
    }

    private function generateUuid(): string
    {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    private function getUserIdByUuid(string $uuid): ?int
    {
        $query = "SELECT id FROM users WHERE uuid = :uuid AND is_active = TRUE";
        $stmt = $this->db->prepare($query);
        $stmt->execute([':uuid' => $uuid]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['id'] : null;
    }

    private function getChatIdByUuid(string $uuid): ?int
    {
        $query = "SELECT id FROM chats WHERE uuid = :uuid";
        $stmt = $this->db->prepare($query);
        $stmt->execute([':uuid' => $uuid]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['id'] : null;
    }

    private function addParticipant(int $chatId, int $userId, bool $isAdmin = false): void
    {
        $query = "INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES (:chat_id, :user_id, :is_admin)";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':chat_id', $chatId, PDO::PARAM_INT);
        $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':is_admin', $isAdmin, PDO::PARAM_BOOL);
        $stmt->execute();
    }

    private function createEnhancedNotifications(int $chatId, int $senderId, string $messageContent, string $chatTitle, bool $isReply = false, $replyingToMessage = null)
    {
        $queryRecipients = "SELECT user_id FROM chat_participants WHERE chat_id = :chat_id AND user_id != :sender_id";
        $stmt = $this->db->prepare($queryRecipients);
        $stmt->execute([':chat_id' => $chatId, ':sender_id' => $senderId]);
        $recipients = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($recipients)) return;

        $chatQuery = "SELECT uuid FROM chats WHERE id = :chat_id";
        $stmt = $this->db->prepare($chatQuery);
        $stmt->execute([':chat_id' => $chatId]);
        $chat = $stmt->fetch(PDO::FETCH_ASSOC);
        $chatUuid = $chat['uuid'] ?? 'unknown';

        $senderQuery = "SELECT name FROM users WHERE id = :sender_id";
        $stmt = $this->db->prepare($senderQuery);
        $stmt->execute([':sender_id' => $senderId]);
        $sender = $stmt->fetch(PDO::FETCH_ASSOC);
        $senderName = $sender['name'] ?? 'Usuario';

        $notificationType = 'new_message';
        if ($isReply && $replyingToMessage) {
            $notificationType = ($replyingToMessage['user_id'] == $senderId) ? 'self_reply' : 'reply';
        }

        $notificationTitle = $this->getNotificationTitle($notificationType, $senderName, $chatTitle);
        $notificationContent = substr($messageContent, 0, 100) . (strlen($messageContent) > 100 ? '...' : '');

        $queryInsert = "INSERT INTO notifications (user_id, type, title, content, related_chat_id, is_read, created_at)
                        VALUES (:user_id, :type, :title, :content, :chat_id, FALSE, NOW())";
        $stmtInsert = $this->db->prepare($queryInsert);

        foreach ($recipients as $recipient) {
            try {
                $stmtInsert->execute([
                    ':user_id' => $recipient['user_id'],
                    ':type' => $notificationType,
                    ':title' => $notificationTitle,
                    ':content' => $notificationContent,
                    ':chat_id' => $chatId
                ]);
                $notificationId = $this->db->lastInsertId();
                $this->publishNotificationToRedis($recipient['user_id'], $notificationId, $notificationType,
                                                $notificationTitle, $notificationContent, $chatUuid, $chatTitle);
            } catch (Exception $e) {
                error_log("❌ Error creando notificación: " . $e->getMessage());
            }
        }
    }

    private function getNotificationTitle(string $type, string $senderName, string $chatTitle): string
    {
        switch ($type) {
            case 'reply': return "📨 {$senderName} respondió en {$chatTitle}";
            case 'self_reply': return "↩️ {$senderName} respondió a su mensaje en {$chatTitle}";
            default: return "💬 {$senderName} en {$chatTitle}";
        }
    }

    private function publishNotificationToRedis(int $userId, int $notificationId, string $type, string $title, string $content, string $chatUuid, string $chatTitle)
    {
        try {
            $this->redis->publish('canal-chat', json_encode([
                'type' => 'new_notification',
                'notification' => [
                    'id' => $notificationId, 'user_id' => $userId, 'type' => $type, 'title' => $title,
                    'content' => $content, 'chat_uuid' => $chatUuid, 'chat_title' => $chatTitle,
                    'is_read' => false, 'created_at' => date('Y-m-d H:i:s')
                ],
                'timestamp' => date('Y-m-d H:i:s')
            ]));
        } catch (Exception $e) {
            error_log("❌ Error publicando notificación en Redis: " . $e->getMessage());
        }
    }

    private function determineMessageType(string $mimeType): string
    {
        return strpos($mimeType, 'image/') === 0 ? 'image' : 'file';
    }

    private function getFileNotificationContent(string $messageType, string $fileName): string
    {
        return ($messageType === 'image') ? "🖼️ Imagen: {$fileName}" : "📎 Archivo: {$fileName}";
    }
}
