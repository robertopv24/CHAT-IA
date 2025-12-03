// chat/searchManager.js - Gestión de búsqueda de mensajes
import { apiCall } from '../api.js';
import stateManager from '../stateManager.js';
import { elements } from '../elements.js';
import { showNotification, formatDate } from '../utils.js';
import { sanitizePreview } from '../securityUtils.js';

// Variable para prevenir búsquedas simultáneas
let searchInProgress = false;

export class SearchManager {
    /**
     * Maneja la búsqueda de mensajes
     */
    static async handleMessageSearch() {
        if (searchInProgress) {
            showNotification('Ya hay una búsqueda en curso. Por favor, espera.', 'warning');
            return;
        }

        const searchTerm = elements.messageSearchInput?.value.trim() || '';

        if (searchTerm.length < 2) {
            showNotification('Escribe al menos 2 caracteres para buscar.', 'warning');
            return;
        }

        searchInProgress = true;

        try {
            if (elements.messageSearchResults) {
                elements.messageSearchResults.innerHTML = '<p class="text-center text-gray-400 py-4">Buscando...</p>';
            }

            const state = stateManager.getState();
            if (!state.currentChat) {
                showNotification('No hay un chat activo para buscar.', 'warning');
                return;
            }

            const data = await apiCall(
                `/api/chat/search?chat_uuid=${state.currentChat.uuid}&term=${encodeURIComponent(searchTerm)}`
            );

            this.renderMessageSearchResults(data.messages || []);

        } catch (error) {
            console.error('Error en búsqueda de mensajes:', error);

            if (elements.messageSearchResults) {
                elements.messageSearchResults.innerHTML =
                    `<p class="text-red-400 text-center py-4">Error: ${error.message}</p>`;
            }

            showNotification('Error al buscar mensajes: ' + error.message, 'error');
        } finally {
            searchInProgress = false;
        }
    }

    /**
     * Renderiza los resultados de búsqueda
     */
    static renderMessageSearchResults(results) {
        if (!elements.messageSearchResults) return;

        elements.messageSearchResults.innerHTML = '';

        if (results.length === 0) {
            elements.messageSearchResults.innerHTML =
                '<p class="text-center text-gray-400 py-4">No se encontraron coincidencias.</p>';
            return;
        }

        // Mostrar cantidad de resultados
        const resultsHeader = document.createElement('div');
        resultsHeader.className = 'text-sm text-gray-400 mb-3 text-center';
        resultsHeader.textContent = `Encontrados ${results.length} resultado${results.length !== 1 ? 's' : ''}`;
        elements.messageSearchResults.appendChild(resultsHeader);

        // Renderizar cada resultado
        results.forEach((msg, index) => {
            const resultEl = this.createSearchResultElement(msg, index);
            elements.messageSearchResults.appendChild(resultEl);
        });

        // Agregar footer informativo
        const searchFooter = document.createElement('div');
        searchFooter.className = 'text-xs text-gray-500 text-center mt-4 pt-3 border-t border-gray-600';
        searchFooter.textContent = 'Haz clic en cualquier resultado para ir al mensaje';
        elements.messageSearchResults.appendChild(searchFooter);
    }

    /**
     * Crea un elemento de resultado de búsqueda
     */
    static createSearchResultElement(msg, index) {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item cursor-pointer hover:bg-gray-700 transition-colors duration-200';

        // Sanitizar vista previa
        const preview = sanitizePreview(msg.content || '', 100);

        resultEl.innerHTML = `
            <div class="search-result-content text-sm mb-1">${preview}</div>
            <div class="search-result-time text-xs text-gray-400">${formatDate(msg.created_at)} • Mensaje ${index + 1}</div>
        `;

        // Agregar event listener para navegación
        resultEl.addEventListener('click', () => {
            this.navigateToSearchResult(msg.uuid);
        });

        return resultEl;
    }

    /**
     * Navega a un mensaje específico desde los resultados de búsqueda
     */
    static async navigateToSearchResult(messageUuid) {
        console.log('🔍 Navegando a mensaje:', messageUuid);

        // Ocultar modal de búsqueda
        import('../modals.js').then(({ hideMessageSearchModal }) => {
            hideMessageSearchModal();
        });

        const state = stateManager.getState();
        if (!state.currentChat) {
            showNotification('Error: No hay chat activo', 'error');
            return;
        }

        try {
            showNotification('Cargando mensaje...', 'info');

            // Estrategia 1: Buscar en DOM actual
            let targetMessage = document.querySelector(`[data-uuid="${messageUuid}"]`);

            if (targetMessage) {
                console.log('✅ Mensaje encontrado en DOM actual');
                this.highlightAndScrollToMessage(targetMessage);
                return;
            }

            // Estrategia 2: Recargar mensajes
            console.log('🔄 Mensaje no en DOM, recargando...');
            const { fetchMessages } = await import('./chatUI.js');
            await fetchMessages(state.currentChat.uuid);

            // Esperar a que se renderice
            await new Promise(resolve => setTimeout(resolve, 300));

            // Buscar nuevamente
            targetMessage = document.querySelector(`[data-uuid="${messageUuid}"]`);

            if (targetMessage) {
                console.log('✅ Mensaje encontrado después de recargar');
                this.highlightAndScrollToMessage(targetMessage);
                return;
            }

            // Estrategia 3: Carga extendida
            console.log('🔄 Intentando carga extendida...');
            const extendedMessages = await apiCall(
                `/api/chat/messages?chat_uuid=${state.currentChat.uuid}&limit=200`
            );

            const { renderMessages } = await import('./chatUI.js');
            renderMessages(extendedMessages.messages || []);

            // Esperar a que se renderice
            await new Promise(resolve => setTimeout(resolve, 400));

            // Buscar por última vez
            targetMessage = document.querySelector(`[data-uuid="${messageUuid}"]`);

            if (targetMessage) {
                console.log('✅ Mensaje encontrado con carga extendida');
                this.highlightAndScrollToMessage(targetMessage);
            } else {
                console.warn('❌ Mensaje no encontrado después de todos los intentos');
                showNotification('No se pudo cargar el mensaje específico. Puede estar en un historial muy antiguo.', 'warning');
            }

        } catch (error) {
            console.error('❌ Error cargando mensaje de búsqueda:', error);
            showNotification('Error al cargar el mensaje: ' + error.message, 'error');
        }
    }

    /**
     * Destaca y desplaza a un mensaje
     */
    static highlightAndScrollToMessage(messageElement) {
        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });

        messageElement.classList.add('highlighted');

        setTimeout(() => {
            messageElement.classList.remove('highlighted');
        }, 3000);

        showNotification('Mensaje encontrado y destacado', 'success');
    }
}
