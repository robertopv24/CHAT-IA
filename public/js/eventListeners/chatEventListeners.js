// eventListeners/chatEventListeners.js - VERSIÓN CORREGIDA CON IMPORTACIONES FIJAS
import stateManager from '../stateManager.js';
import { apiCall } from '../api.js';
import { showNotification, hideContextMenus } from '../utils.js';
import {
    fetchChats,
    loadChat,
    createAIChat,
    startReply,
    cancelReply,
    sendMessage,
    handleBack
} from '../chat/chatUI.js';
import ErrorHandler from '../errorHandler.js';

export class ChatEventListeners {
    static async setup() {
        await this.setupMessageListeners();
        await this.setupChatActionListeners();
        await this.setupNavigationListeners();
        await this.setupContextMenuListeners();
        await this.setupMessageSearchListeners();
        this.setupGlobalChatListeners();
        console.log('✅ Chat event listeners configurados completamente');
    }

    static async setupMessageListeners() {
        const { elements } = await import('../elements.js');

        // Listener de envío de mensajes - CORREGIDO
        if (elements.sendBtn) {
            elements.sendBtn.removeEventListener('click', this.handleSendMessage);
            elements.sendBtn.addEventListener('click', this.handleSendMessage);
        }

        // Listener de input de mensajes - CORREGIDO
        if (elements.messageInput) {
            elements.messageInput.removeEventListener('keydown', this.handleMessageInputKeydown);
            elements.messageInput.addEventListener('keydown', this.handleMessageInputKeydown);

            elements.messageInput.removeEventListener('input', this.handleMessageInputInput);
            elements.messageInput.addEventListener('input', this.handleMessageInputInput);

            // Listener para pegar archivos
            elements.messageInput.removeEventListener('paste', this.handleMessageInputPaste);
            elements.messageInput.addEventListener('paste', this.handleMessageInputPaste);
        }

        // Listener de respuesta - CORREGIDO
        if (elements.cancelReplyBtn) {
            elements.cancelReplyBtn.removeEventListener('click', this.handleCancelReply);
            elements.cancelReplyBtn.addEventListener('click', this.handleCancelReply);
        }
    }

    static async setupChatActionListeners() {
        const { elements } = await import('../elements.js');

        // Nuevo chat - CORREGIDO
        if (elements.newChatBtn) {
            elements.newChatBtn.removeEventListener('click', this.toggleNewChatMenu);
            elements.newChatBtn.addEventListener('click', this.toggleNewChatMenu);
        }

        // Chat con IA - CORREGIDO
        if (elements.createAiChatBtn) {
            elements.createAiChatBtn.removeEventListener('click', this.handleCreateAIChat);
            elements.createAiChatBtn.addEventListener('click', this.handleCreateAIChat);
        }

        // Mensaje a contacto - CORREGIDO
        if (elements.messageContactBtn) {
            elements.messageContactBtn.removeEventListener('click', this.handleMessageContact);
            elements.messageContactBtn.addEventListener('click', this.handleMessageContact);
        }

        // Botón de retroceso - CORREGIDO
        if (elements.backButton) {
            elements.backButton.removeEventListener('click', this.handleBack);
            elements.backButton.addEventListener('click', this.handleBack);
        }

        // Búsqueda de mensajes - CORREGIDO
        if (elements.searchMessagesBtn) {
            elements.searchMessagesBtn.removeEventListener('click', this.handleSearchMessages);
            elements.searchMessagesBtn.addEventListener('click', this.handleSearchMessages);
        }

        // Adjuntar archivo - CORREGIDO
        if (elements.attachFileBtn) {
            elements.attachFileBtn.removeEventListener('click', this.handleAttachFile);
            elements.attachFileBtn.addEventListener('click', this.handleAttachFile);
        }
    }

