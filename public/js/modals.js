// modals.js - Gestión de Modales
import { elements } from './elements.js';
import { hideContextMenus } from './utils.js';

// Variables locales para almacenar contexto temporal
let currentRenameChat = null;
let currentNicknameContact = null;

// Modal de agregar usuario
export function showUserAddModal() {
    if (!elements.userAddModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    if (elements.userAddInput) {
        elements.userAddInput.value = '';
        elements.userAddInput.focus();
    }

    elements.userAddModal.classList.remove('hidden');
}

export function hideUserAddModal() {
    if (elements.userAddModal) {
        elements.userAddModal.classList.add('hidden');
    }
}

// CORREGIDO: Modal de renombrar chat - usar variable local
export function showRenameModal(currentName = '') {
    if (!elements.renameModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    if (elements.renameInput) {
        elements.renameInput.value = currentName;
        elements.renameInput.focus();
        elements.renameInput.select();
    }

    elements.renameModal.classList.remove('hidden');
}

export function hideRenameModal() {
    if (elements.renameModal) {
        elements.renameModal.classList.add('hidden');
        // CORREGIDO: No limpiar currentRenameChat aquí, se limpia en eventListeners
    }
}

// CORREGIDO: Modal de apodo de contacto - usar variable local
export function showNicknameModal(currentNickname = '') {
    if (!elements.nicknameModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    if (elements.nicknameInput) {
        elements.nicknameInput.value = currentNickname;
        elements.nicknameInput.focus();
        elements.nicknameInput.select();
    }

    elements.nicknameModal.classList.remove('hidden');
}

export function hideNicknameModal() {
    if (elements.nicknameModal) {
        elements.nicknameModal.classList.add('hidden');
        // CORREGIDO: No limpiar currentNicknameContact aquí, se limpia en eventListeners
    }
}

// Modal de subida de archivos
export function showFileUploadModal() {
    if (!elements.fileUploadModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    // Resetear el estado del modal
    if (elements.fileUpload) {
        elements.fileUpload.value = '';
    }

    if (elements.fileUploadList) {
        elements.fileUploadList.innerHTML = '<p class="text-gray-400 py-4 text-center">No hay archivos seleccionados</p>';
    }

    // Habilitar botón de subir
    if (elements.fileUploadConfirm) {
        elements.fileUploadConfirm.disabled = false;
        elements.fileUploadConfirm.textContent = 'Subir';
    }

    elements.fileUploadModal.classList.remove('hidden');
}

export function hideFileUploadModal() {
    if (elements.fileUploadModal) {
        elements.fileUploadModal.classList.add('hidden');
    }
}

// Modal de búsqueda de mensajes
export function showMessageSearchModal() {
    if (!elements.messageSearchModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    if (elements.messageSearchInput) {
        elements.messageSearchInput.value = '';
        elements.messageSearchInput.focus();
    }

    if (elements.messageSearchResults) {
        elements.messageSearchResults.innerHTML = '';
    }

    elements.messageSearchModal.classList.remove('hidden');
}

export function hideMessageSearchModal() {
    if (elements.messageSearchModal) {
        elements.messageSearchModal.classList.add('hidden');
    }
}

// Modal de edición de tripletes
export function showTripletEditModal(tripletData = {}) {
    if (!elements.tripletEditModal) return;

    // Cerrar menús contextuales
    hideContextMenus();

    if (elements.tripletId && tripletData.id) {
        elements.tripletId.value = tripletData.id;
    }

    if (elements.tripletSubject) {
        elements.tripletSubject.value = tripletData.subject || '';
    }

    if (elements.tripletPredicate) {
        elements.tripletPredicate.value = tripletData.predicate || '';
    }

    if (elements.tripletObject) {
        elements.tripletObject.value = tripletData.object || '';
    }

    elements.tripletEditModal.classList.remove('hidden');
}

export function hideTripletEditModal() {
    if (elements.tripletEditModal) {
        elements.tripletEditModal.classList.add('hidden');
    }
}

// Modal de creación de grupo
export async function showGroupCreateModal() {
    console.log('🏁 showGroupCreateModal llamada');
    if (!elements.groupCreateModal) {
        console.error('❌ elements.groupCreateModal no encontrado');
        return;
    }

    hideContextMenus();

    // MOSTRAR INMEDIATAMENTE PARA FEEDBACK
    console.log('🔓 Mostrando modal de grupo (UX inmediata)');
    elements.groupCreateModal.classList.remove('hidden');

    if (elements.groupNameInput) {
        elements.groupNameInput.value = '';
        elements.groupNameInput.focus();
    }
    if (elements.groupContactSearch) elements.groupContactSearch.value = '';

    console.log('⏳ Cargando lista de participantes en segundo plano...');
    // Cargar lista de contactos para selección múltiple
    await renderGroupParticipantsList();
    console.log('✅ Proceso de showGroupCreateModal finalizado');
}

export function hideGroupCreateModal() {
    if (elements.groupCreateModal) {
        elements.groupCreateModal.classList.add('hidden');
    }
}

async function renderGroupParticipantsList() {
    if (!elements.groupParticipantsList) return;

    elements.groupParticipantsList.innerHTML = '<p class="text-xs text-gray-500 py-2">Cargando contactos...</p>';

    try {
        const { apiCall } = await import('./api.js');
        const data = await apiCall('/api/user/contacts');
        const contacts = data.contacts || data;

        if (!contacts || contacts.length === 0) {
            elements.groupParticipantsList.innerHTML = '<p class="text-xs text-gray-400 py-2">No tienes contactos para agregar</p>';
            return;
        }

        elements.groupParticipantsList.innerHTML = '';
        contacts.forEach(contact => {
            if (contact.is_blocked) return;

            const item = document.createElement('label');
            item.className = 'flex items-center p-2 hover:bg-white hover:bg-opacity-5 rounded cursor-pointer transition-colors';
            item.innerHTML = `
                <input type="checkbox" class="participant-checkbox mr-3 accent-purple-500" value="${contact.uuid}">
                <div class="flex items-center flex-1">
                    <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-2 text-xs overflow-hidden contact-avatar-placeholder">
                        ${contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-medium">${contact.name}</span>
                        <span class="text-xs text-gray-500">${contact.email}</span>
                    </div>
                </div>
            `;
            elements.groupParticipantsList.appendChild(item);
        });

    } catch (error) {
        console.error('Error cargando contactos para grupo:', error);
        elements.groupParticipantsList.innerHTML = '<p class="text-xs text-red-500 py-2">Error al cargar contactos</p>';
    }
}

// Selector de emojis
export function toggleEmojiPicker() {
    if (!elements.emojiPickerContainer) return;

    elements.emojiPickerContainer.classList.toggle('hidden');
}

export function hideEmojiPicker() {
    if (elements.emojiPickerContainer) {
        elements.emojiPickerContainer.classList.add('hidden');
    }
}

// Función para cerrar todos los modales
export function hideAllModals() {
    hideUserAddModal();
    hideRenameModal();
    hideNicknameModal();
    hideFileUploadModal();
    hideMessageSearchModal();
    hideTripletEditModal();
    hideGroupCreateModal();
    hideEmojiPicker();
    hideContextMenus();
}

// CORREGIDO: Función para configurar el cierre de modales con Escape
export function setupModalCloseListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });

    // CORREGIDO: Cerrar modales al hacer clic fuera - lógica mejorada
    document.addEventListener('click', (e) => {
        // User Add Modal
        if (elements.userAddModal && !elements.userAddModal.classList.contains('hidden') &&
            !elements.userAddModal.contains(e.target) &&
            !document.getElementById('add-contact-btn')?.contains(e.target)) {
            hideUserAddModal();
        }

        // Rename Modal
        if (elements.renameModal && !elements.renameModal.classList.contains('hidden') &&
            !elements.renameModal.contains(e.target) &&
            !document.getElementById('context-rename')?.contains(e.target)) {
            hideRenameModal();
        }

        // Nickname Modal
        if (elements.nicknameModal && !elements.nicknameModal.classList.contains('hidden') &&
            !elements.nicknameModal.contains(e.target) &&
            !document.getElementById('context-contact-rename')?.contains(e.target)) {
            hideNicknameModal();
        }

        // File Upload Modal
        if (elements.fileUploadModal && !elements.fileUploadModal.classList.contains('hidden') &&
            !elements.fileUploadModal.contains(e.target) &&
            !document.getElementById('attach-file-btn')?.contains(e.target)) {
            hideFileUploadModal();
        }

        // Message Search Modal
        if (elements.messageSearchModal && !elements.messageSearchModal.classList.contains('hidden') &&
            !elements.messageSearchModal.contains(e.target) &&
            !document.getElementById('search-messages-btn')?.contains(e.target)) {
            hideMessageSearchModal();
        }

        // Triplet Edit Modal
        if (elements.tripletEditModal && !elements.tripletEditModal.classList.contains('hidden') &&
            !elements.tripletEditModal.contains(e.target)) {
            hideTripletEditModal();
        }

        // Group Create Modal
        if (elements.groupCreateModal && !elements.groupCreateModal.classList.contains('hidden') &&
            !elements.groupCreateModal.contains(e.target) &&
            !document.getElementById('create-group-chat-btn')?.contains(e.target)) {
            hideGroupCreateModal();
        }

        // Emoji Picker - CORRECCIÓN CRÍTICA
        if (elements.emojiPickerContainer && !elements.emojiPickerContainer.classList.contains('hidden') &&
            !elements.emojiPickerContainer.contains(e.target) &&
            !elements.emojiBtn.contains(e.target)) {
            elements.emojiPickerContainer.classList.add('hidden');
        }
    });
}

// CORREGIDO: Funciones auxiliares para manejar el contexto temporal
export function setCurrentRenameChat(chat) {
    currentRenameChat = chat;
}

export function getCurrentRenameChat() {
    return currentRenameChat;
}

export function clearCurrentRenameChat() {
    currentRenameChat = null;
}

export function setCurrentNicknameContact(contact) {
    currentNicknameContact = contact;
}

export function getCurrentNicknameContact() {
    return currentNicknameContact;
}

export function clearCurrentNicknameContact() {
    currentNicknameContact = null;
}
