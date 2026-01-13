// contactsUI.js - VERSIÓN COMPLETAMENTE CORREGIDA
import { apiCall } from './api.js';
import stateManager from './stateManager.js';
import { elements } from './elements.js';
import { showNotification, getInitials, displayAvatar } from './utils.js';
import { loadChat, fetchChats } from './chat/chatUI.js';
import { showPanel } from './utils.js';

export async function fetchContacts() {
    if (!elements.contactsList) return;

    elements.contactsList.innerHTML = '<p class="loading-text">Cargando contactos...</p>';

    try {
        const data = await apiCall('/api/user/contacts');
        renderContacts(data.contacts || data);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        elements.contactsList.innerHTML = '<p class="error-message">Error al cargar contactos</p>';
        showNotification('Error al cargar contactos: ' + error.message, 'error');
    }
}

export function renderContacts(contacts) {
    if (!elements.contactsList) return;

    elements.contactsList.innerHTML = '';

    if (!contacts || contacts.length === 0) {
        elements.contactsList.innerHTML = `
            <div class="empty-contacts-state">
                <i class="fas fa-users"></i>
                <p>No tienes contactos aún</p>
                <p class="empty-subtitle">Agrega contactos para empezar a chatear</p>
                <button class="btn-primary" id="add-first-contact-btn">
                    <i class="fas fa-user-plus"></i> Agregar primer contacto
                </button>
            </div>
        `;

        // Agregar listener al botón de agregar primer contacto
        const addFirstContactBtn = document.getElementById('add-first-contact-btn');
        if (addFirstContactBtn) {
            addFirstContactBtn.addEventListener('click', () => {
                import('./modals.js').then(({ showUserAddModal }) => {
                    showUserAddModal();
                });
            });
        }
        return;
    }

    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        if (contact.is_blocked) {
            contactElement.classList.add('blocked');
        }

        // CORRECCIÓN: Mejorar la estructura HTML del contacto
        contactElement.innerHTML = `
            <div class="contact-avatar"></div>
            <div class="contact-info">
                <div class="contact-name">${DOMPurify.sanitize(contact.nickname || contact.name)}</div>
                <div class="contact-email">${DOMPurify.sanitize(contact.email)}</div>
                ${contact.is_blocked ? '<div class="contact-status blocked">Bloqueado</div>' : ''}
            </div>
            <div class="contact-actions">
                <button class="btn-chat" title="Iniciar chat">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn-more" title="Más opciones">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;

        // CORREGIDO: Aplicar displayAvatar al avatar del contacto
        const avatarElement = contactElement.querySelector('.contact-avatar');
        if (avatarElement) {
            displayAvatar(avatarElement, contact.avatar_url, contact.name);
        }

        // Listener para iniciar chat
        const chatBtn = contactElement.querySelector('.btn-chat');
        chatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startChatWithUser(contact);
        });

        // Listener para menú de opciones
        const moreBtn = contactElement.querySelector('.btn-more');
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showContactContextMenu(e, contact);
        });

        // Listener para clic en el contacto
        contactElement.addEventListener('click', () => {
            // Mostrar información del contacto o iniciar chat
            showContactDetails(contact);
        });

        contactElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showContactContextMenu(event, contact);
        });

        elements.contactsList.appendChild(contactElement);
    });
}

/**
 * Muestra el menú contextual de contactos
 */
function showContactContextMenu(event, contact) {
    stateManager.setActiveContextMenuContact(contact);

    const blockOption = elements.contextContactBlockBtn;
    if (contact.is_blocked) {
        blockOption.innerHTML = `<i class="fas fa-user-check"></i> Desbloquear`;
    } else {
        blockOption.innerHTML = `<i class="fas fa-user-slash"></i> Bloquear`;
    }

    if (elements.contactContextMenu) {
        elements.contactContextMenu.style.top = `${event.clientY}px`;
        elements.contactContextMenu.style.left = `${event.clientX}px`;
        elements.contactContextMenu.classList.remove('hidden');
    }
}

/**
 * Muestra detalles del contacto
 */
function showContactDetails(contact) {
    // CORRECCIÓN: Implementar vista de detalles del contacto
    console.log('Mostrando detalles del contacto:', contact);
    // Aquí podrías mostrar un modal con información detallada del contacto
}

export async function startChatWithUser(contact) {
    try {
        const data = await apiCall('/api/chat/find-or-create', {
            method: 'POST',
            body: {
                participant_uuid: contact.uuid
            }
        });

        const notificationMessage = data.created
            ? `Chat con ${contact.name} creado.`
            : `Abriendo chat existente con ${contact.name}.`;

        showNotification(notificationMessage, 'success');
        await fetchChats();

        // Navegar al panel de chats
        showPanel('chats-panel');

        // Buscar y cargar el chat
        const chatsData = await apiCall('/api/chat/list');
        const chatToLoad = chatsData.chats.find(c => c.uuid === data.chat_uuid);

        if (chatToLoad) {
            // Pequeño delay para asegurar que el panel de chats está visible
            setTimeout(() => {
                loadChat(chatToLoad);
            }, 100);
        }

    } catch (error) {
        console.error('Error starting or finding chat:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

export async function updateContactNickname(contactUuid, nickname) {
    try {
        await apiCall('/api/user/contacts/update-nickname', {
            method: 'POST',
            body: {
                contact_uuid: contactUuid,
                nickname: nickname
            }
        });

        showNotification('Apodo actualizado correctamente', 'success');
        await fetchContacts(); // Recargar lista
        return true;
    } catch (error) {
        console.error('Error updating contact nickname:', error);
        showNotification('Error al actualizar apodo: ' + error.message, 'error');
        return false;
    }
}

export async function toggleBlockContact(contactUuid) {
    try {
        const data = await apiCall('/api/user/contacts/toggle-block', {
            method: 'POST',
            body: {
                contact_uuid: contactUuid
            }
        });

        const action = data.is_blocked ? 'bloqueado' : 'desbloqueado';
        showNotification(`Contacto ${action} correctamente`, 'success');
        await fetchContacts(); // Recargar lista
        return true;
    } catch (error) {
        console.error('Error toggling contact block:', error);
        showNotification('Error al bloquear/desbloquear contacto: ' + error.message, 'error');
        return false;
    }
}

export async function deleteContact(contactUuid) {
    try {
        await apiCall('/api/user/contacts/delete', {
            method: 'POST',
            body: {
                contact_uuid: contactUuid
            }
        });

        showNotification('Contacto eliminado correctamente', 'success');
        await fetchContacts(); // Recargar lista
        return true;
    } catch (error) {
        // This part of the patch seems to be for a different file (errorHandler.js)
        // and is syntactically incorrect if inserted here.
        // Assuming the user intended to modify the catch block or add a call to an error handler.
        // Since the instruction is to "apply patches", and the provided code block
        // contains elements that don't fit directly here, I'm interpreting it as
        // a request to ensure the error handling is consistent with the new `static handle`
        // method, which would likely be part of an `ErrorHandler` class.
        // For now, I will keep the existing catch block as the provided patch
        // would break the syntax if inserted directly.
        // If the intention was to replace the catch block with a call to ErrorHandler.handle,
        // that would require importing ErrorHandler and calling it.
        // Given the strict instruction to "make the change faithfully and without making any unrelated edits",
        // and "incorporate the change in a way so that the resulting file is syntactically correct",
        // I cannot insert the `static handle` method here.
        // The only part that could be relevant to this file is the `showNotification` line,
        // which is already present in the catch block.
        // Therefore, I will assume the patch was intended for `errorHandler.js` and
        // the `deleteContact` function's catch block remains as is, as the provided
        // patch cannot be applied syntactically to this location.
        console.error('Error deleting contact:', error);
        showNotification('Error al eliminar contacto: ' + error.message, 'error');
        return false;
    }
}

/**
 * Buscar contactos
 */
export function searchContacts(searchTerm) {
    if (!elements.contactsList) return;

    const contactItems = elements.contactsList.querySelectorAll('.contact-item');
    let hasResults = false;

    contactItems.forEach(item => {
        const name = item.querySelector('.contact-name').textContent.toLowerCase();
        const email = item.querySelector('.contact-email').textContent.toLowerCase();

        if (name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase())) {
            item.style.display = 'flex';
            hasResults = true;
        } else {
            item.style.display = 'none';
        }
    });

    // Mostrar estado de no resultados
    if (!hasResults && searchTerm) {
        elements.contactsList.innerHTML = `
            <div class="no-results-state">
                <i class="fas fa-search"></i>
                <p>No se encontraron contactos</p>
                <p class="no-results-subtitle">No hay contactos que coincidan con "${searchTerm}"</p>
            </div>
        `;
    } else if (!hasResults) {
        // Restaurar estado vacío original
        fetchContacts();
    }
}

/**
 * Inicializar el sistema de contactos
 */
export function initializeContactsSystem() {
    console.log('🔧 Inicializando sistema de contactos...');

    // Configurar búsqueda en tiempo real
    if (elements.contactSearchInput) {
        elements.contactSearchInput.addEventListener('input', (e) => {
            searchContacts(e.target.value);
        });
    }

    // Cargar contactos iniciales
    fetchContacts().catch(error => {
        console.error('Error cargando contactos iniciales:', error);
    });

    console.log('✅ Sistema de contactos inicializado correctamente');
}
