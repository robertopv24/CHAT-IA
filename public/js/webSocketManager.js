// webSocketManager.js - Gestión robusta de conexiones WebSocket
import { APIError } from './apiError.js';

export class WebSocketManager {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            reconnectDelay: options.reconnectDelay || 3000,
            maxReconnectDelay: options.maxReconnectDelay || 30000,
            heartbeatInterval: options.heartbeatInterval || 30000,
            timeout: options.timeout || 10000,
            ...options
        };

        this.ws = null;
        this.isConnecting = false;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
        this.heartbeatInterval = null;
        this.connectionTimeout = null;

        // Event listeners
        this.messageHandlers = new Map();
        this.openHandlers = new Set();
        this.closeHandlers = new Set();
        this.errorHandlers = new Set();

        // Bind methods
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleError = this.handleError.bind(this);
    }

    /**
     * Conecta al WebSocket de forma segura
     */
    connect() {
        if (this.isConnecting) {
            console.warn('⚠️ WebSocket ya está en proceso de conexión');
            return false;
        }

        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket ya está conectado');
            return true;
        }

        // Limpiar conexión anterior si existe
        this.cleanup();

        this.isConnecting = true;
        console.log(`🔗 Conectando a WebSocket: ${this.url}`);

        try {
            this.ws = new WebSocket(this.url);
            this.setupEventListeners();
            this.startConnectionTimeout();
            return true;
        } catch (error) {
            console.error('❌ Error creando WebSocket:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
            return false;
        }
    }

    /**
     * Configura los event listeners del WebSocket
     */
    setupEventListeners() {
        if (!this.ws) return;

        this.ws.addEventListener('open', this.handleOpen);
        this.ws.addEventListener('message', this.handleMessage);
        this.ws.addEventListener('close', this.handleClose);
        this.ws.addEventListener('error', this.handleError);
    }

    /**
     * Maneja el evento de apertura de conexión
     */
    handleOpen(event) {
        console.log('✅ Conexión WebSocket establecida', event);

        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;

        this.clearConnectionTimeout();
        this.startHeartbeat();

        // Notificar a todos los handlers de apertura
        this.openHandlers.forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                console.error('Error en open handler:', error);
            }
        });
    }

    /**
     * Maneja los mensajes entrantes
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Mensaje WebSocket recibido:', data);

            // Ejecutar handlers específicos por tipo
            if (data.type && this.messageHandlers.has(data.type)) {
                this.messageHandlers.get(data.type).forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error(`Error en handler para ${data.type}:`, error);
                    }
                });
            }

            // Ejecutar handlers globales
            if (this.messageHandlers.has('*')) {
                this.messageHandlers.get('*').forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error('Error en handler global:', error);
                    }
                });
            }

        } catch (error) {
            console.error('❌ Error parseando mensaje WebSocket:', error, event.data);
        }
    }

    /**
     * Maneja el cierre de conexión
     */
    handleClose(event) {
        console.log('🔌 WebSocket cerrado:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        this.isConnecting = false;
        this.isConnected = false;
        this.clearConnectionTimeout();
        this.clearHeartbeat();

        // Notificar a los handlers de cierre
        this.closeHandlers.forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                console.error('Error en close handler:', error);
            }
        });

        // Reconectar si no fue un cierre limpio o manual
        if (event.code !== 1000 && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    /**
     * Maneja errores de conexión
     */
    handleError(error) {
        console.error('❌ Error WebSocket:', error);

        this.isConnecting = false;
        this.clearConnectionTimeout();

        // Notificar a los handlers de error
        this.errorHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (error) {
                console.error('Error en error handler:', error);
            }
        });

        // Programar reconexión si no está conectado
        if (!this.isConnected) {
            this.scheduleReconnect();
        }
    }

    /**
     * Programa la reconexión con backoff exponencial
     */
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.error('❌ Máximo de reconexiones alcanzado');

            this.errorHandlers.forEach(handler => {
                try {
                    handler(new APIError(
                        'No se pudo reconectar al servidor después de múltiples intentos',
                        0,
                        'WEBSOCKET_MAX_RECONNECT'
                    ));
                } catch (error) {
                    console.error('Error en error handler de máxima reconexión:', error);
                }
            });

            return;
        }

        this.reconnectAttempts++;

        const delay = Math.min(
            this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.options.maxReconnectDelay
        );

        console.log(`🔄 Reconexión ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} en ${delay}ms...`);

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Inicia el timeout de conexión
     */
    startConnectionTimeout() {
        this.connectionTimeout = setTimeout(() => {
            if (this.isConnecting) {
                console.error('⏰ Timeout de conexión WebSocket');
                this.cleanup();
                this.scheduleReconnect();
            }
        }, this.options.timeout);
    }

    /**
     * Limpia el timeout de conexión
     */
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    /**
     * Inicia el heartbeat para mantener la conexión activa
     */
    startHeartbeat() {
        this.clearHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping' });
            }
        }, this.options.heartbeatInterval);
    }

    /**
     * Limpia el intervalo de heartbeat
     */
    clearHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Envía un mensaje a través del WebSocket
     */
    send(data) {
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                this.ws.send(message);
                return true;
            } catch (error) {
                console.error('❌ Error enviando mensaje WebSocket:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket no conectado. No se puede enviar mensaje.');
            return false;
        }
    }

    /**
     * Registra un handler para tipos específicos de mensajes
     */
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, new Set());
        }
        this.messageHandlers.get(type).add(handler);

        // Retornar función para remover el handler
        return () => {
            if (this.messageHandlers.has(type)) {
                this.messageHandlers.get(type).delete(handler);
            }
        };
    }

    /**
     * Registra un handler para eventos de apertura
     */
    onOpen(handler) {
        this.openHandlers.add(handler);
        return () => this.openHandlers.delete(handler);
    }

    /**
     * Registra un handler para eventos de cierre
     */
    onClose(handler) {
        this.closeHandlers.add(handler);
        return () => this.closeHandlers.delete(handler);
    }

    /**
     * Registra un handler para eventos de error
     */
    onError(handler) {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    /**
     * Desconecta el WebSocket de forma limpia
     */
    disconnect(code = 1000, reason = 'Desconexión manual') {
        console.log('🔌 Desconectando WebSocket...');

        this.cleanup();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(code, reason);
        }

        this.ws = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }

    /**
     * CORRECCIÓN: Limpia todos los timeouts, intervalos y event listeners
     */
    cleanup() {
        this.clearConnectionTimeout();
        this.clearHeartbeat();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // CORRECCIÓN: Remover event listeners del WebSocket anterior de forma segura
        if (this.ws) {
            try {
                this.ws.removeEventListener('open', this.handleOpen);
                this.ws.removeEventListener('message', this.handleMessage);
                this.ws.removeEventListener('close', this.handleClose);
                this.ws.removeEventListener('error', this.handleError);
            } catch (error) {
                console.warn('⚠️ Error removiendo event listeners:', error);
            }
        }

        // NOTA: No limpiar los handlers aquí, ya que se registran antes de llamar a connect()
    }

    /**
     * Obtiene el estado actual de la conexión
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.options.maxReconnectAttempts,
            readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
            url: this.url,
            handlers: {
                message: this.messageHandlers.size,
                open: this.openHandlers.size,
                close: this.closeHandlers.size,
                error: this.errorHandlers.size
            }
        };
    }

    /**
     * Reinicia el contador de reconexiones (útil después de recuperar conexión)
     */
    resetReconnectAttempts() {
        this.reconnectAttempts = 0;
    }

    /**
     * Actualiza la URL de conexión
     */
    updateUrl(newUrl) {
        if (newUrl !== this.url) {
            this.url = newUrl;
            // Reconectar si estaba conectado
            if (this.isConnected || this.isConnecting) {
                this.disconnect();
                setTimeout(() => this.connect(), 1000);
            }
        }
    }

    /**
     * Destruye la instancia y limpia todos los recursos
     */
    destroy() {
        console.log('🗑️ Destruyendo WebSocketManager...');
        this.disconnect();

        // CORRECCIÓN: Limpieza completa de todos los recursos
        this.cleanup();

        // Limpiar referencias
        this.messageHandlers = null;
        this.openHandlers = null;
        this.closeHandlers = null;
        this.errorHandlers = null;
        this.ws = null;

        console.log('✅ WebSocketManager destruido completamente');
    }
}
