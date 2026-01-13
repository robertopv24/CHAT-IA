import { apiCall } from './api.js';
import { elements } from './elements.js';
import { showNotification, formatDate, showPanel } from './utils.js';
import { loadChat, fetchChats } from './chat/chatUI.js';

export function updateNotificationBadge(increment = 0) {
    if (!elements.notificationBadge) return;

    let currentCount = parseInt(elements.notificationBadge.textContent) || 0;

    if (increment > 0) {
        currentCount += increment;
    } else {
        // Recargar desde el servidor
        fetchUnreadNotifications();
        return;
    }

    elements.notificationBadge.textContent = currentCount;
    elements.notificationBadge.classList.toggle('hidden', currentCount === 0);
}

export function addNotificationToList(notification) {
    if (!elements.notificationsList) return;

    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification-item';
    notificationElement.dataset.id = notification.id;
    notificationElement.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">${DOMPurify.sanitize(notification.title)}</div>
            <div class="notification-time">${formatDate(notification.created_at)}</div>
        </div>
        <div class="notification-content">${DOMPurify.sanitize(notification.content)}</div>
        <div class="notification-actions">
            <button class="btn-mark-read" data-id="${notification.id}"><i class="fas fa-check-double"></i></button>
            ${notification.chat_uuid && notification.chat_uuid !== 'unknown' ?
            `<button class="btn-go-to-chat" data-chat-uuid="${notification.chat_uuid}">Ir al chat</button>` :
            ''}
        </div>
    `;

    // Agregar listeners
    const markReadBtn = notificationElement.querySelector('.btn-mark-read');
    const goToChatBtn = notificationElement.querySelector('.btn-go-to-chat');

    if (markReadBtn) {
        markReadBtn.addEventListener('click', () => markNotificationAsRead(notification.id));
    }

    if (goToChatBtn) {
        goToChatBtn.addEventListener('click', () => openChatFromNotification(notification.chat_uuid));
    }

    elements.notificationsList.prepend(notificationElement);
}

export async function fetchUnreadNotifications() {
    try {
        const data = await apiCall('/api/notifications/unread');

        if (elements.notificationsList) {
            elements.notificationsList.innerHTML = '';

            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(notification => {
                    addNotificationToList(notification);
                });
            } else {
                elements.notificationsList.innerHTML = '<p class="empty-text">No hay notificaciones</p>';
            }
        }

        // Actualizar contador
        if (elements.notificationBadge) {
            elements.notificationBadge.textContent = data.unread_count || 0;
            elements.notificationBadge.classList.toggle('hidden', !data.unread_count || data.unread_count === 0);
        }

    } catch (error) {
        console.error('Error fetching notifications:', error);
        if (elements.notificationsList) {
            elements.notificationsList.innerHTML = '<p class="error-message">Error al cargar notificaciones</p>';
        }
    }
}

export async function markNotificationAsRead(notificationId) {
    try {
        await apiCall('/api/notifications/mark-read', {
            method: 'POST',
            body: { notification_id: notificationId },
            silent: true // ✅ Evitar que el ErrorHandler global lo reporte si falla con 404
        });

        // Remover de la lista UI
        const notificationElement = elements.notificationsList.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
            notificationElement.remove();
        }

        // Actualizar contador
        updateNotificationBadge(-1);

        showNotification('Notificación marcada como leída', 'success');
    } catch (error) {
        // Si el error es 404, probablemente ya se marcó como leída automáticamente al cargar el chat
        if (error.status === 404) {
            console.log('ℹ️ Notificación ya marcada como leída por el sistema.');
            return;
        }
        console.error('Error marking notification as read:', error);
        showNotification('Error al marcar como leída', 'error');
    }
}

export async function openChatFromNotification(chatUuid) {
    try {
        const chatsData = await apiCall('/api/chat/list');
        const chatToLoad = chatsData.chats.find(c => c.uuid === chatUuid);

        if (chatToLoad) {
            console.log('🎯 [UI DEBUG] Iniciando navegación desde notificación para chat:', chatUuid);

            // Asegurar que el sistema está en modo "app"
            if (elements.appContainer) elements.appContainer.classList.remove('hidden');
            if (elements.authScreen) elements.authScreen.classList.add('hidden');

            // 1. Mostrar el panel de chat directamente (showPanel ya maneja el menú)
            console.log('🔄 [UI DEBUG] Solicitando cambio a panel de chat...');
            loadChat(chatToLoad);

            // Marcar notificación como leída
            const notificationElement = elements.notificationsList?.querySelector(`[data-chat-uuid="${chatUuid}"]`);
            if (notificationElement) {
                const notificationId = notificationElement.closest('.notification-item')?.dataset.id;
                if (notificationId) {
                    console.log('✉️ [UI DEBUG] Marcando notificación como leída:', notificationId);
                    markNotificationAsRead(notificationId);
                }
            }
        } else {
            showNotification('Chat no encontrado', 'warning');
        }
    } catch (error) {
        console.error('Error opening chat from notification:', error);
        showNotification('Error al abrir el chat', 'error');
    }
}

export async function markAllNotificationsAsRead() {
    try {
        await apiCall('/api/notifications/mark-all-read', {
            method: 'POST'
        });

        // Limpiar lista
        if (elements.notificationsList) {
            elements.notificationsList.innerHTML = '<p class="empty-text">No hay notificaciones</p>';
        }

        // Resetear contador
        if (elements.notificationBadge) {
            elements.notificationBadge.classList.add('hidden');
            elements.notificationBadge.textContent = '0';
        }

        showNotification('Todas las notificaciones marcadas como leídas', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showNotification('Error al marcar todas como leídas', 'error');
    }
}
