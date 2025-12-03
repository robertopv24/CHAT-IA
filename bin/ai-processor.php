#!/usr/bin/php
<?php
// bin/ai-processor.php
// Este script es llamado por ChatController para procesar la IA en segundo plano.

// 1. Cargar el entorno y el autoloader
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../src/Config/env.php';
\Foxia\Config\loadEnv();

// Declaración de Clases a utilizar
use Foxia\Config\Database;
use Foxia\Services\AIService;
use Foxia\Services\ConfigService;
use Predis\Client as RedisClient;
// No es necesario 'use PDO;' ya que es una clase global

/**
 * Clase principal del procesador de IA.
 * Contiene toda la lógica para manejar un solo trabajo de IA.
 */
class AIProcessor
{
    private $db;
    private $redis;
    private $aiService;

    // Argumentos de entrada
    private $chatId;
    private $messageId;

    public function __construct()
    {
        // 1. Parsear argumentos de la línea de comandos (ej. --chat_id=123)
        $args = getopt(null, ["chat_id::", "message_id::"]);
        $this->chatId = $args['chat_id'] ?? null;
        $this->messageId = $args['message_id'] ?? null;

        if (!$this->chatId || !$this->messageId) {
            error_log("❌ AI-Processor: Faltan --chat_id o --message_id. Script llamado incorrectamente.");
            echo "Error: Faltan argumentos --chat_id o --message_id.\n";
            exit(1); // Salir si no hay argumentos
        }

        // 2. Inicializar servicios
        $this->db = (new Database())->getConnection();
        $this->redis = new RedisClient(['host' => ConfigService::get('REDIS_HOST') ?? '127.0.0.1']);
        $this->aiService = new AIService();
    }

    /**
     * Función principal que ejecuta el trabajo de IA.
     */
    public function run()
    {
        echo "============================================\n";
        echo "Iniciando AI Processor - " . date('Y-m-d H:i:s') . "\n";
        echo "Procesando Job: ChatID={$this->chatId}, MessageID={$this->messageId}\n";

        try {
            // 3. Obtener el historial del chat
            $history = $this->getChatHistory($this->chatId);
            if (empty($history)) {
                throw new Exception("El historial para el chat {$this->chatId} está vacío.");
            }

            // 4. Llamar a la IA (Esta es la parte LENTA)
            error_log("🤖 AI-Processor: [Chat {$this->chatId}] Llamando a la IA...");
            $aiResponse = $this->aiService->generateResponse($history); // $aiResponse es un array

            if (!$aiResponse || empty($aiResponse['content'])) {
                throw new Exception("La IA no devolvió contenido válido.");
            }

            // 5. Guardar la respuesta y publicarla
            $this->saveAndPublishResponse($this->chatId, $aiResponse);
            error_log("✅ AI-Processor: [Chat {$this->chatId}] Respuesta procesada y publicada.");
            echo "✅ Job (ChatID {$this->chatId}) completado.\n";
            exit(0);

        } catch (Exception $e) {
            error_log("❌ AI-Processor: [Chat {$this->chatId}] Falló: " . $e->getMessage());
            echo "❌ Job (ChatID {$this->chatId}) falló: " . $e->getMessage() . "\n";
            exit(1);
        }
    }

    /**
     * Obtiene el historial reciente de un chat para la IA
     */
    private function getChatHistory(int $chatId, int $limit = 10): array
    {
        $query = "SELECT user_id, content FROM messages
                  WHERE chat_id = :chat_id AND deleted = FALSE AND message_type = 'text'
                  ORDER BY created_at DESC LIMIT :limit";
        $stmt = $this->db->prepare($query);
        $stmt->execute([':chat_id' => $chatId, ':limit' => $limit]);
        $messages = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));

        $history = [];
        foreach ($messages as $msg) {
            $history[] = [
                'rol' => $msg['user_id'] ? 'user' : 'assistant',
                'contenido' => $msg['content']
            ];
        }
        return $history;
    }

    /**
     * Guarda la respuesta de la IA en la BD y la publica en Redis.
     */
    private function saveAndPublishResponse(int $chatId, array $aiResponse)
    {
        $chatStmt = $this->db->prepare("SELECT uuid, title, chat_type FROM chats WHERE id = ?");
        $chatStmt->execute([$chatId]);
        $chat = $chatStmt->fetch(PDO::FETCH_ASSOC);
        if (!$chat) throw new Exception("Chat no encontrado para job $job[id]");

        $aiMessageUuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $aiModelName = ConfigService::get('ai_model_id', 'deepseek-r1');
        $aiResponseContent = $aiResponse['content'];
        $aiTokensUsed = $aiResponse['tokens'];

        // 1. Guardar respuesta de IA en BD
        $insertAiQuery = "INSERT INTO messages (uuid, chat_id, user_id, content, message_type, ai_model, tokens_used)
                          VALUES (:uuid, :chat_id, NULL, :content, 'text', :model, :tokens)";
        $stmtAi = $this->db->prepare($insertAiQuery);
        $stmtAi->execute([
            ':uuid' => $aiMessageUuid,
            ':chat_id' => $chatId,
            ':content' => $aiResponseContent,
            ':model' => $aiModelName,
            ':tokens' => $aiTokensUsed
        ]);

        // 2. Actualizar Chat
        $updateChatTx = $this->db->prepare("UPDATE chats SET last_message_at = NOW() WHERE id = ?");
        $updateChatTx->execute([$chatId]);

        // 3. Publicar respuesta de IA en Redis
        $redisAiPayload = [
            'type' => 'new_message',
            'chat_uuid' => $chat['uuid'],
            'chat_title' => $chat['title'],
            'chat_type' => $chat['chat_type'],
            'message' => [
                'uuid' => $aiMessageUuid,
                'user_id' => null,
                'content' => $aiResponseContent,
                'message_type' => 'text',
                'ai_model' => $aiModelName,
                'created_at' => date('Y-m-d H:i:s'),
                'user_name' => 'Fox-IA',
                'user_uuid' => null
            ],
            'sender_id' => null,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        $this->redis->publish('canal-chat', json_encode($redisAiPayload));
    }
}

// Iniciar el procesador
try {
    $worker = new AIProcessor();
    $worker->run();
} catch (Exception $e) {
    error_log("FATAL: AI Processor falló al inicializar: " . $e->getMessage());
    exit(1);
}
