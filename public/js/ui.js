// ui.js - Módulo principal de UI (reexportaciones)
export { elements, validateCriticalElements, initializeDynamicElements } from './elements.js';

// Utilidades
export {
    scrollToBottom,
    getInitials,
    displayAvatar,
    formatDate,
    showNotification,
    setWelcomeMessageTime,
    insertTextAtCursor,
    showAuthScreen,
    showApp,
    showPanel,
    hideContextMenus,
    handleSearchChats,
    handleSearchContacts
} from './utils.js';

// Chat UI
export {
    fetchChats,
    renderChats,
    loadChat,
    fetchMessages,
    renderMessages,
    addMessageToChat,
    handleBack,
    handleMessageSearch,
    renderMessageSearchResults,
    updateChatInList,
    renameChat,
    deleteChat
} from './chat/chatUI.js';

// Contacts UI
export {
    fetchContacts,
    renderContacts,
    startChatWithUser,
    updateContactNickname,
    toggleBlockContact,
    deleteContact
} from './contactsUI.js';

// Notifications UI
export {
    updateNotificationBadge,
    addNotificationToList,
    fetchUnreadNotifications,
    markNotificationAsRead,
    openChatFromNotification,
    markAllNotificationsAsRead
} from './notificationsUI.js';

// Modals
export {
    showUserAddModal,
    hideUserAddModal,
    showRenameModal,
    hideRenameModal,
    showNicknameModal,
    hideNicknameModal,
    showFileUploadModal,
    hideFileUploadModal,
    showMessageSearchModal,
    hideMessageSearchModal,
    showTripletEditModal,
    hideTripletEditModal,
    toggleEmojiPicker,
    hideEmojiPicker,
    hideAllModals,
    setupModalCloseListeners
} from './modals.js';

// Funciones que necesitan actualización de perfil (se mantienen aquí)
import stateManager from './stateManager.js';
import { elements } from './elements.js';
// Utilidades
import {
    scrollToBottom,
    getInitials,
    displayAvatar,
    formatDate,
    showNotification,
    setWelcomeMessageTime,
    insertTextAtCursor,
    showAuthScreen,
    showApp,
    showPanel,
    hideContextMenus,
    handleSearchChats,
    handleSearchContacts
} from './utils.js';

/**
 * Actualiza la información del perfil en la UI
 */
export function updateProfileInfo() {
    const state = stateManager.getState();
    if (state.currentUser) {
        // Actualizar nombre de usuario
        if (elements.profileUsername) {
            elements.profileUsername.textContent = state.currentUser.name || 'Usuario';
        }

        // Actualizar email
        if (elements.profileEmail) {
            elements.profileEmail.textContent = state.currentUser.email || 'usuario@ejemplo.com';
        }

        // CORREGIDO: Actualizar avatar del menú principal
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            displayAvatar(profileBtn, state.currentUser.avatar_url, state.currentUser.name || 'Usuario');
        }

        // CORREGIDO: Actualizar avatar grande del panel de perfil
        const profileAvatar = document.querySelector('.user-avatar.large');
        if (profileAvatar) {
            displayAvatar(profileAvatar, state.currentUser.avatar_url, state.currentUser.name || 'Usuario');
        }

        // CORREGIDO: Actualizar avatar en la cabecera del chat si es un chat con el usuario
        const currentState = stateManager.getState();
        if (currentState.currentChat && currentState.currentChat.chat_type !== 'ai') {
            const chatHeaderAvatar = document.querySelector('.chat-header .chat-avatar');
            if (chatHeaderAvatar) {
                // Aquí deberías obtener el avatar del otro participante, no del usuario actual
                // Por ahora usamos un placeholder
                displayAvatar(chatHeaderAvatar, null, currentState.currentChat.title || 'Chat');
            }
        }
    }
}

/**
 * Actualiza el estado de conexión en la UI
 */
export function updateConnectionStatus(connected, message = '') {
    if (!elements.connectionStatus) return;

    if (connected) {
        elements.connectionStatus.textContent = message || 'Conectado';
        elements.connectionStatus.style.color = 'var(--success)';
    } else {
        elements.connectionStatus.textContent = message || 'Desconectado';
        elements.connectionStatus.style.color = 'var(--danger)';
    }
}

