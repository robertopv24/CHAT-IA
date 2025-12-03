<?php
// src/Controllers/AIController.php

namespace Foxia\Controllers;

use Foxia\Services\ConfigService;
use Foxia\Services\AIService; // Importar el nuevo servicio
use Exception;

class AIController
{
    /**
     * Entrega la configuración necesaria para que un nodo de IA se inicie.
     */
    public function getConfig()
    {
        header('Content-Type: application/json');
        try {
            $config = [
                "ngrok_token" => ConfigService::get('ngrok_authtoken'),
                "model_id" => ConfigService::get('ai_model_id'),
                "temperature" => (float)ConfigService::get('ai_temperature', 0.2),
                "top_p" => (float)ConfigService::get('ai_top_p', 0.9),
                "max_new_tokens" => (int)ConfigService::get('ai_max_new_tokens', 1024),
                // La clave API que el nodo Python debe usar para autenticarse
                "api_key" => ConfigService::get('ai_service_api_key', 'foxia-default-key')
            ];
            echo json_encode($config);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    /**
     * Registra un nodo de IA y limpia los nodos muertos.
     */
     public function registerNode()
     {
         header('Content-Type: application/json');
         $input = json_decode(file_get_contents('php://input'), true);
         $nodeUrl = $input['node_url'] ?? null;

         if (empty($nodeUrl) || !filter_var($nodeUrl, FILTER_VALIDATE_URL)) {
             http_response_code(400);
             echo json_encode(['error' => 'URL de nodo no proporcionada o no válida']);
             return;
         }

         try {
             $aiService = new AIService();
             if ($aiService->registerNode($nodeUrl)) {
                 http_response_code(200);
                 echo json_encode(['message' => 'Nodo de IA registrado/actualizado y nodos inactivos limpiados.']);
             } else {
                 http_response_code(500);
                 echo json_encode(['error' => 'Error al registrar el nodo de IA']);
             }
         } catch (Exception $e) {
             http_response_code(500);
             echo json_encode(['error' => 'Error del servidor: ' . $e->getMessage()]);
         }
     }
}
