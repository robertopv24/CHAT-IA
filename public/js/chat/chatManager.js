// chat/chatManager.js - Gestión de chats
import { apiCall } from '../api.js';
import stateManager from '../stateManager.js';
import { elements } from '../elements.js';
import { showNotification, formatDate, displayAvatar } from '../utils.js';

export class ChatManager {
    /**
     * Renderiza la lista de chats
     */
    static renderChats(chats) {
        if (!elements.chatsList || !chats) return;

        elements.chatsList.innerHTML = '';

        if (chats.length === 0) {
            elements.chatsList.innerHTML = '<p class="text-center text-gray-400 py-4">No hay conversaciones</p>';
            return;
        }

        chats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            elements.chatsList.appendChild(chatElement);
        });
    }

    /**
     * Crea un elemento de chat
     */
    static createChatElement(chat) {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.dataset.uuid = chat.uuid;

        const isAiChat = chat.chat_type === 'ai';
        const chatTitle = chat.title || (isAiChat ? 'Chat con IA' : 'Chat');
        const lastMessage = chat.last_message_content || '';
        const time = formatDate(chat.last_message_at || chat.created_at);

        // Crear estructura base
        chatElement.innerHTML = `
            <div class="chat-avatar"></div>
            <div class="chat-info">
                <div class="chat-title"></div>
                <div class="chat-preview"></div>
            </div>
            <div class="chat-time"></div>
        `;

        // Asignar contenido de forma segura
        chatElement.querySelector('.chat-title').textContent = chatTitle;
        chatElement.querySelector('.chat-preview').textContent = lastMessage;
        chatElement.querySelector('.chat-time').textContent = time;

        // Configurar avatar
        this.setupChatAvatar(chatElement, chat, isAiChat, chatTitle);

        // Agregar event listeners
        this.setupChatEventListeners(chatElement, chat);

        return chatElement;
    }

    /**
     * Configura el avatar del chat
     */
    static setupChatAvatar(chatElement, chat, isAiChat, chatTitle) {
        const avatarElement = chatElement.querySelector('.chat-avatar');
        if (!avatarElement) return;

        if (isAiChat) {
            avatarElement.innerHTML = '<i class="fas fa-robot" style="color: var(--accent);"></i>';
            avatarElement.style.backgroundImage = '';
            avatarElement.style.backgroundColor = 'transparent';
        } else {
            displayAvatar(avatarElement, chat.avatar_url, chatTitle);
        }
    }

    /**
     * Configura los event listeners del chat
     */
    static setupChatEventListeners(chatElement, chat) {
        // Click para cargar chat
        chatElement.addEventListener('click', () => {
            this.selectChat(chatElement, chat);
        });

        // Menú contextual
        chatElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.showChatContextMenu(event, chat);
        });

        // Marcar como activo si es el chat actual
        const state = stateManager.getState();
        if (state.currentChat && state.currentChat.uuid === chat.uuid) {
            chatElement.classList.add('active-chat');
        }
    }

    /**
     * Selecciona y carga un chat
     */
    static selectChat(chatElement, chat) {
        const allChatItems = elements.chatsList.querySelectorAll('.chat-item');
        allChatItems.forEach(item => item.classList.remove('active-chat'));
        chatElement.classList.add('active-chat');

        import('./chatUI.js').then(({ loadChat }) => {
            loadChat(chat);
        });
    }

    /**
     * Muestra el menú contextual del chat
     */
    static showChatContextMenu(event, chat) {
        const { elements } = require('../elements.js');

        stateManager.setActiveContextMenuChat(chat);

        if (elements.newChatMenu) {
            elements.newChatMenu.classList.add('hidden');
        }

        if (elements.contextMenu) {
            elements.contextMenu.style.top = `${event.clientY}px`;
            elements.contextMenu.style.left = `${event.clientX}px`;
            elements.contextMenu.classList.remove('hidden');
        }
    }

    /**
     * Renombra un chat
     */
    static async renameChat(chatUuid, newTitle) {
        try {
            await apiCall('/api/chat/rename', {
                method: 'POST',
                body: {
                    chat_uuid: chatUuid,
                    title: newTitle
                }
            });

            showNotification('Chat renombrado correctamente', 'success');

            // Recargar lista de chats
            import('./chatUI.js').then(({ fetchChats }) => {
                fetchChats();
            });

            // Actualizar chat actual si es necesario
            const state = stateManager.getState();
            if (state.currentChat && state.currentChat.uuid === chatUuid) {
                stateManager.update(state => {
                    state.currentChat.title = newTitle;
                });

                if (elements.chatTitle) {
                    elements.chatTitle.textContent = newTitle;
                }
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
    static async deleteChat(chatUuid) {
        try {
            await apiCall('/api/chat/delete', {
                method: 'POST',
                body: {
                    chat_uuid: chatUuid
                }
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
                import('./chatUI.js').then(({ handleBack }) => {
                    handleBack();
                });
            }

            // Mostrar mensaje si no hay chats
            const remainingChats = elements.chatsList.querySelectorAll('.chat-item');
            if (remainingChats.length === 0) {
                elements.chatsList.innerHTML = '<p class="text-center text-gray-400 py-4">No hay conversaciones</p>';
            }

            return true;
        } catch (error) {
            console.error('Error deleting chat:', error);
            showNotification('Error al eliminar el chat: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Crea un nuevo chat con IA
     */
    static async createAIChat() {
        try {
            const response = await apiCall('/api/chat/create', {
                method: 'POST',
                body: {
                    chat_type: 'ai',
                    title: 'Nuevo Chat con IA'
                }
            });

            showNotification('Nuevo chat con IA creado', 'success');

            // Recargar lista de chats
            await import('./chatUI.js').then(({ fetchChats }) => {
                fetchChats();
            });

            // Buscar y cargar el chat recién creado
            const chatsData = await apiCall('/api/chat/list');
            const newChat = chatsData.chats.find(chat => chat.uuid === response.chat_uuid);

            if (newChat) {
                import('./chatUI.js').then(({ loadChat }) => {
                    loadChat(newChat);
                });
            }

            return newChat;
        } catch (error) {
            console.error('Error creating AI chat:', error);
            showNotification('Error al crear chat con IA: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Actualiza un chat en la lista
     */
    static updateChatInList(chatUuid, lastMessage) {
        if (!elements.chatsList) return;

        const chatElement = elements.chatsList.querySelector(`[data-uuid="${chatUuid}"]`);
        if (chatElement) {
            const previewElement = chatElement.querySelector('.chat-preview');
            const timeElement = chatElement.querySelector('.chat-time');

            if (previewElement) {
                previewElement.textContent = lastMessage.content.substring(0, 10) +
                                           (lastMessage.content.length > 10 ? '...' : '');
            }
            if (timeElement) {
                timeElement.textContent = formatDate(lastMessage.created_at);
            }

            // Mover al principio de la lista
            chatElement.parentNode.insertBefore(chatElement, chatElement.parentNode.firstChild);
        }
    }
}
