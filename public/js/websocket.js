// websocket.js - Manejo de WebSocket REFACTORIZADO con gestión de estado robusta
import stateManager from './stateManager.js';
import { getCookie } from './api.js';
import { showNotification, updateNotificationBadge, addNotificationToList } from './ui.js';
import { fetchChats, addMessageToChat } from './ui.js';
import { WebSocketManager } from './webSocketManager.js';
import ErrorHandler from './errorHandler.js';

let webSocketManager = null;
// CORRECCIÓN: Estado unificado de conexión
let connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'authenticated', 'reconnecting'

/**
 * Inicializa y conecta el WebSocketManager de forma controlada
 */
export async function connectWebSocket() {
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
        console.log('⚠️ Conexión WebSocket ya en progreso, ignorando...');
        return;
    }

    const state = stateManager.getState();
    if (!state.isAuthenticated || !state.currentUser) {
        console.warn('⚠️ No hay usuario autenticado para conectar WebSocket');
        return;
    }

    connectionState = 'connecting';
    console.log('🔗 Iniciando conexión WebSocket...');

    try {
        await establishWebSocketConnection();
        connectionState = 'connected';
        console.log('✅ Conexión WebSocket establecida correctamente');
    } catch (error) {
        connectionState = 'disconnected';
        console.error('❌ Error conectando WebSocket:', error);
        ErrorHandler.handle(error, 'websocket_connection');
        throw error;
    }
}

/**
 * Establece la conexión WebSocket con timeout y manejo de errores
 */
async function establishWebSocketConnection() {
    // Limpiar conexión anterior si existe
    if (webSocketManager) {
        webSocketManager.disconnect();
        webSocketManager = null;
    }

    const state = stateManager.getState();
    const websocketUrl = `wss://${state.hostname}:4431`;

    console.log(`🔗 Conectando a: ${websocketUrl}`);

    // Configurar opciones del WebSocketManager
    const options = {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        maxReconnectDelay: 30000,
        heartbeatInterval: 30000,
        timeout: 10000
    };

    webSocketManager = new WebSocketManager(websocketUrl, options);

    // Configurar handlers de eventos
    setupWebSocketHandlers();

    return new Promise((resolve, reject) => {
        let unbindOpen, unbindError;

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout de conexión WebSocket (10s)'));
        }, 10000);

        const cleanup = () => {
            console.log('🧹 Limpiando handlers de conexión temporal');
            clearTimeout(timeout);
            if (unbindOpen) unbindOpen();
            if (unbindError) unbindError();
        };

        const openHandler = () => {
            console.log('✅ Handshake de conexión exitoso, resolviendo promesa');
            cleanup();
            resolve();
        };

        const errorHandler = (error) => {
            console.error('❌ Error durante el handshake inicial:', error);
            cleanup();
            reject(error);
        };

        unbindOpen = webSocketManager.onOpen(openHandler);
        unbindError = webSocketManager.onError(errorHandler);

        // Iniciar conexión
        console.log('🚀 Llamando a webSocketManager.connect()...');
        if (!webSocketManager.connect()) {
            cleanup();
            reject(new Error('No se pudo iniciar la conexión WebSocket'));
        }
    });
}

/**
 * Configura todos los handlers de eventos del WebSocket
 */
function setupWebSocketHandlers() {
    if (!webSocketManager) return;

    // Handler para conexión exitosa
    webSocketManager.onOpen(handleWebSocketOpen);

    // Handler para mensajes específicos
    webSocketManager.onMessage('auth_success', handleAuthSuccess);
    webSocketManager.onMessage('auth_error', handleAuthError);
    webSocketManager.onMessage('new_message', handleNewMessage);
    webSocketManager.onMessage('new_notification', handleNewNotification);
    webSocketManager.onMessage('chat_notification', handleChatNotification);
    webSocketManager.onMessage('pong', handlePong);
    webSocketManager.onMessage('error', handleWebSocketError);

    // Handler global para logging
    webSocketManager.onMessage('*', (data) => {
        if (!['pong'].includes(data.type)) {
            console.log('📨 Mensaje WebSocket recibido:', data);
        }
    });

    // Handler para cierre de conexión
    webSocketManager.onClose(handleWebSocketClose);

    // Handler para errores de conexión
    webSocketManager.onError(handleWebSocketError);
}

/**
 * Maneja la apertura exitosa de la conexión
 */
function handleWebSocketOpen(event) {
    console.log('⚡ [WS DEBUG] Conexión física establecida. Iniciando autenticación...');

    connectionState = 'connected';
    stateManager.setWebSocketState(true, webSocketManager.ws);

    if (document.getElementById('connection-status')) {
        document.getElementById('connection-status').textContent = 'Autenticando...';
        document.getElementById('connection-status').style.color = 'var(--warning)';
    }

    // Autenticar inmediatamente
    authenticateWebSocket();
}

/**
 * Autentica el WebSocket con el servidor
 */