    static async setupNavigationListeners() {
        const { elements } = await import('../elements.js');

        // Navegación del menú principal - CORREGIDO
        if (elements.menuItems) {
            elements.menuItems.forEach(item => {
                item.removeEventListener('click', this.handleMenuNavigation);
                item.addEventListener('click', this.handleMenuNavigation);
            });
        }

        // Botón de perfil - CORREGIDO
        if (elements.profileBtn) {
            elements.profileBtn.removeEventListener('click', this.handleProfileNavigation);
            elements.profileBtn.addEventListener('click', this.handleProfileNavigation);
        }
    }

    static async setupContextMenuListeners() {
        const { elements } = await import('../elements.js');

        // Menú contextual de mensajes - CORREGIDO
        if (elements.contextMessageReplyBtn) {
            elements.contextMessageReplyBtn.removeEventListener('click', this.handleMessageReply);
            elements.contextMessageReplyBtn.addEventListener('click', this.handleMessageReply);
        }

        if (elements.contextMessageCopyBtn) {
            elements.contextMessageCopyBtn.removeEventListener('click', this.handleMessageCopy);
            elements.contextMessageCopyBtn.addEventListener('click', this.handleMessageCopy);
        }

        if (elements.contextMessageDeleteBtn) {
            elements.contextMessageDeleteBtn.removeEventListener('click', this.handleMessageDelete);
            elements.contextMessageDeleteBtn.addEventListener('click', this.handleMessageDelete);
        }

        // Menú contextual de chats - CORREGIDO
        if (elements.contextRenameBtn) {
            elements.contextRenameBtn.removeEventListener('click', this.handleRenameChat);
            elements.contextRenameBtn.addEventListener('click', this.handleRenameChat);
        }

        if (elements.contextDeleteBtn) {
            elements.contextDeleteBtn.removeEventListener('click', this.handleDeleteChat);
            elements.contextDeleteBtn.addEventListener('click', this.handleDeleteChat);
        }
    }

    static async setupMessageSearchListeners() {
        const { elements } = await import('../elements.js');
        console.log('🔍 Configurando listeners de búsqueda. Elementos:', {
            btn: !!elements.messageSearchBtn,
            input: !!elements.messageSearchInput
        });

        // Botón Buscar en el modal
        if (elements.messageSearchBtn) {
            elements.messageSearchBtn.removeEventListener('click', this.handleMessageSearchAction);
            elements.messageSearchBtn.addEventListener('click', this.handleMessageSearchAction);
            console.log('✅ Listener de clic en búsqueda vinculado');
        }

        // Enter en el input de búsqueda
        if (elements.messageSearchInput) {
            elements.messageSearchInput.removeEventListener('keydown', this.handleMessageSearchKeydown);
            elements.messageSearchInput.addEventListener('keydown', this.handleMessageSearchKeydown);
            console.log('✅ Listener de Enter en búsqueda vinculado');
        }

        // Botón Cerrar en el modal
        if (elements.messageSearchCloseBtn) {
            elements.messageSearchCloseBtn.removeEventListener('click', this.handleCloseMessageSearch);
            elements.messageSearchCloseBtn.addEventListener('click', this.handleCloseMessageSearch);
        }
    }

    // ========== HANDLERS DE MENSAJES CORREGIDOS ==========

    static handleSendMessage = async () => {
        const { elements } = await import('../elements.js');
        const { autoResizeTextarea } = await import('../utils.js');

        const content = elements.messageInput?.value.trim() || '';
        const state = stateManager.getState();

        if (!content || !state.currentChat) {
            showNotification('No hay mensaje para enviar o chat activo', 'warning');
            return;
        }

        const isReply = !!state.replyingToMessage;

        try {
            // Usar la función unificada de envío
            await sendMessage(content, isReply);
            console.log('✅ Mensaje enviado correctamente');

        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
            ErrorHandler.handle(error, 'send_message', {
                chatUuid: state.currentChat?.uuid,
                contentLength: content.length,
                isReply: isReply
            });
        }
    }

