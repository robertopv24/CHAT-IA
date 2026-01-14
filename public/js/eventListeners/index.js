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

export async function setupEventListeners() {
    console.log('🔧 Configurando todos los event listeners...');

    // Configurar listeners en orden de dependencias
    await AuthEventListeners.setup();
    await ChatEventListeners.setup();
    await ContactEventListeners.setup();
    await ModalEventListeners.setup();
    await FileEventListeners.setup();

    // Configurar listeners globales
    setupGlobalListeners();
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
        const closeMenu = (menu) => {
            if (menu && !menu.classList.contains('hidden') && !menu.contains(event.target)) {
                menu.classList.add('hidden');
            }
        };

        closeMenu(elements.contextMenu);
        closeMenu(elements.contactContextMenu);
        closeMenu(elements.messageContextMenu);

        // Cerrar todos los context menus si el clic no es parte de uno
        if (!event.target.closest('.context-menu') &&
            !event.target.closest('[data-context-menu]')) {
            import('../utils.js').then(({ hideContextMenus }) => hideContextMenus());
        }
    });
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
            connectWebSocket().catch(err => console.warn('⚠️ Falló reconexión automática en foco:', err.message));
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