function authenticateWebSocket() {
    console.log('🔐 [WS DEBUG] Preparando mensaje de autenticación...');
    const token = getCookie('auth_token');
    const currentState = stateManager.getState();

    if (token && currentState.currentUser) {
        const authMessage = {
            type: 'auth',
            token: token
        };

        console.log('🚀 [WS DEBUG] Enviando mensaje auth al servidor...');
        if (webSocketManager.send(authMessage)) {
            console.log('✅ [WS DEBUG] Mensaje auth enviado!');
        } else {
            console.error('❌ [WS DEBUG] Falló el envío del mensaje auth');
            ErrorHandler.handleNetworkError('websocket_auth_send');
        }
    } else {
        console.warn('⚠️ [WS DEBUG] No se pudo autenticar: Token o Usuario faltante', {
            hasToken: !!token,
            hasUser: !!currentState.currentUser
        });
    }
}

/**
 * Maneja éxito de autenticación
 */
function handleAuthSuccess(data) {
    console.log('✅ [WS DEBUG] Autenticación WebSocket exitosa confirmada por servidor');
    connectionState = 'authenticated';

    if (document.getElementById('connection-status')) {
        document.getElementById('connection-status').textContent = 'Conectado (Autenticado)';
        document.getElementById('connection-status').style.color = 'var(--success)';
    }

    showNotification('Conexión en tiempo real activada', 'success');

    // Suscribirse a chats que ya están en el DOM
    const chatUuids = Array.from(document.querySelectorAll('.chat-item'))
        .map(item => item.dataset.uuid)
        .filter(uuid => uuid);

    if (chatUuids.length > 0) {
        console.log(`📡 [WS DEBUG] Suscribiendo automáticamente a ${chatUuids.length} chats existentes`);
        chatUuids.forEach(uuid => subscribeToChat(uuid));
    }

    // Suscribirse al chat actual si existe
    const state = stateManager.getState();
    if (state.currentChat) {
        subscribeToChat(state.currentChat.uuid);
    }
}

/**
 * Maneja error de autenticación
 */
function handleAuthError(data) {
    console.error('❌ Error de autenticación WebSocket:', data.message);

    ErrorHandler.handle(
        new Error(data.message || 'Error de autenticación WebSocket'),
        'websocket_auth',
        { code: 'AUTH_ERROR' }
    );
}

/**
 * Maneja nuevo mensaje
 */
function handleNewMessage(data) {
    console.log('💬 [WS DEBUG] Nuevo mensaje recibido:', data);

    const messageChatUuid = data.chat_uuid;
    const state = stateManager.getState();
    const currentChat = state.currentChat;
    const currentChatUuid = currentChat ? currentChat.uuid : null;
    const isForCurrentChat = currentChatUuid && messageChatUuid === currentChatUuid;

    console.log('💬 [WS DEBUG] Inspección de estado:', {
        recibidoUuid: messageChatUuid,
        actualUuid: currentChatUuid,
        chatActualObjeto: currentChat,
        esParaEsteChat: isForCurrentChat
    });

    if (messageChatUuid) {
        // Actualizar la lista de chats siempre
        fetchChats();

        // Si es para el chat actual, mostrar el mensaje
        if (isForCurrentChat) {
            addMessageToChat(data.message, data.is_reply, data.replying_to);

            // Ocultar indicador de "pensando" si es un mensaje de IA
            if (data.message.ai_model && document.getElementById('thinking-container')) {
                document.getElementById('thinking-container').classList.add('hidden');
            }

            scrollToBottom();
        }

        // Siempre mostrar notificación si no es del usuario actual
        if (state.currentUser && data.sender_info && data.sender_info.id != state.currentUser.id) {
            const chatTitle = data.chat_title || 'Chat';
            const senderName = data.sender_info.name || 'Usuario';
            const messagePreview = data.message.content.substring(0, 50) + '...';

            // Mostrar notificación diferente si es respuesta
            if (data.is_reply) {
                showNotification(`📨 ${senderName} respondió en ${chatTitle}: ${messagePreview}`, 'info');
            } else {
                showNotification(`💬 ${senderName} en ${chatTitle}: ${messagePreview}`, 'info');
            }
        }
    }
}

/**
 * Maneja nueva notificación
 */
function handleNewNotification(data) {
    console.log('🔔 Nueva notificación recibida:', data);

    if (data.notification) {
        // Actualizar contador de notificaciones
        updateNotificationBadge(1);

        // Agregar notificación a la lista
        addNotificationToList(data.notification);

        // Mostrar notificación toast si no está en el panel de notificaciones
        if (!isNotificationsPanelActive()) {
            showNotification(data.notification.title, 'info');
        }
    }
}

/**
 * Maneja notificación de chat
 */
function handleChatNotification(data) {
    console.log('🔔 Notificación de chat recibida', data);

    if (data.notification) {
        const notification = data.notification;
        const message = notification.is_reply ?
            `📨 ${notification.sender_name} respondió en ${notification.chat_title}: ${notification.message_preview}` :
            `💬 ${notification.sender_name} en ${notification.chat_title}: ${notification.message_preview}`;

        showNotification(message, 'info');
    }
}

