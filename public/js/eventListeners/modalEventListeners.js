// eventListeners/modalEventListeners.js - Listeners de modales
import stateManager from '../stateManager.js';
import { apiCall } from '../api.js';
import { showNotification, hideContextMenus } from '../utils.js';
import { renameChat, deleteChat } from '../chat/chatUI.js';
import { showRenameModal, hideRenameModal } from '../modals.js';

// Variables locales para contexto temporal
let currentRenameChat = null;

export class ModalEventListeners {
    static async setup() {
        await this.setupChatModalListeners();
        await this.setupGlobalModalListeners();
        await this.setupGroupModalListeners();
        console.log('✅ Modal event listeners configurados');
    }

    static async setupChatModalListeners() {
        const { elements } = await import('../elements.js');

        // Menú contextual de chats
        if (elements.contextRenameBtn) {
            elements.contextRenameBtn.removeEventListener('click', this.handleRenameChat);
            elements.contextRenameBtn.addEventListener('click', this.handleRenameChat);
        }

        if (elements.contextDeleteBtn) {
            elements.contextDeleteBtn.removeEventListener('click', this.handleDeleteChat);
            elements.contextDeleteBtn.addEventListener('click', this.handleDeleteChat);
        }

        // Modal de renombrar chat
        if (elements.renameConfirmBtn) {
            elements.renameConfirmBtn.removeEventListener('click', this.handleConfirmRename);
            elements.renameConfirmBtn.addEventListener('click', this.handleConfirmRename);
        }

        if (elements.renameCancelBtn) {
            elements.renameCancelBtn.removeEventListener('click', hideRenameModal);
            elements.renameCancelBtn.addEventListener('click', hideRenameModal);
        }

        // Abrir modal de grupo desde el menú contextual
        if (elements.createGroupChatBtn) {
            console.log('✅ Botón de creación de grupo encontrado, vinculando listener');
            elements.createGroupChatBtn.removeEventListener('click', this.handleShowGroupModal);
            elements.createGroupChatBtn.addEventListener('click', this.handleShowGroupModal);
        } else {
            console.error('❌ Botón de creación de grupo NO encontrado en elements.js');
        }
    }

    static handleShowGroupModal = async () => {
        console.log('🖱️ Clic detectado en el botón de creación de grupo');
        const { showGroupCreateModal } = await import('../modals.js');
        await showGroupCreateModal();
    }

    static async setupGroupModalListeners() {
        const { elements } = await import('../elements.js');
        const { hideGroupCreateModal } = await import('../modals.js');
        const { createGroupChat } = await import('../chat/chatUI.js');

        if (elements.groupCreateCancelBtn) {
            elements.groupCreateCancelBtn.addEventListener('click', hideGroupCreateModal);
        }

        if (elements.groupCreateConfirmBtn) {
            elements.groupCreateConfirmBtn.addEventListener('click', async () => {
                const title = elements.groupNameInput.value.trim();
                const selectedCheckboxes = elements.groupParticipantsList.querySelectorAll('.participant-checkbox:checked');
                const participantUuids = Array.from(selectedCheckboxes).map(cb => cb.value);

                if (!title) {
                    showNotification('El nombre del grupo es obligatorio', 'warning');
                    return;
                }

                if (participantUuids.length === 0) {
                    showNotification('Selecciona al menos un participante', 'warning');
                    return;
                }

                elements.groupCreateConfirmBtn.disabled = true;
                elements.groupCreateConfirmBtn.textContent = 'Creando...';

                try {
                    const chatUuid = await createGroupChat(title, participantUuids);
                    if (chatUuid) {
                        hideGroupCreateModal();
                    }
                } finally {
                    elements.groupCreateConfirmBtn.disabled = false;
                    elements.groupCreateConfirmBtn.textContent = 'Crear Grupo';
                }
            });
        }

        // Búsqueda en tiempo real de participantes
        if (elements.groupContactSearch) {
            elements.groupContactSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const items = elements.groupParticipantsList.querySelectorAll('label');
                items.forEach(item => {
                    const name = item.querySelector('.text-sm').textContent.toLowerCase();
                    const email = item.querySelector('.text-xs').textContent.toLowerCase();
                    if (name.includes(term) || email.includes(term)) {
                        item.classList.remove('hidden');
                        item.classList.add('flex');
                    } else {
                        item.classList.remove('flex');
                        item.classList.add('hidden');
                    }
                });
            });
        }
    }

    static async setupGlobalModalListeners() {
        // Cerrar modales con Escape
        document.removeEventListener('keydown', this.handleGlobalKeydown);
        document.addEventListener('keydown', this.handleGlobalKeydown);
    }

    // ========== HANDLERS DE CHAT MODALS ==========

    static handleRenameChat = () => {
        const state = stateManager.getState();
        const chat = state.activeContextMenuChat;

        if (!chat) return;

        // Guardar chat en variable local
        currentRenameChat = chat;
        hideContextMenus();
        showRenameModal(chat.title || '');
    }

    static handleDeleteChat = async () => {
        const state = stateManager.getState();
        const chat = state.activeContextMenuChat;

        if (!chat) return;

        hideContextMenus();

        const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar el chat "${chat.title || 'Chat'}"? Esta acción no se puede deshacer.`);

        if (confirmDelete) {
            try {
                await deleteChat(chat.uuid);
            } catch (error) {
                console.error('Error eliminando chat:', error);
                showNotification('Error al eliminar chat: ' + error.message, 'error');
            }
        }
    }

    static handleConfirmRename = async () => {
        const { elements } = await import('../elements.js');
        const newTitle = elements.renameInput?.value.trim() || '';

        if (!currentRenameChat || !newTitle) {
            showNotification('El nombre no puede estar vacío', 'warning');
            return;
        }

        try {
            const success = await renameChat(currentRenameChat.uuid, newTitle);
            if (success) {
                hideRenameModal();
                currentRenameChat = null;
            }
        } catch (error) {
            console.error('Error renombrando chat:', error);
            showNotification('Error al renombrar chat: ' + error.message, 'error');
        }
    }

    // ========== HANDLERS GLOBALES ==========

    static handleGlobalKeydown = async (e) => {
        if (e.key === 'Escape') {
            const { elements } = await import('../elements.js');

            if (!elements.renameModal.classList.contains('hidden')) {
                hideRenameModal();
                currentRenameChat = null;
            }

            if (!elements.nicknameModal.classList.contains('hidden')) {
                import('../modals.js').then(({ hideNicknameModal }) => {
                    hideNicknameModal();
                });
            }

            if (!elements.userAddModal.classList.contains('hidden')) {
                import('../modals.js').then(({ hideUserAddModal }) => {
                    hideUserAddModal();
                });
            }

            if (!elements.messageSearchModal.classList.contains('hidden')) {
                import('../modals.js').then(({ hideMessageSearchModal }) => {
                    hideMessageSearchModal();
                });
            }

            if (!elements.fileUploadModal.classList.contains('hidden')) {
                import('../fileUploadUI.js').then(({ hideFileUploadModal }) => {
                    hideFileUploadModal();
                });
            }

            if (!elements.avatarUploadModal?.classList.contains('hidden')) {
                import('../avatarUI.js').then(({ hideAvatarUploadModal }) => {
                    hideAvatarUploadModal();
                });
            }

            if (!elements.groupCreateModal.classList.contains('hidden')) {
                import('../modals.js').then(({ hideGroupCreateModal }) => {
                    hideGroupCreateModal();
                });
            }
        }
    }
}
