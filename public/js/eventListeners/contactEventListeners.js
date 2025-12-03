// eventListeners/contactEventListeners.js - Listeners de contactos
import stateManager from '../stateManager.js';
import { apiCall } from '../api.js';
import { showNotification, hideContextMenus } from '../utils.js';
import { fetchContacts, updateContactNickname, toggleBlockContact, deleteContact } from '../contactsUI.js';
import { showUserAddModal, hideUserAddModal, showNicknameModal, hideNicknameModal } from '../modals.js';

export class ContactEventListeners {
    static async setup() {
        await this.setupContactActionListeners();
        await this.setupContextMenuListeners();
        await this.setupModalListeners();
        console.log('✅ Contact event listeners configurados');
    }

    static async setupContactActionListeners() {
        const { elements } = await import('../elements.js');

        if (elements.addContactBtn) {
            elements.addContactBtn.removeEventListener('click', showUserAddModal);
            elements.addContactBtn.addEventListener('click', showUserAddModal);
        }
    }

    static async setupContextMenuListeners() {
        const { elements } = await import('../elements.js');

        if (elements.contextContactRenameBtn) {
            elements.contextContactRenameBtn.removeEventListener('click', this.handleRenameContact);
            elements.contextContactRenameBtn.addEventListener('click', this.handleRenameContact);
        }

        if (elements.contextContactBlockBtn) {
            elements.contextContactBlockBtn.removeEventListener('click', this.handleToggleBlockContact);
            elements.contextContactBlockBtn.addEventListener('click', this.handleToggleBlockContact);
        }

        if (elements.contextContactDeleteBtn) {
            elements.contextContactDeleteBtn.removeEventListener('click', this.handleDeleteContact);
            elements.contextContactDeleteBtn.addEventListener('click', this.handleDeleteContact);
        }
    }

    static async setupModalListeners() {
        const { elements } = await import('../elements.js');

        if (elements.modalAddContactBtn) {
            elements.modalAddContactBtn.removeEventListener('click', this.handleAddContact);
            elements.modalAddContactBtn.addEventListener('click', this.handleAddContact);
        }

        if (elements.userSearchCancelBtn) {
            elements.userSearchCancelBtn.removeEventListener('click', hideUserAddModal);
            elements.userSearchCancelBtn.addEventListener('click', hideUserAddModal);
        }

        if (elements.nicknameConfirmBtn) {
            elements.nicknameConfirmBtn.removeEventListener('click', this.handleConfirmNickname);
            elements.nicknameConfirmBtn.addEventListener('click', this.handleConfirmNickname);
        }

        if (elements.nicknameCancelBtn) {
            elements.nicknameCancelBtn.removeEventListener('click', hideNicknameModal);
            elements.nicknameCancelBtn.addEventListener('click', hideNicknameModal);
        }

        // Enter key en input de agregar contacto
        if (elements.userAddInput) {
            elements.userAddInput.removeEventListener('keypress', this.handleUserAddInputKeypress);
            elements.userAddInput.addEventListener('keypress', this.handleUserAddInputKeypress);
        }
    }

    // ========== HANDLERS DE CONTACTOS ==========

    static handleAddContact = async () => {
        const { elements } = await import('../elements.js');

        if (!elements.userAddInput) return;

        const identifier = elements.userAddInput.value.trim();

        if (!identifier) {
            showNotification('Por favor, ingresa un nombre o email', 'warning');
            return;
        }

        try {
            if (elements.modalAddContactBtn) {
                elements.modalAddContactBtn.disabled = true;
                elements.modalAddContactBtn.textContent = 'Agregando...';
            }

            await apiCall('/api/user/contacts/add', {
                method: 'POST',
                body: { contact_identifier: identifier }
            });

            showNotification('Contacto agregado correctamente', 'success');
            hideUserAddModal();
            await fetchContacts();

        } catch (error) {
            console.error('Error agregando contacto:', error);
            showNotification('Error al agregar contacto: ' + error.message, 'error');
        } finally {
            if (elements.modalAddContactBtn) {
                elements.modalAddContactBtn.disabled = false;
                elements.modalAddContactBtn.textContent = 'Agregar';
            }
        }
    }

    static handleUserAddInputKeypress = (e) => {
        if (e.key === 'Enter') {
            this.handleAddContact();
        }
    }

    // ========== HANDLERS DE MENÚ CONTEXTUAL ==========

    static handleRenameContact = () => {
        const state = stateManager.getState();
        const contact = state.activeContextMenuContact;

        if (!contact) return;

        hideContextMenus();
        showNicknameModal(contact.nickname || '');
    }

    static handleToggleBlockContact = async () => {
        const state = stateManager.getState();
        const contact = state.activeContextMenuContact;

        if (!contact) return;

        hideContextMenus();

        const action = contact.is_blocked ? 'desbloquear' : 'bloquear';
        const confirmAction = confirm(`¿Estás seguro de que quieres ${action} a ${contact.nickname || contact.name}?`);

        if (confirmAction) {
            try {
                await toggleBlockContact(contact.uuid);
            } catch (error) {
                console.error(`Error ${action} contacto:`, error);
                showNotification(`Error al ${action} contacto: ${error.message}`, 'error');
            }
        }
    }

    static handleDeleteContact = async () => {
        const state = stateManager.getState();
        const contact = state.activeContextMenuContact;

        if (!contact) return;

        hideContextMenus();

        const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar a ${contact.nickname || contact.name} de tus contactos?`);

        if (confirmDelete) {
            try {
                await deleteContact(contact.uuid);
            } catch (error) {
                console.error('Error eliminando contacto:', error);
                showNotification('Error al eliminar contacto: ' + error.message, 'error');
            }
        }
    }

    static handleConfirmNickname = async () => {
        const { elements } = await import('../elements.js');
        const nickname = elements.nicknameInput?.value.trim() || '';

        const state = stateManager.getState();
        const contact = state.activeContextMenuContact;

        if (!contact) return;

        try {
            const success = await updateContactNickname(contact.uuid, nickname);
            if (success) {
                hideNicknameModal();
            }
        } catch (error) {
            console.error('Error actualizando apodo:', error);
            showNotification('Error al actualizar apodo: ' + error.message, 'error');
        }
    }
}
