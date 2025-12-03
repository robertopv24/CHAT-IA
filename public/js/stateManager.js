// stateManager.js - Gestión del estado global SIMPLIFICADA
class AppState {
    constructor() {
        // Estado inicial
        this.state = {
            currentUser: null,
            currentChat: null,
            isAuthenticated: false,
            websocket: null,
            isWebSocketConnected: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 3000,
            activeContextMenuChat: null,
            activeContextMenuContact: null,
            replyingToMessage: null,
            activeContextMenuMessage: null,
            hostname: window.location.hostname,
            apiBaseUrl: window.location.origin + '/public',
            isLocalhost: this.#checkIsLocalhost()
        };

        this.listeners = new Set();
    }

    #checkIsLocalhost() {
        return window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname === 'foxia.duckdns.org' ||
               window.location.hostname === '';
    }

    /**
     * Obtiene una copia del estado actual
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Actualiza el estado de forma inmutable - MÉTODO PRINCIPAL
     * @param {Function} updater - Función que recibe el estado y lo modifica
     */
    update(updater) {
        const previousState = { ...this.state };
        const newState = { ...previousState };

        // Ejecutar función de actualización
        updater(newState);

        // Solo actualizar y notificar si hay cambios reales
        if (!this.#shallowEqual(previousState, newState)) {
            this.state = Object.freeze(newState);
            this.#notifyListeners(previousState, newState);
        }
    }

    /**
     * Suscribe un listener para cambios de estado
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener debe ser una función');
        }

        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notifica a todos los listeners
     */
    #notifyListeners(previousState, newState) {
        this.listeners.forEach(listener => {
            try {
                listener(newState, previousState);
            } catch (error) {
                console.error('Error en listener de estado:', error);
            }
        });
    }

    /**
     * Comparación superficial entre objetos
     */
    #shallowEqual(objA, objB) {
        if (objA === objB) return true;

        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) return false;

        return keysA.every(key => objA[key] === objB[key]);
    }

    // ========== MÉTODOS DE UTILIDAD ==========

    setCurrentUser(user) {
        this.update(state => {
            state.currentUser = user;
            state.isAuthenticated = !!user;
        });
    }

    clearAuth() {
        this.update(state => {
            state.currentUser = null;
            state.isAuthenticated = false;
            state.currentChat = null;
            state.isWebSocketConnected = false;
            state.websocket = null;
            state.reconnectAttempts = 0;
            state.activeContextMenuChat = null;
            state.activeContextMenuContact = null;
            state.replyingToMessage = null;
            state.activeContextMenuMessage = null;
        });
    }

    setCurrentChat(chat) {
        this.update(state => {
            state.currentChat = chat;
        });
    }

    setWebSocketState(connected, websocket = null) {
        this.update(state => {
            state.isWebSocketConnected = connected;
            state.websocket = websocket;
            state.reconnectAttempts = connected ? 0 : state.reconnectAttempts;
        });
    }

    incrementReconnectAttempts() {
        this.update(state => {
            state.reconnectAttempts = state.reconnectAttempts + 1;
        });
    }

    resetReconnectAttempts() {
        this.update(state => {
            state.reconnectAttempts = 0;
        });
    }

    setReplyingToMessage(message) {
        this.update(state => {
            state.replyingToMessage = message;
        });
    }

    clearReplyingToMessage() {
        this.update(state => {
            state.replyingToMessage = null;
        });
    }

    setActiveContextMenuChat(chat) {
        this.update(state => {
            state.activeContextMenuChat = chat;
        });
    }

    setActiveContextMenuContact(contact) {
        this.update(state => {
            state.activeContextMenuContact = contact;
        });
    }

    setActiveContextMenuMessage(message) {
        this.update(state => {
            state.activeContextMenuMessage = message;
        });
    }

    clearAllContextMenus() {
        this.update(state => {
            state.activeContextMenuChat = null;
            state.activeContextMenuContact = null;
            state.activeContextMenuMessage = null;
        });
    }

    /**
     * Obtiene una propiedad específica del estado
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Verifica si una propiedad existe
     */
    has(key) {
        return key in this.state;
    }

    /**
     * Destruye la instancia
     */
    destroy() {
        this.listeners.clear();
    }
}

// Crear instancia global única
const stateManager = new AppState();

// Para desarrollo: exponer para debugging
if (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'foxia.duckdns.org') {
    window.foxiaStateManager = stateManager;
}

export default stateManager;