/**
 * Función de diagnóstico para problemas de UI
 */
export function diagnoseUI() {
    console.log('🔍 DIAGNÓSTICO UI:');

    // Verificar elementos críticos
    const criticalElements = [
        'authScreen', 'appContainer', 'chatsList', 'messagesContainer',
        'messageInput', 'chatPanel', 'chatsPanel'
    ];

    criticalElements.forEach(key => {
        const exists = !!elements[key];
        console.log(`- ${key}: ${exists ? '✅' : '❌'}`);
    });

    // Verificar estado de la aplicación
    const state = stateManager.getState();
    console.log('- Usuario autenticado:', state.isAuthenticated);
    console.log('- Chat actual:', state.currentChat ? state.currentChat.uuid : 'Ninguno');
    console.log('- WebSocket conectado:', state.isWebSocketConnected);

    return {
        elements: Object.fromEntries(
            criticalElements.map(key => [key, !!elements[key]])
        ),
        state: {
            authenticated: state.isAuthenticated,
            currentChat: state.currentChat ? state.currentChat.uuid : null,
            websocketConnected: state.isWebSocketConnected
        }
    };
}

/**
 * Función para mostrar/ocultar el indicador de "pensando"
 */
export function toggleThinkingIndicator(show) {
    if (!elements.thinkingContainer) return;

    if (show) {
        elements.thinkingContainer.classList.remove('hidden');
    } else {
        elements.thinkingContainer.classList.add('hidden');
    }
}

/**
 * Función para mostrar/ocultar el panel de tripletes
 */
export function toggleTripletsPanel(show, triplets = null) {
    if (!elements.tripletsPanel) return;

    if (show && triplets) {
        renderTriplets(triplets);
        elements.tripletsPanel.classList.remove('hidden');
    } else {
        elements.tripletsPanel.classList.add('hidden');
    }
}

/**
 * Renderiza tripletes en el panel
 */
function renderTriplets(triplets) {
    if (!elements.tripletsContent || !Array.isArray(triplets)) return;

    elements.tripletsContent.innerHTML = '';

    if (triplets.length === 0) {
        elements.tripletsContent.innerHTML = '<p class="text-gray-400 text-center py-2">No hay tripletes relevantes</p>';
        return;
    }

    triplets.forEach((triplet, index) => {
        const tripletElement = document.createElement('div');
        tripletElement.className = 'triplet-item p-2 border-b border-gray-600';
        tripletElement.innerHTML = `
            <div class="triplet-content text-sm">
                <span class="font-semibold">${DOMPurify.sanitize(triplet.subject)}</span>
                <span class="text-blue-400"> ${DOMPurify.sanitize(triplet.predicate)} </span>
                <span class="font-semibold">${DOMPurify.sanitize(triplet.object)}</span>
            </div>
            <div class="triplet-actions mt-1 flex justify-end space-x-2">
                <button class="text-xs text-blue-400 hover:text-blue-300 edit-triplet" data-index="${index}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="text-xs text-green-400 hover:text-green-300 use-triplet" data-index="${index}">
                    <i class="fas fa-plus"></i> Usar
                </button>
            </div>
        `;

        // Agregar listeners para acciones
        const editBtn = tripletElement.querySelector('.edit-triplet');
        const useBtn = tripletElement.querySelector('.use-triplet');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // Implementar edición de tripletes
                console.log('Editar triplete:', triplet);
            });
        }

        if (useBtn) {
            useBtn.addEventListener('click', () => {
                // Implementar uso del triplete
                if (elements.messageInput) {
                    const text = `${triplet.subject} ${triplet.predicate} ${triplet.object}`;
                    elements.messageInput.value = text;
                    elements.messageInput.focus();
                }
            });
        }

        elements.tripletsContent.appendChild(tripletElement);
    });
}

/**
 * Inicialización completa de la UI
 */
export function initializeUI() {
    // Validar elementos críticos usando la función importada de elements.js
    if (!validateCriticalElements()) {
        console.error('❌ Elementos críticos faltantes en la UI');
        return false;
    }

    // Inicializar elementos dinámicos
    initializeDynamicElements();

    // Configurar listeners de modales
    setupModalCloseListeners();

    console.log('✅ UI inicializada correctamente');
    return true;
}
