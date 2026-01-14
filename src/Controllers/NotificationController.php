<?php
// src/controllers/NotificationController.php

namespace Foxia\Controllers;

use Foxia\Config\Database;
use PDO;
use PDOException;

class NotificationController
{
    private $db;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    /**
     * 🔥 OBTENER NOTIFICACIONES NO LEÍDAS
     */
    public function getUnread()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        try {
            $query = "SELECT
                        n.id,
                        n.type,
                        n.title,
                        n.content,
                        n.related_chat_id,
                        c.uuid AS chat_uuid,
                        n.is_read,
                        n.created_at
                      FROM notifications n
                      LEFT JOIN chats c ON n.related_chat_id = c.id
                      WHERE n.user_id = :user_id AND n.is_read = FALSE
                      ORDER BY n.created_at DESC";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->execute();

            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $unreadCount = count($notifications);

            http_response_code(200);
            echo json_encode([
                'unread_count' => $unreadCount,
                'notifications' => $notifications
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * 🔥 MARCAR NOTIFICACIÓN COMO LEÍDA
     */
    public function markAsRead()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $input = json_decode(file_get_contents('php://input'), true);
        $notificationId = $input['notification_id'] ?? null;

        if (!$notificationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Se requiere notification_id']);
            return;
        }

        try {
          $query = "UPDATE notifications SET is_read = TRUE
                    WHERE id = :notification_id AND user_id = :user_id";
            $stmt = $this->db->prepare($query);
            $stmt->execute([':notification_id' => $notificationId, ':user_id' => $currentUserId]);

            // Si no se actualizó ninguna fila, puede ser que ya estuviera leída.
            // Retornamos 200 para evitar errores 404 ruidosos en la consola del cliente.
            http_response_code(200);
            echo json_encode([
                'message' => 'Notificación procesada.',
                'already_read' => ($stmt->rowCount() === 0)
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * 🔥 MARCAR TODAS COMO LEÍDAS
     */
    public function markAllAsRead()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;

        try {
            $query = "UPDATE notifications SET is_read = TRUE
                      WHERE user_id = :user_id AND is_read = FALSE";
            $stmt = $this->db->prepare($query);
            $stmt->execute([':user_id' => $currentUserId]);

            $affectedRows = $stmt->rowCount();

            http_response_code(200);
            echo json_encode([
                'message' => 'Todas las notificaciones marcadas como leídas.',
                'affected_rows' => $affectedRows
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }

    /**
     * 🔥 OBTENER HISTORIAL DE NOTIFICACIONES
     */
    public function getHistory()
    {
        header('Content-Type: application/json');
        if (!isset($GLOBALS['current_user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Usuario no autenticado']);
            return;
        }

        $currentUserId = $GLOBALS['current_user']->id;
        $limit = $_GET['limit'] ?? 50;

        try {
            $query = "SELECT
                        n.id,
                        n.type,
                        n.title,
                        n.content,
                        n.related_chat_id,
                        c.uuid AS chat_uuid,
                        n.is_read,
                        n.created_at
                      FROM notifications n
                      LEFT JOIN chats c ON n.related_chat_id = c.id
                      WHERE n.user_id = :user_id
                      ORDER BY n.created_at DESC
                      LIMIT :limit";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $currentUserId, PDO::PARAM_INT);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();

            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'notifications' => $notifications,
                'total' => count($notifications)
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error en la base de datos: ' . $e->getMessage()]);
        }
    }
}
