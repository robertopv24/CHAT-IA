// utils.js - Agregar exportación de elements
import { elements } from './elements.js';

export { elements }; // ✅ Exportar elements

export function scrollToBottom() {
    if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
}

export function getInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

export function displayAvatar(element, urlAvatar, name) {
    if (!element) return;

    // Limpiar el contenido del elemento
    element.innerHTML = '';

    if (urlAvatar) {
        // Si hay URL de avatar, usar imagen de fondo
        element.style.backgroundImage = `url(${urlAvatar})`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
        element.style.backgroundColor = 'transparent';

        // Asegurar que se muestre correctamente
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
    } else {
        // Si no hay avatar, mostrar iniciales
        element.style.backgroundImage = '';
        element.style.backgroundColor = 'var(--primary)';
        const initials = getInitials(name);
        element.textContent = initials;
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = 'white';
        element.style.fontWeight = 'bold';
        element.style.fontSize = '0.8rem';
    }
}

export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

export function showNotification(message, type = 'success') {
    if (!elements.notification) return;

    elements.notification.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.classList.remove('hidden');

    setTimeout(() => {
        if (elements.notification) {
            elements.notification.classList.add('hidden');
        }
    }, 3000);
}

export function setWelcomeMessageTime() {
    const welcomeTime = document.getElementById('welcome-time');
    if (welcomeTime) {
        welcomeTime.textContent = new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

export function insertTextAtCursor(inputEl, text) {
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    inputEl.value = inputEl.value.substring(0, start) + text + inputEl.value.substring(end);
    inputEl.selectionStart = inputEl.selectionEnd = start + text.length;
    inputEl.focus();
}

export function autoResizeTextarea(textarea) {
    if (!textarea) return;

    // Resetear altura primero
    textarea.style.height = 'auto';

    // Establecer nueva altura basada en el contenido
    const newHeight = Math.min(textarea.scrollHeight, 120); // Máximo 120px
    textarea.style.height = newHeight + 'px';

    // Ajustar el contenedor de mensajes si es necesario
    scrollToBottom();
}

export function showAuthScreen() {
    if (elements.authScreen) elements.authScreen.classList.remove('hidden');
    if (elements.appContainer) elements.appContainer.classList.add('hidden');
}

export function showApp() {
    if (elements.authScreen) elements.authScreen.classList.add('hidden');
    if (elements.appContainer) elements.appContainer.classList.remove('hidden');
    showPanel('chats-panel');
}

export function showPanel(panelId) {
    // console.log(`🖥️ [UI DEBUG] Cambiando al panel: ${panelId}`);

    // 1. Manejar paneles de contenido
    if (elements.contentPanels) {
        elements.contentPanels.forEach(panel => {
            const id = panel.id;
            if (id === panelId) {
                panel.classList.add('active');
                // console.log(`✅ [UI DEBUG] Panel activado: ${id}`);
            } else {
                panel.classList.remove('active');
            }
        });
    } else {
        console.warn('⚠️ [UI DEBUG] elements.contentPanels no está inicializado');
        // Fallback si la cache falla
        document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(panelId);
        if (target) target.classList.add('active');
    }

    // 2. Sincronizar menú lateral (Sidebar)
    if (elements.menuItems) {
        // Mapear el panel de chat al icono de chats
        const menuPanelId = panelId === 'chat-panel' ? 'chats-panel' : panelId;

        elements.menuItems.forEach(item => {
            const itemPanelId = item.getAttribute('data-panel');
            if (itemPanelId === menuPanelId) {
                item.classList.add('active');
                // console.log(`📍 [UI DEBUG] Menú activado para: ${itemPanelId}`);
            } else {
                item.classList.remove('active');
            }
        });
    }
}

export function hideContextMenus() {
    if (elements.contextMenu) elements.contextMenu.classList.add('hidden');
    if (elements.contactContextMenu) elements.contactContextMenu.classList.add('hidden');
    if (elements.messageContextMenu) elements.messageContextMenu.classList.add('hidden');
    if (elements.newChatMenu) elements.newChatMenu.classList.add('hidden');
}

export function handleSearchChats() {
    const searchTerm = elements.searchInputChat ? elements.searchInputChat.value.toLowerCase() : '';
    const chatItems = elements.chatsList ? elements.chatsList.querySelectorAll('.chat-item') : [];

    chatItems.forEach(item => {
        const title = item.querySelector('.chat-title').textContent.toLowerCase();
        const preview = item.querySelector('.chat-preview').textContent.toLowerCase();

        if (title.includes(searchTerm) || preview.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

export function handleSearchContacts() {
    const searchTerm = elements.contactSearchInput ? elements.contactSearchInput.value.toLowerCase() : '';
    const contactItems = elements.contactsList ? elements.contactsList.querySelectorAll('.contact-item') : [];

    contactItems.forEach(item => {
        const name = item.querySelector('.contact-name').textContent.toLowerCase();
        const email = item.querySelector('.contact-email').textContent.toLowerCase();

        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}