    static handleMessageInputKeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
        }
    }

    static handleMessageInputInput = async function () {
        const { autoResizeTextarea } = await import('../utils.js');
        autoResizeTextarea(this);
    }

    static handleMessageInputPaste = async (e) => {
        // Manejar pegado de archivos
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    await this.handlePastedFile(file);
                    return;
                }
            }
        }
    }

    static handlePastedFile = async (file) => {
        const state = stateManager.getState();
        if (!state.currentChat) {
            showNotification('Abre un chat para enviar archivos', 'warning');
            return;
        }

        try {
            // Usar el sistema de subida de archivos existente
            const { showFileUploadModal } = await import('../fileUploadUI.js');
            showFileUploadModal();

            // Aquí necesitaríamos una forma de pre-cargar el archivo pegado
            console.log('📁 Archivo pegado:', file.name);

        } catch (error) {
            console.error('Error manejando archivo pegado:', error);
            showNotification('Error al procesar archivo pegado', 'error');
        }
    }

    // ========== HANDLERS DE CHAT CORREGIDOS ==========

    static toggleNewChatMenu = (event) => {
        event?.stopPropagation();
        import('../elements.js').then(({ elements }) => {
            if (elements.newChatMenu) {
                elements.newChatMenu.classList.toggle('hidden');
            }
        });
    }

    static handleCreateAIChat = async () => {
        hideContextMenus();
        try {
            await createAIChat();
        } catch (error) {
            console.error('Error creando chat IA:', error);
            ErrorHandler.handle(error, 'create_ai_chat');
        }
    }

    static handleMessageContact = async () => {
        hideContextMenus();
        // Navegar al panel de contactos para seleccionar un contacto
        import('../utils.js').then(({ showPanel }) => {
            showPanel('contacts-panel');
        });
        showNotification('Selecciona un contacto para iniciar un chat', 'info');
    }

    static handleBack = () => {
        handleBack();
    }

    static handleSearchMessages = () => {
        import('../modals.js').then(({ showMessageSearchModal }) => {
            showMessageSearchModal();
        });
    }

    static handleMessageSearchAction = async () => {
        console.log('🖱️ Búsqueda de mensajes disparada');
        const { SearchManager } = await import('../chat/searchManager.js');
        await SearchManager.handleMessageSearch();
    }

    static handleMessageSearchKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.handleMessageSearchAction();
        }
    }

    static handleCloseMessageSearch = () => {
        import('../modals.js').then(({ hideMessageSearchModal }) => {
            hideMessageSearchModal();
        });
    }

    static handleAttachFile = () => {
        console.log('📎 Botón de adjuntar archivo presionado');
        const state = stateManager.getState();
        if (!state.currentChat) {
            console.warn('⚠️ No hay chat activo para subir archivos');
            showNotification('Abre un chat para subir archivos', 'warning');
            return;
        }

        console.log('📂 Importando fileUploadUI...');
        import('../fileUploadUI.js')
            .then(({ showFileUploadModal }) => {
                console.log('✅ fileUploadUI importado, llamando a showFileUploadModal');
                showFileUploadModal();
            })
            .catch(err => {
                console.error('❌ Error importando fileUploadUI:', err);
            });
    }

    // ========== HANDLERS DE NAVEGACIÓN CORREGIDOS ==========

    static handleMenuNavigation = (event) => {
        const panelId = event.currentTarget.getAttribute('data-panel');
        if (panelId) {
            import('../utils.js').then(({ showPanel }) => {
                showPanel(panelId);
            });
        }
    }

    static handleProfileNavigation = () => {
        import('../utils.js').then(({ showPanel }) => {
            showPanel('profile-panel');
        });
    }

    // ========== HANDLERS DE RESPUESTA CORREGIDOS ==========

    static handleCancelReply = () => {
        cancelReply();
    }

    // ========== HANDLERS DE MENÚ CONTEXTUAL CORREGIDOS ==========

    static handleMessageReply = () => {
        const state = stateManager.getState();
        if (state.activeContextMenuMessage) {
            hideContextMenus();
            startReply(state.activeContextMenuMessage);
        }
    }

    static handleMessageCopy = () => {
        const state = stateManager.getState();
        if (state.activeContextMenuMessage) {
            hideContextMenus();
            navigator.clipboard.writeText(state.activeContextMenuMessage.content)
                .then(() => {
                    showNotification('Texto copiado al portapapeles', 'success');
                })
                .catch(error => {
                    console.error('Error copiando texto:', error);
                    ErrorHandler.handle(error, 'copy_message');
                });
        }
    }

    static handleMessageDelete = async () => {
        const state = stateManager.getState();
        if (state.activeContextMenuMessage) {
            hideContextMenus();

            const confirmDelete = confirm('¿Estás seguro de que quieres eliminar este mensaje?');
            if (!confirmDelete) return;

            try {
                await apiCall('/api/chat/messages/delete', {
                    method: 'POST',
                    body: { message_uuid: state.activeContextMenuMessage.uuid }
                });

                showNotification('Mensaje eliminado', 'success');

                // Recargar mensajes si hay chat actual
                if (state.currentChat) {
                    const { fetchMessages } = await import('../chatUI.js');
                    fetchMessages(state.currentChat.uuid);
                }
            } catch (error) {
                console.error('Error eliminando mensaje:', error);
                ErrorHandler.handle(error, 'delete_message');
            }
        }
    }

    static handleRenameChat = () => {
        const state = stateManager.getState();
        const chat = state.activeContextMenuChat;

        if (!chat) return;

        hideContextMenus();

        const newTitle = prompt('Nuevo nombre para el chat:', chat.title || '');
        if (newTitle !== null && newTitle.trim() !== '') {
            import('../chatUI.js').then(({ renameChat }) => {
                renameChat(chat.uuid, newTitle.trim());
            });
        }
    }

    static handleDeleteChat = () => {
        const state = stateManager.getState();
        const chat = state.activeContextMenuChat;

        if (!chat) return;

        hideContextMenus();

        import('../chatUI.js').then(({ deleteChat }) => {
            deleteChat(chat.uuid);
        });
    }

    // ========== HANDLERS GLOBALES CORREGIDOS ==========

    /**
     * Configura listeners globales del chat
     */
    static setupGlobalChatListeners() {
        // Cerrar menús al hacer clic fuera
        document.addEventListener('click', this.handleGlobalClick);

        // Teclas globales
        document.addEventListener('keydown', this.handleGlobalKeydown);

        // Visibilidad de la página
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        console.log('✅ Listeners globales del chat configurados');
    }

    static handleGlobalClick = (event) => {
        import('../elements.js').then(({ elements }) => {
            // Cerrar menú de nuevo chat
            if (elements.newChatMenu && !elements.newChatMenu.classList.contains('hidden')) {
                if (!elements.newChatMenu.contains(event.target) &&
                    !elements.newChatBtn?.contains(event.target)) {
                    elements.newChatMenu.classList.add('hidden');
                }
            }

            // Cerrar menús contextuales
            if (elements.contextMenu && !elements.contextMenu.classList.contains('hidden') &&
                !elements.contextMenu.contains(event.target)) {
                elements.contextMenu.classList.add('hidden');
            }

            if (elements.contactContextMenu && !elements.contactContextMenu.classList.contains('hidden') &&
                !elements.contactContextMenu.contains(event.target)) {
                elements.contactContextMenu.classList.add('hidden');
            }

            if (elements.messageContextMenu && !elements.messageContextMenu.classList.contains('hidden') &&
                !elements.messageContextMenu.contains(event.target)) {
                elements.messageContextMenu.classList.add('hidden');
            }
        });
    }

    static handleGlobalKeydown = (event) => {
        // Escape para cancelar respuesta
        if (event.key === 'Escape') {
            const state = stateManager.getState();
            if (state.replyingToMessage) {
                this.handleCancelReply();
            }
        }

        // Ctrl+K para búsqueda
        if (event.ctrlKey && event.key === 'k') {
            event.preventDefault();
            this.handleSearchMessages();
        }
    }

    static handleVisibilityChange = () => {
        // Recargar chats cuando la página se vuelve visible
        if (!document.hidden) {
            const state = stateManager.getState();
            if (state.isAuthenticated) {
                fetchChats();
            }
        }
    }
}
