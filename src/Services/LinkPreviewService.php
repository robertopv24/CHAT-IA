<?php
// src/Services/LinkPreviewService.php

namespace Foxia\Services;

class LinkPreviewService
{
    /**
     * Obtiene metadatos OpenGraph de una URL
     */
    public function getPreview(string $url): array
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return ['error' => 'URL inválida'];
        }

        try {
            // Inicializar cURL
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Timeout corto para no bloquear
            curl_setopt($ch, CURLOPT_USERAGENT, 'FoxiaBot/1.0 (+https://foxia.duckdns.org)');
            // Limitar tamaño de descarga (1MB) para seguridad
            curl_setopt($ch, CURLOPT_RANGE, '0-1048576');

            $html = curl_exec($ch);
            if (PHP_VERSION_ID < 80000) {
                curl_close($ch);
            }

            if (!$html) {
                return ['error' => 'No se pudo acceder a la URL'];
            }

            // Parsear metadatos
            $data = [
                'url' => $url,
                'title' => null,
                'description' => null,
                'image' => null,
                'site_name' => null
            ];

            // Suprimir errores de HTML malformado
            libxml_use_internal_errors(true);
            $doc = new \DOMDocument();
            $doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_NOERROR);

            $metas = $doc->getElementsByTagName('meta');

            foreach ($metas as $meta) {
                if (!($meta instanceof \DOMElement)) {
                    continue;
                }

                $property = $meta->getAttribute('property');
                $name = $meta->getAttribute('name');
                $content = $meta->getAttribute('content');

                if ($property === 'og:title' || $name === 'twitter:title') {
                    $data['title'] = $content;
                } elseif ($property === 'og:description' || $name === 'description' || $name === 'twitter:description') {
                    $data['description'] = $content;
                } elseif ($property === 'og:image' || $name === 'twitter:image') {
                    $data['image'] = $content;
                } elseif ($property === 'og:site_name') {
                    $data['site_name'] = $content;
                }
            }

            // Fallbacks si no hay OG tags
            if (empty($data['title'])) {
                $titles = $doc->getElementsByTagName('title');
                if ($titles->length > 0) {
                    $data['title'] = $titles->item(0)->nodeValue;
                }
            }

            return $data;

        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }
}