/**
 * Maneja respuesta de ping
 */
function handlePong(data) {
    console.log('🏓 Pong recibido - Conexión activa');
}

/**
 * Maneja errores del WebSocket
 */
function handleWebSocketError(error) {
    console.error('❌ Error WebSocket:', error);

    connectionState = 'disconnected';
    stateManager.setWebSocketState(false);

    if (document.getElementById('connection-status')) {
        document.getElementById('connection-status').textContent = 'Desconectado';
        document.getElementById('connection-status').style.color = 'var(--danger)';
    }

    ErrorHandler.handle(error, 'websocket_error');
}

/**
 * Maneja cierre de conexión
 */
function handleWebSocketClose(event) {
    console.log('🔌 WebSocket cerrado:', event.code, event.reason);

    connectionState = 'disconnected';
    stateManager.setWebSocketState(false);

    if (document.getElementById('connection-status')) {
        document.getElementById('connection-status').textContent = 'Desconectado';
        document.getElementById('connection-status').style.color = 'var(--danger)';
    }

    // No reconectar para cierres limpios (código 1000)
    if (event.code === 1000) {
        console.log('🔌 Cierre limpio del WebSocket');
        return;
    }

    // Reconectar automáticamente para otros cierres
    console.log('🔄 Intentando reconexión automática...');
    connectionState = 'reconnecting';

    setTimeout(() => {
        if (connectionState === 'reconnecting') {
            connectWebSocket().catch(error => {
                console.error('❌ Reconexión automática fallida:', error);
            });
        }
    }, 3000);
}

/**
 * Suscribe a un chat específico
 */
export function subscribeToChat(chatUuid) {
    if (!webSocketManager || !chatUuid) return;

    if (connectionState !== 'authenticated') {
        console.warn(`⏳ [WS DEBUG] Postponiendo suscripción a ${chatUuid}: Esperando autenticación...`);
        // Si ya estamos conectados pero no autenticados, reintentar en un momento
        if (connectionState === 'connected') {
            setTimeout(() => subscribeToChat(chatUuid), 500);
        }
        return;
    }

    const subscribeMessage = {
        type: 'subscribe',
        chat_uuid: chatUuid
    };

    if (webSocketManager.send(subscribeMessage)) {
        console.log(`📡 [WS DEBUG] Suscripción enviada para chat: ${chatUuid}`);
    } else {
        console.error(`❌ No se pudo suscribir al chat: ${chatUuid}`);
        ErrorHandler.handleNetworkError('websocket_subscribe');
    }
}

/**
 * Envía un mensaje a través del WebSocket
 */
export function sendWebSocketMessage(message) {
    if (webSocketManager && webSocketManager.isConnected) {
        return webSocketManager.send(message);
    } else {
        console.warn('⚠️ WebSocket no conectado, no se puede enviar mensaje');
        return false;
    }
}

/**
 * Desconecta el WebSocket de forma limpia
 */
export function disconnectWebSocket() {
    console.log('🔌 Desconectando WebSocket manualmente...');

    connectionState = 'disconnected';

    if (webSocketManager) {
        webSocketManager.disconnect(1000, 'Desconexión manual');
        webSocketManager = null;
        console.log('🔌 WebSocket desconectado manualmente');
    }

    stateManager.setWebSocketState(false);
}

/**
 * Obtiene el estado actual del WebSocket
 */
export function getWebSocketStatus() {
    return {
        connectionState,
        managerStatus: webSocketManager ? webSocketManager.getStatus() : null,
        globalState: stateManager.getState().isWebSocketConnected
    };
}

/**
 * CORRECCIÓN: Función para reconexión manual con protección
 */
export function reconnectWebSocket() {
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
        console.log('⚠️ Reconexión ya en progreso...');
        return;
    }

    console.log('🔄 Reconexión manual solicitada');
    connectWebSocket().catch(error => {
        console.error('❌ Reconexión manual fallida:', error);
    });
}

/**
 * Función para diagnóstico
 */
export function diagnoseWebSocket() {
    const status = getWebSocketStatus();
    console.log('🔍 DIAGNÓSTICO WEBSOCKET:', status);
    return status;
}

/**
 * CORRECCIÓN: Limpiar completamente el WebSocket
 */
export function cleanupWebSocket() {
    console.log('🧹 Limpiando WebSocket...');
    disconnectWebSocket();
    connectionState = 'disconnected';
    console.log('✅ WebSocket limpiado completamente');
}

/**
 * Verifica si el panel de notificaciones está activo
 */
function isNotificationsPanelActive() {
    const notificationsPanel = document.getElementById('notifications-panel');
    return notificationsPanel && notificationsPanel.classList.contains('active');
}

/**
 * Desplaza el contenedor de mensajes al final
 */
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
