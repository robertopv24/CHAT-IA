<?php
// src/Controllers/UtilsController.php

namespace Foxia\Controllers;

use Foxia\Services\LinkPreviewService;

class UtilsController
{
    private $linkPreviewService;

    public function __construct()
    {
        $this->linkPreviewService = new LinkPreviewService();
    }

    /**
     * Obtiene previsualización de enlace
     */
    public function getLinkPreview()
    {
        header('Content-Type: application/json');

        // Verificar autenticación básica (opcional, pero recomendable)
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autenticado']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $url = $input['url'] ?? ($_GET['url'] ?? null);

        if (!$url) {
            http_response_code(400);
            echo json_encode(['error' => 'URL requerida']);
            return;
        }

        $data = $this->linkPreviewService->getPreview($url);
        echo json_encode($data);
    }
}
