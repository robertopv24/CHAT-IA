// js/emojiService.js - Gestión centralizada de emojis
import { elements } from './elements.js';
import { insertTextAtCursor } from './utils.js';
import { showNotification } from './utils.js';

export class EmojiService {
    constructor() {
        this.isOpen = false;
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (this.isInitialized) {
            console.warn('⚠️ EmojiService ya está inicializado');
            return;
        }

        console.log('🎨 Inicializando EmojiService...');

        try {
            this.validateDependencies();
            this.bindEvents();
            this.setupEmojiPicker();
            this.isInitialized = true;

            console.log('✅ EmojiService inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando EmojiService:', error);
            this.isInitialized = false;
        }
    }

    validateDependencies() {
        if (!elements.emojiBtn) {
            throw new Error('Botón de emojis no encontrado');
        }

        if (!elements.emojiPickerContainer) {
            throw new Error('Contenedor del picker de emojis no encontrado');
        }

        if (!elements.messageInput) {
            console.warn('⚠️ Input de mensaje no encontrado - emojis funcionarán en modo limitado');
        }

        console.log('✅ Dependencias de EmojiService validadas');
    }

    bindEvents() {
        // Event delegation para el botón de emojis
        document.addEventListener('click', (e) => {
            if (e.target.closest('#emoji-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
                return;
            }

            // Cerrar si se hace click fuera
            if (this.isOpen && this.shouldClose(e.target)) {
                this.close();
            }
        });

        // Escape key para cerrar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
            }
        });

        console.log('✅ Event listeners de EmojiService configurados');
    }

    setupEmojiPicker() {
        if (!elements.emojiPicker) {
            console.warn('⚠️ Picker de emojis no encontrado - usando fallback');
            return;
        }

        elements.emojiPicker.addEventListener('emoji-click', (event) => {
            const emoji = event.detail.unicode;
            this.insertEmoji(emoji);
            this.close();
        });

        console.log('✅ Picker de emojis configurado');
    }

    shouldClose(clickedElement) {
        const isEmojiBtn = clickedElement.closest('#emoji-btn');
        const isPicker = clickedElement.closest('#emoji-picker-container');

        return !isEmojiBtn && !isPicker;
    }

    toggle() {
        if (!this.isInitialized) {
            console.warn('⚠️ EmojiService no inicializado - no se puede toggle');
            return;
        }

        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (!this.isInitialized) {
            console.error('❌ EmojiService no inicializado - no se puede abrir');
            return;
        }

        if (this.isOpen) {
            console.warn('⚠️ Picker de emojis ya está abierto');
            return;
        }

        try {
            console.log('🔓 Intentando abrir picker de emojis...');
            this.isOpen = true;

            if (elements.emojiPickerContainer) {
                elements.emojiPickerContainer.classList.remove('hidden');
                console.log('✅ Clase hidden eliminada del contenedor');
                console.log('📊 Estado del contenedor:', {
                    display: window.getComputedStyle(elements.emojiPickerContainer).display,
                    zIndex: window.getComputedStyle(elements.emojiPickerContainer).zIndex,
                    bottom: window.getComputedStyle(elements.emojiPickerContainer).bottom
                });
            } else {
                console.error('❌ elements.emojiPickerContainer no existe en el momento de abrir');
            }

            // this.positionPicker(); // Desactivado para permitir que mande el CSS

            console.log('🎨 Picker de emojis abierto correctamente');

        } catch (error) {
            console.error('❌ Error abriendo picker de emojis:', error);
            this.isOpen = false;
        }
    }

    close() {
        if (!this.isOpen) return;

        try {
            this.isOpen = false;
            elements.emojiPickerContainer.classList.add('hidden');

            console.log('🎨 Picker de emojis cerrado');

        } catch (error) {
            console.error('❌ Error cerrando picker de emojis:', error);
        }
    }

    positionPicker() {
        if (!elements.emojiBtn || !elements.emojiPickerContainer) {
            console.warn('⚠️ No se puede posicionar picker - elementos no encontrados');
            return;
        }

        try {
            const btnRect = elements.emojiBtn.getBoundingClientRect();
            const containerRect = elements.emojiPickerContainer.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Calcular espacio disponible
            const spaceBelow = viewportHeight - btnRect.bottom;
            const spaceAbove = btnRect.top;

            let top;

            // Posicionar verticalmente
            if (spaceBelow < containerRect.height && spaceAbove > containerRect.height) {
                // Posicionar arriba si hay más espacio
                top = btnRect.top - containerRect.height - 10;
            } else {
                // Posicionar abajo (default)
                top = btnRect.bottom + 5;
            }

            // Asegurar que no se salga de la pantalla
            top = Math.max(10, Math.min(top, viewportHeight - containerRect.height - 10));

            // Aplicar estilos
            elements.emojiPickerContainer.style.top = `${top}px`;
            elements.emojiPickerContainer.style.right = `20px`;
            elements.emojiPickerContainer.style.left = 'auto';

        } catch (error) {
            console.error('❌ Error posicionando picker de emojis:', error);
        }
    }

    insertEmoji(emoji) {
        if (!elements.messageInput) {
            console.warn('⚠️ No se puede insertar emoji - input de mensaje no disponible');
            showNotification('No se puede insertar emoji en este momento', 'warning');
            return;
        }

        try {
            insertTextAtCursor(elements.messageInput, emoji);

            // Trigger input event para auto-resize
            const inputEvent = new Event('input', { bubbles: true });
            elements.messageInput.dispatchEvent(inputEvent);

            console.log(`🎨 Emoji insertado: ${emoji}`);

        } catch (error) {
            console.error('❌ Error insertando emoji:', error);
            showNotification('Error insertando emoji', 'error');
        }
    }

    // Método para obtener estado
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isOpen: this.isOpen,
            hasPicker: !!elements.emojiPicker,
            hasContainer: !!elements.emojiPickerContainer,
            hasInput: !!elements.messageInput
        };
    }

    // Método para diagnóstico
    diagnose() {
        const status = this.getStatus();
        console.group('🔍 Diagnóstico EmojiService');
        console.log('Estado:', status);
        console.groupEnd();
        return status;
    }
}
