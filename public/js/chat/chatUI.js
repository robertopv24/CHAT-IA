// chat/chatUI.js - VERSIÓN CORREGIDA CON EXPORTACIONES COMPLETAS
import { apiCall, getCookie } from '../api.js';
import { subscribeToChat } from '../websocket.js';
import stateManager from '../stateManager.js';
import { elements } from '../elements.js';
import { showNotification, scrollToBottom, showPanel } from '../utils.js';
import { MessageRenderer } from './messageRenderer.js';
import { SearchManager } from './searchManager.js';
import { ChatManager } from './chatManager.js';

// ========== FUNCIONES PRINCIPALES CORREGIDAS ==========

/**
 * Obtiene y renderiza la lista de chats
 */
export async function fetchChats() {
    try {
        const data = await apiCall('/api/chat/list');
        ChatManager.renderChats(data.chats || data);

        // Actualizar estado de notificaciones
        updateUnreadCounts(data.chats || []);
    } catch (error) {
        console.error('Error fetching chats:', error);
        showNotification('Error al cargar chats: ' + error.message, 'error');
    }
}

/**
 * Renderiza la lista de chats (wrapper para ChatManager)
 */
export function renderChats(chats) {
    ChatManager.renderChats(chats);
}

/**
 * Actualiza contadores de mensajes no leídos
 */
