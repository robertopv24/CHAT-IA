// eventListeners/index.js - Punto de entrada unificado para event listeners
import { ChatEventListeners } from './chatEventListeners.js';
import { AuthEventListeners } from './authEventListeners.js';
import { ContactEventListeners } from './contactEventListeners.js';
import { ModalEventListeners } from './modalEventListeners.js';
import { FileEventListeners } from './fileEventListeners.js';
import { hideContextMenus } from '../utils.js';
import stateManager from '../stateManager.js';
import { initializeContactsSystem } from '../contactsUI.js';
import { setupAvatarUploadListeners } from '../avatarUI.js';

export function setupEventListeners() {
    console.log('🔧 Configurando todos los event listeners...');

    // Configurar listeners en orden de dependencias
    AuthEventListeners.setup();
    ChatEventListeners.setup();
    ContactEventListeners.setup();
    ModalEventListeners.setup();
    FileEventListeners.setup();

    // Configurar listeners globales
    setupGlobalListeners();

    // Inicializar subsistemas UI
    initializeContactsSystem();
    setupAvatarUploadListeners();

    // Precargar EmojiService
    import('../emojiService.js').then(({ EmojiService }) => {
        // La instancia se crea automáticamente al importar, pero forzamos la carga
        console.log('✅ EmojiService precargado');
    });

    console.log('✅ Todos los event listeners configurados correctamente');
}

function setupGlobalListeners() {
    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', handleGlobalClick);

    // Ping periódico para WebSocket
    setupWebSocketPing();

    // Actualización periódica de notificaciones
    setupPeriodicUpdates();
}

function handleGlobalClick(event) {
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

        // Cerrar todos los context menus
        if (!event.target.closest('.context-menu') &&
            !event.target.closest('[data-context-menu]')) {
            hideContextMenus();
        }
    });
}

function setupWebSocketPing() {
    // Enviar ping periódico para mantener conexión WebSocket
    setInterval(() => {
        const state = stateManager.getState();
        if (state.isWebSocketConnected && state.websocket &&
            state.websocket.readyState === WebSocket.OPEN) {
            state.websocket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 30000); // Cada 30 segundos
}

function setupPeriodicUpdates() {
    // Actualizar notificaciones periódicamente
    setInterval(() => {
        const state = stateManager.getState();
        if (state.isAuthenticated) {
            import('../notificationsUI.js').then(({ fetchUnreadNotifications }) => {
                fetchUnreadNotifications();
            });
        }
    }, 60000); // Cada 60 segundos
}

// Re-conectar WebSocket cuando la página gana foco
window.addEventListener('focus', function () {
    const state = stateManager.getState();
    if (state.isAuthenticated && !state.isWebSocketConnected) {
        console.log('🔍 Página en foco - Reconectando WebSocket...');
        import('../websocket.js').then(({ connectWebSocket }) => {
            connectWebSocket();
        });
    }
});

// Exportar módulos individuales para testing
export {
    ChatEventListeners,
    AuthEventListeners,
    ContactEventListeners,
    ModalEventListeners,
    FileEventListeners
};
