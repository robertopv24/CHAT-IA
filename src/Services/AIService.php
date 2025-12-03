<?php

namespace Foxia\Services;

use PDO;
use Exception;
use Foxia\Services\ConfigService;
use Foxia\Config\Database;

class AIService
{
    private $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Registra un nodo de IA en la base de datos
     */
    public function registerNode(string $url): bool
    {
        try {
            $this->pruneDeadNodes();
            $sql = "INSERT INTO ai_nodes (node_url, is_active, last_health_check)
                    VALUES (:url, 1, NOW())
                    ON DUPLICATE KEY UPDATE
                    is_active = 1, last_health_check = NOW()";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':url', $url, PDO::PARAM_STR);
            return $stmt->execute();
        } catch (Exception $e) {
            error_log("Error registrando nodo de IA: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Limpia los nodos que ya no responden
     */
    private function pruneDeadNodes(): void
    {
        try {
            $sql = "SELECT id, node_url FROM ai_nodes WHERE is_active = 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $activeNodes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($activeNodes as $node) {
                if (!$this->checkNodeHealth($node['node_url'])) {
                    $this->deactivateNode($node['id']);
                }
            }
        } catch (Exception $e) {
            error_log("Error en pruneDeadNodes: " . $e->getMessage());
        }
    }

    /**
     * Verifica la salud de un nodo específico (endpoint /health)
     */
    private function checkNodeHealth(string $nodeUrl): bool
    {
        $healthUrl = rtrim($nodeUrl, '/') . '/health';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $healthUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 2,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $httpCode === 200;
    }

    /**
     * Desactiva un nodo en la base de datos
     */
    private function deactivateNode(int $nodeId): bool
    {
        try {
            $sql = "UPDATE ai_nodes SET is_active = 0 WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':id', $nodeId, PDO::PARAM_INT);
            return $stmt->execute();
        } catch (Exception $e) {
            error_log("Error desactivando nodo: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtiene la URL de un nodo activo
     */
    public function getActiveAINodeUrl(): ?string
    {
        try {
            $sql = "SELECT node_url FROM ai_nodes
                    WHERE is_active = 1
                    ORDER BY last_health_check DESC
                    LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? $result['node_url'] : null;
        } catch (Exception $e) {
            error_log("Error obteniendo nodo activo: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Genera una respuesta usando el servicio de IA.
     * AHORA ACEPTA HISTORIAL Y DEVUELVE UN ARRAY [content, tokens]
     *
     * @param array $chatHistory Historial de mensajes (formato OpenAI)
     * @return array|null ['content' => ..., 'tokens' => ...] o null si falla
     */
    public function generateResponse(array $chatHistory): ?array
    {
        try {
            $nodeUrl = $this->getActiveAINodeUrl();
            if (!$nodeUrl) {
                return [
                    'content' => "Lo siento, el servicio de IA no está disponible en este momento (No hay nodos activos).",
                    'tokens' => 0
                ];
            }

            $apiKey = ConfigService::get('ai_service_api_key');
            if (!$apiKey) {
                return [
                    'content' => "Lo siento, el servicio de IA no está configurado correctamente (sin API key).",
                    'tokens' => 0
                ];
            }

            // =====================================================
            // INICIO DE CAMBIOS
            // =====================================================

            // 1. Usar el endpoint /v1/chat/completions
            $generateUrl = rtrim($nodeUrl, '/') . '/v1/chat/completions';

            // 2. Construir el payload completo (usando 'mensajes' como en tu ejemplo)
            $payload = json_encode([
                'mensajes' => $chatHistory,
                'stream' => false,
                'max_tokens' => (int)ConfigService::get('ai_max_new_tokens', 3000),
                'temperature' => (float)ConfigService::get('ai_temperature', 0.7),
                'top_p' => (float)ConfigService::get('ai_top_p', 0.9)
            ]);

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $generateUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_TIMEOUT => 600,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'x-api-key: ' . $apiKey,
                    'Content-Length: ' . strlen($payload)
                ],
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($httpCode !== 200) {
                throw new Exception("Error en la respuesta del nodo: HTTP $httpCode - $error - $response");
            }

            $responseData = json_decode($response, true);

            // 3. Extraer contenido, parsearlo y extraer tokens
            $rawContent = $responseData['choices'][0]['message']['content'] ?? null;
            $totalTokens = $responseData['usage']['total_tokens'] ?? 0;

            if (!$rawContent) {
                return [
                    'content' => "Lo siento, la IA no pudo generar una respuesta.",
                    'tokens' => 0
                ];
            }

            // 4. Devolver un array con los datos parseados
            return [
                'content' => $this->parseAIContent($rawContent),
                'tokens' => (int)$totalTokens
            ];

            // =====================================================
            // FIN DE CAMBIOS
            // =====================================================

        } catch (Exception $e) {
            error_log("Error generando respuesta de IA: " . $e->getMessage());
            return [
                'content' => "Lo siento, ocurrió un error interno al contactar a la IA.",
                'tokens' => 0
            ];
        }
    }

    /**
     * NUEVO MÉTODO: Limpia las etiquetas <think> de la respuesta.
     */
    private function parseAIContent(string $rawContent): string
    {
        // Busca la etiqueta de cierre </think>
        $parts = preg_split('/<\/think>/i', $rawContent, 2);

        if (count($parts) === 2) {
            // Si la encuentra, devuelve la segunda parte (lo que está después)
            return trim($parts[1]);
        }

        // Si no hay etiqueta, devuelve el contenido original
        return trim($rawContent);
    }

    /**
     * (Este método ya no se usa para el endpoint de chat, pero se puede
     * mantener para un futuro RAG o prompts del sistema)
     */
    private function buildPrompt(string $userMessage): string {
        return "Eres Foxia, un asistente de IA conversacional y servicial... \n\nUsuario: $userMessage\nFoxia:";
    }
}