function updateUnreadCounts(chats) {
    let totalUnread = 0;

    chats.forEach(chat => {
        const unreadCount = chat.unread_count || 0;
        totalUnread += unreadCount;

        // Actualizar badge en elemento de chat si existe
        const chatElement = document.querySelector(`[data-uuid="${chat.uuid}"]`);
        if (chatElement) {
            const badge = chatElement.querySelector('.unread-badge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    });

    // Actualizar badge global si existe
    const globalBadge = document.getElementById('chats-unread-badge');
    if (globalBadge) {
        if (totalUnread > 0) {
            globalBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            globalBadge.classList.remove('hidden');
        } else {
            globalBadge.classList.add('hidden');
        }
    }
}

/**
 * Carga un chat específico
 */
export function loadChat(chat) {
    // console.log('📂 [UI DEBUG] Cargando chat:', chat ? chat.uuid : 'null', chat);

    // Actualizar estado usando el método específico para diagnóstico
    stateManager.setCurrentChat(chat);

    // Actualizar UI del header del chat
    updateChatHeader(chat);

    // Mostrar panel de chat usando la función centralizada
    showPanel('chat-panel');

    // Cargar mensajes y suscribirse
    fetchMessages(chat.uuid);
    scrollToBottom();
    subscribeToChat(chat.uuid);

    // Marcar mensajes como leídos
    markChatAsRead(chat.uuid);
}

/**
 * Actualiza el header del chat
 */
function updateChatHeader(chat) {
    if (elements.chatTitle) {
        elements.chatTitle.textContent = chat.title || (chat.chat_type === 'ai' ? 'FoxIA Assistant' : 'Chat');
    }

    // Actualizar avatar del header
    const chatHeaderAvatar = document.querySelector('.chat-header .chat-avatar');
    if (chatHeaderAvatar) {
        if (chat.chat_type === 'ai') {
            chatHeaderAvatar.innerHTML = '<i class="fas fa-robot"></i>';
            chatHeaderAvatar.style.backgroundImage = '';
            chatHeaderAvatar.style.backgroundColor = 'transparent';
        } else {
            import('../utils.js').then(({ displayAvatar }) => {
                displayAvatar(chatHeaderAvatar, chat.avatar_url, chat.title || 'Chat');
            });
        }
    }

    // Actualizar estado de conexión
    if (elements.connectionStatus) {
        const state = stateManager.getState();
        if (state.isWebSocketConnected) {
            elements.connectionStatus.textContent = 'Conectado';
            elements.connectionStatus.style.color = 'var(--success)';
        } else {
            elements.connectionStatus.textContent = 'Desconectado';
            elements.connectionStatus.style.color = 'var(--danger)';
        }
    }
}

/**
 * Marcar chat como leído
 */
async function markChatAsRead(chatUuid) {
    try {
        // Esto se hace automáticamente al cargar mensajes en el backend
        // Pero podemos actualizar la UI inmediatamente
        const chatElement = document.querySelector(`[data-uuid="${chatUuid}"]`);
        if (chatElement) {
            const badge = chatElement.querySelector('.unread-badge');
            if (badge) {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error marcando chat como leído:', error);
    }
}

/**
 * Obtiene y renderiza los mensajes de un chat
 */
export async function fetchMessages(chatUuid) {
    try {
        const data = await apiCall(`/api/chat/messages?chat_uuid=${chatUuid}`);
        renderMessages(data.messages || []);

        // Actualizar estado del chat actual
        const state = stateManager.getState();
        if (state.currentChat && state.currentChat.uuid === chatUuid) {
            stateManager.update(state => {
                state.currentChat.messageCount = data.messages?.length || 0;
            });
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
        showNotification('Error al cargar mensajes: ' + error.message, 'error');
    }
}

/**
 * Renderiza una lista de mensajes
 */
export function renderMessages(messages) {
    if (!elements.messagesContainer) return;

    elements.messagesContainer.innerHTML = '';

    if (messages.length > 0) {
        messages.forEach(message => {
            addMessageToChat(message);
        });
    } else {
        // Mostrar estado vacío
        elements.messagesContainer.innerHTML = `
            <div class="empty-chat-state">
                <i class="fas fa-comments"></i>
                <p>No hay mensajes aún</p>
                <p class="empty-subtitle">¡Sé el primero en enviar un mensaje!</p>
            </div>
        `;
    }

    scrollToBottom();
}

/**
 * Agrega un mensaje al chat
 */
export function addMessageToChat(message, isReply = false, replyingTo = null) {
    // console.log('🖥️ [UI DEBUG] Intentando añadir mensaje al chat:', message.uuid);
    if (!elements.messagesContainer) {
        console.error('❌ [UI DEBUG] No se encontró elements.messagesContainer!');
        return;
    }

    // Eliminar estado vacío si existe
    const emptyState = elements.messagesContainer.querySelector('.empty-chat-state');
    if (emptyState) {
        emptyState.remove();
        console.log('✅ [UI DEBUG] Estado vacío eliminado');
    }

    // Eliminar duplicados (mensajes temporales)
    removeDuplicateMessage(message.uuid);

    // Renderizar mensaje
    // console.log('🎨 [UI DEBUG] Renderizando mensaje con MessageRenderer...', { message, isReply, replyingTo });
    const messageElement = MessageRenderer.renderMessage(message, isReply, replyingTo);

    if (!messageElement) {
        console.error('❌ [UI DEBUG] MessageRenderer.renderMessage() retornó null/undefined!');
        return;
    }

    console.log('✅ [UI DEBUG] Elemento de mensaje creado, añadiendo al DOM...');
    elements.messagesContainer.appendChild(messageElement);
    console.log('✅ [UI DEBUG] Mensaje añadido al DOM exitosamente');

    // Ocultar indicador de "pensando" para mensajes de IA
    if (message.ai_model && elements.thinkingContainer) {
        elements.thinkingContainer.classList.add('hidden');
    }

    scrollToBottom();
    console.log('✅ [UI DEBUG] Scroll completado - mensaje visible');
}

/**
 * Elimina mensajes duplicados del DOM
 */
function removeDuplicateMessage(messageUuid) {
    if (!messageUuid) return;

    // Eliminar mensaje temporal si existe
    if (!messageUuid.startsWith('temp-')) {
        const tempMessageElement = elements.messagesContainer.querySelector(`[data-uuid="temp-${messageUuid}"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
    }

    // Eliminar mensaje duplicado si existe
    const existingMessage = elements.messagesContainer.querySelector(`[data-uuid="${messageUuid}"]`);
    if (existingMessage) {
        existingMessage.remove();
    }
}

/**
 * Maneja la navegación hacia atrás
 */
export function handleBack() {
    if (elements.chatPanel) elements.chatPanel.classList.remove('active');
    if (elements.chatsPanel) elements.chatsPanel.classList.add('active');
    if (elements.messagesContainer) elements.messagesContainer.innerHTML = '';

    // Limpiar chat actual
    stateManager.update(state => {
        state.currentChat = null;
    });

    // Cancelar cualquier respuesta en curso
    cancelReply();
}

/**
 * Cancela el modo de respuesta - ✅ CORREGIDO: AHORA ESTÁ EXPORTADO
 */
export function cancelReply() {
    stateManager.clearReplyingToMessage();
    if (elements.replyingToBar) {
        elements.replyingToBar.classList.add('hidden');
    }
    if (elements.messageInput) {
        elements.messageInput.placeholder = 'Escribe un mensaje';
    }
}

// ========== GESTIÓN DE CHATS MEJORADA ==========

/**
 * Crea un nuevo chat con IA
 */
export async function createAIChat() {
    try {
        const response = await apiCall('/api/chat/create', {
            method: 'POST',
            body: {
                chat_type: 'ai',
                title: 'Nuevo Chat con IA'
            }
        });

        const notificationMessage = response.created
            ? 'Nuevo chat con IA creado'
            : 'Abriendo chat con IA existente';

        showNotification(notificationMessage, 'success');

        // Recargar lista de chats
        await fetchChats();

        // Cargar el chat
        if (response.chat_uuid) {
            const chatsData = await apiCall('/api/chat/list');
            const targetChat = chatsData.chats.find(chat => chat.uuid === response.chat_uuid);
            if (targetChat) {
                loadChat(targetChat);
            }
        }

        return response.chat_uuid;
    } catch (error) {
        console.error('Error creating AI chat:', error);
        showNotification('Error al crear chat con IA: ' + error.message, 'error');
        return null;
    }
}

/**
 * Crea un nuevo chat grupal
 */
export async function createGroupChat(title, participantUuids) {
    try {
        const response = await apiCall('/api/chat/create', {
            method: 'POST',
            body: {
                chat_type: 'group',
                title: title,
                participant_uuids: participantUuids
            }
        });

        const notificationMessage = response.created
            ? 'Grupo creado exitosamente'
            : 'Abriendo grupo existente';

        showNotification(notificationMessage, 'success');

        // Recargar lista de chats
        await fetchChats();

        // Cargar el chat
        if (response.chat_uuid) {
            const chatsData = await apiCall('/api/chat/list');
            const targetChat = chatsData.chats.find(chat => chat.uuid === response.chat_uuid);
            if (targetChat) {
                loadChat(targetChat);
            }
        }

        return response.chat_uuid;
    } catch (error) {
        console.error('Error creating group chat:', error);
        showNotification('Error al crear el grupo: ' + error.message, 'error');
        return null;
    }
}

/**
 * Renombra un chat
 */
export async function renameChat(chatUuid, newTitle) {
    try {
        await apiCall('/api/chat/rename', {
            method: 'POST',
            body: {
                chat_uuid: chatUuid,
                new_title: newTitle
            }
        });

        showNotification('Chat renombrado correctamente', 'success');

        // Actualizar lista de chats
        await fetchChats();

        // Actualizar chat actual si es necesario
        const state = stateManager.getState();
        if (state.currentChat && state.currentChat.uuid === chatUuid) {
            stateManager.update(state => {
                state.currentChat.title = newTitle;
            });
            updateChatHeader(state.currentChat);
        }

        return true;
    } catch (error) {
        console.error('Error renaming chat:', error);
        showNotification('Error al renombrar el chat: ' + error.message, 'error');
        return false;
    }
}

/**
 * Elimina un chat
 */
export async function deleteChat(chatUuid) {
    try {
        const confirmDelete = confirm('¿Estás seguro de que quieres eliminar este chat? Esta acción no se puede deshacer.');
        if (!confirmDelete) return false;

        await apiCall('/api/chat/delete', {
            method: 'POST',
            body: { chat_uuid: chatUuid }
        });

        showNotification('Chat eliminado correctamente', 'success');

        // Remover de la lista UI
        const chatElement = elements.chatsList.querySelector(`[data-uuid="${chatUuid}"]`);
        if (chatElement) {
            chatElement.remove();
        }

        // Manejar chat actual
        const state = stateManager.getState();
        if (state.currentChat && state.currentChat.uuid === chatUuid) {
            handleBack();
        }

        // Recargar lista completa para asegurar consistencia
        await fetchChats();

        return true;
    } catch (error) {
        console.error('Error deleting chat:', error);
        showNotification('Error al eliminar el chat: ' + error.message, 'error');
        return false;
    }
}

/**
 * Actualiza un chat en la lista
 */
export function updateChatInList(chatUuid, updates) {
    if (!elements.chatsList) return;

    const chatElement = elements.chatsList.querySelector(`[data-uuid="${chatUuid}"]`);
    if (chatElement) {
        // Actualizar último mensaje
        if (updates.lastMessage) {
            const previewElement = chatElement.querySelector('.chat-preview');
            if (previewElement) {
                previewElement.textContent = updates.lastMessage.content.substring(0, 50) +
                    (updates.lastMessage.content.length > 50 ? '...' : '');
            }
        }

        // Actualizar tiempo
        if (updates.timestamp) {
            const timeElement = chatElement.querySelector('.chat-time');
            if (timeElement) {
                import('../utils.js').then(({ formatDate }) => {
                    timeElement.textContent = formatDate(updates.timestamp);
                });
            }
        }

        // Mover al principio de la lista
        chatElement.parentNode.insertBefore(chatElement, chatElement.parentNode.firstChild);
    }
}

// ========== BÚSQUEDA Y UTILIDADES ==========

// Re-exportaciones para compatibilidad
export const handleMessageSearch = SearchManager.handleMessageSearch;
export const renderMessageSearchResults = SearchManager.renderMessageSearchResults;

/**
 * Inicia el modo de respuesta a un mensaje - ✅ CORREGIDO: AHORA ESTÁ EXPORTADO
 */
export function startReply(message) {
    const preview = message.content.length > 50 ?
        message.content.substring(0, 50) + '...' :
        message.content;

    if (elements.replyingToText) {
        elements.replyingToText.textContent = preview;
    }
    if (elements.replyingToBar) {
        elements.replyingToBar.classList.remove('hidden');
    }
    if (elements.messageInput) {
        elements.messageInput.placeholder = 'Escribiendo respuesta...';
        elements.messageInput.focus();
    }

    stateManager.setReplyingToMessage(message);
}

/**
 * Envía un mensaje (función unificada) - ✅ CORREGIDO: AHORA ESTÁ EXPORTADO
 */
export async function sendMessage(content, isReply = false) {
    const state = stateManager.getState();

    if (!content || !state.currentChat) {
        showNotification('No hay mensaje para enviar o chat activo', 'warning');
        return;
    }

    try {
        const body = {
            chat_uuid: state.currentChat.uuid,
            content: content,
            message_type: 'text'
        };

        if (isReply && state.replyingToMessage) {
            body.replying_to_uuid = state.replyingToMessage.uuid;
        }

        await apiCall('/api/chat/send-message', {
            method: 'POST',
            body: body
        });

        // Limpiar input y cancelar respuesta
        if (elements.messageInput) {
            elements.messageInput.value = '';
        }
        cancelReply();

    } catch (error) {
        console.error('Error enviando mensaje:', error);
        showNotification('Error al enviar mensaje: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Limpia completamente el estado del chat
 */
export function clearChatState() {
    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = '';
    }

    stateManager.update(state => {
        state.currentChat = null;
        state.replyingToMessage = null;
    });

    if (elements.chatPanel) {
        elements.chatPanel.classList.remove('active');
    }

    if (elements.chatsPanel) {
        elements.chatsPanel.classList.add('active');
    }

    cancelReply();

    console.log('✅ Estado del chat limpiado correctamente');
}

/**
 * Función de diagnóstico
 */
export function debugChatUI() {
    console.log('🔍 DEBUG chatUI.js:');
    console.log('- elements.messagesContainer:', elements.messagesContainer);
    console.log('- elements.messageSearchResults:', elements.messageSearchResults);

    const state = stateManager.getState();
    console.log('- Estado currentChat:', state.currentChat);
    console.log('- Estado replyingToMessage:', state.replyingToMessage);

    const messages = elements.messagesContainer ?
        elements.messagesContainer.querySelectorAll('.message') : [];
    console.log('- Mensajes en DOM:', messages.length);

    return {
        messagesContainer: !!elements.messagesContainer,
        messageSearchResults: !!elements.messageSearchResults,
        currentChat: state.currentChat,
        replyingToMessage: state.replyingToMessage,
        messagesCount: messages.length
    };
}

// ========== INICIALIZACIÓN MEJORADA ==========

/**
 * Inicializa el sistema de chat
 */
export function initializeChatSystem() {
    console.log('🔧 Inicializando sistema de chat...');

    // Verificar elementos críticos
    if (!elements.messagesContainer || !elements.chatsList) {
        console.error('❌ Elementos críticos del chat no encontrados');
        return false;
    }

    // Cargar chats iniciales
    fetchChats().catch(error => {
        console.error('Error cargando chats iniciales:', error);
    });

    console.log('✅ Sistema de chat inicializado correctamente');
    return true;
}
