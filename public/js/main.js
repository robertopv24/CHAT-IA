// main.js - Asegurar que la inicialización de UI sea robusta
import stateManager from './stateManager.js';
import { checkAuthStatus } from './auth.js';
import { setupEventListeners } from './eventListeners/index.js';
import { setWelcomeMessageTime } from './utils.js';
import { EmojiService } from './emojiService.js';

// Importar elements directamente
import { elements } from './elements.js';

class AppInitializer {
    constructor() {
        this.initialized = false;
        this.initializationPhases = [
            { name: 'security', method: this.initializeSecurity.bind(this) },
            { name: 'libraries', method: this.initializeLibraries.bind(this) },
            { name: 'state', method: this.initializeState.bind(this) },
            { name: 'services', method: this.initializeServices.bind(this) },
            { name: 'ui', method: this.initializeUI.bind(this) },
            { name: 'auth', method: this.initializeAuth.bind(this) }
        ];
    }

    async initialize() {
        if (this.initialized) {
            console.warn('⚠️ La aplicación ya está inicializada');
            return;
        }

        console.log('🚀 Iniciando aplicación FoxIA...');

        try {
            // Ejecutar fases en secuencia
            for (const phase of this.initializationPhases) {
                console.log(`🔧 Ejecutando fase: ${phase.name}...`);
                await phase.method();
            }

            this.initialized = true;
            console.log('✅ Aplicación FoxIA inicializada correctamente');

        } catch (error) {
            console.error('❌ Error en inicialización:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeSecurity() {
        console.log('🛡️ Inicializando seguridad...');

        // Verificar dependencias críticas de seguridad
        const securityDeps = {
            DOMPurify: typeof DOMPurify !== 'undefined',
            marked: typeof marked !== 'undefined',
            hljs: typeof hljs !== 'undefined'
        };

        const missingDeps = Object.entries(securityDeps)
            .filter(([_, available]) => !available)
            .map(([name]) => name);

        if (missingDeps.length > 0) {
            throw new Error(`Dependencias de seguridad faltantes: ${missingDeps.join(', ')}`);
        }

        // Configurar marked con sanitización
        marked.setOptions({
            breaks: true,
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('Error highlighting code:', e);
                        return hljs.highlightAuto(code).value;
                    }
                }
                return hljs.highlightAuto(code).value;
            },
            sanitizer: DOMPurify.sanitize
        });

        console.log('✅ Seguridad inicializada correctamente');
    }

    async initializeLibraries() {
        console.log('📚 Inicializando librerías...');

        // Verificar que KaTeX esté disponible
        if (typeof renderMathInElement === 'undefined') {
            console.warn('⚠️ KaTeX no disponible - matemáticas no se renderizarán');
        }

        // Configurar opciones globales de KaTeX
        window.katexRenderOptions = window.katexRenderOptions || {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\(", right: "\\)", display: false},
                {left: "\\[", right: "\\]", display: true}
            ],
            throwOnError: false
        };

        console.log('✅ Librerías inicializadas correctamente');
    }

    async initializeState() {
        console.log('🏗️ Inicializando estado...');

        // Inicializar estado mínimo necesario
        stateManager.update(state => {
            state.hostname = window.location.hostname;
            state.apiBaseUrl = window.location.origin + '/public';
            state.isLocalhost = this.isLocalhost();
        });

        console.log('✅ Estado inicializado correctamente');
    }

    async initializeServices() {
        console.log('⚙️ Inicializando servicios...');

        // Inicializar servicios en orden
        this.emojiService = new EmojiService();

        // Verificar que los servicios se inicialicen correctamente
        const emojiStatus = this.emojiService.getStatus();
        if (!emojiStatus.isInitialized) {
            throw new Error('EmojiService no se pudo inicializar');
        }

        console.log('✅ Servicios inicializados correctamente');
    }

    async initializeUI() {
        console.log('🎨 Inicializando UI...');

        try {
            // Validar elementos críticos del DOM
            const criticalElements = [
                'authScreen', 'appContainer', 'chatsList', 'messagesContainer',
                'messageInput', 'chatPanel', 'chatsPanel'
            ];

            const missingElements = criticalElements.filter(key => !elements[key]);
            if (missingElements.length > 0) {
                console.warn('⚠️ Elementos críticos faltantes:', missingElements);
                // No lanzar error, continuar con los elementos disponibles
            }

            // Configurar UI básica
            setWelcomeMessageTime();

            // Configurar event listeners
            await setupEventListeners();

            console.log('✅ UI inicializada correctamente');
        } catch (error) {
            console.error('❌ Error en inicialización de UI:', error);
            throw error; // Re-lanzar para manejo en fase principal
        }
    }

    async initializeAuth() {
        console.log('🔐 Inicializando autenticación...');

        // Verificar autenticación como último paso
        await checkAuthStatus();

        console.log('✅ Autenticación inicializada correctamente');
    }

    isLocalhost() {
        return window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname === 'foxia.duckdns.org';
    }

    handleInitializationError(error) {
        console.error('💥 Error crítico en inicialización:', error);

        // Mostrar error al usuario de forma amigable
        const errorMessage = `Error al inicializar la aplicación: ${error.message}`;

        if (elements.notification) {
            elements.notification.textContent = errorMessage;
            elements.notification.className = 'notification error';
            elements.notification.classList.remove('hidden');
        }

        // Forzar pantalla de auth como fallback
        if (elements.authScreen) {
            elements.authScreen.classList.remove('hidden');
        }
        if (elements.appContainer) {
            elements.appContainer.classList.add('hidden');
        }

        // Log adicional para debugging
        setTimeout(() => {
            console.error('📋 Estado durante el error:', {
                elements: {
                    authScreen: !!elements.authScreen,
                    appContainer: !!elements.appContainer,
                    notification: !!elements.notification
                },
                libraries: {
                    DOMPurify: typeof DOMPurify,
                    marked: typeof marked,
                    hljs: typeof hljs
                }
            });
        }, 100);
    }
}

// ========== INICIALIZACIÓN CONTROLADA ==========

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    console.log('📄 DOM cargado, iniciando aplicación...');

    const appInitializer = new AppInitializer();
    appInitializer.initialize().catch(error => {
        console.error('❌ Error fatal en inicialización:', error);
    });
});

// ========== DIAGNÓSTICO Y UTILIDADES ==========

// Variables globales para servicios
let emojiService = null;

/**
 * Diagnóstico en tiempo real
 */
export function diagnoseRealTimeIssues() {
    const state = stateManager.getState();

    console.log('🔍 DIAGNÓSTICO DE TIEMPO REAL:');
    console.log('- Usuario autenticado:', state.isAuthenticated);
    console.log('- WebSocket conectado:', state.isWebSocketConnected);
    console.log('- Estado WebSocket:', state.websocket ? state.websocket.readyState : 'No inicializado');
    console.log('- Chat actual:', state.currentChat ? state.currentChat.uuid : 'Ninguno');
    console.log('- EmojiService:', emojiService ? emojiService.getStatus() : 'No inicializado');

    // Diagnóstico de elementos críticos
    console.log('🔍 ELEMENTOS CRÍTICOS:');
    console.log('- messagesContainer:', !!elements.messagesContainer);
    console.log('- messageInput:', !!elements.messageInput);
    console.log('- chatsList:', !!elements.chatsList);

    return {
        auth: state.isAuthenticated,
        websocket: state.isWebSocketConnected,
        currentChat: state.currentChat,
        elements: {
            messagesContainer: !!elements.messagesContainer,
            messageInput: !!elements.messageInput,
            chatsList: !!elements.chatsList
        }
    };
}

/**
 * Verificar estado de seguridad
 */
export function checkSecurityStatus() {
    return {
        DOMPurify: typeof DOMPurify !== 'undefined',
        marked: typeof marked !== 'undefined',
        hljs: typeof hljs !== 'undefined',
        katex: typeof renderMathInElement !== 'undefined',
        timestamp: new Date().toISOString()
    };
}

// Hacer funciones disponibles globalmente para debugging
window.diagnoseFoxIA = diagnoseRealTimeIssues;
window.checkSecurity = checkSecurityStatus;

// Diagnóstico periódico solo en desarrollo
const state = stateManager.getState();
if (state.isLocalhost) {
    setInterval(() => {
        if (state.isAuthenticated) {
            diagnoseRealTimeIssues();
        }
    }, 30000); // Cada 30 segundos
}

// Manejo de errores globales
window.addEventListener('error', function(event) {
    console.error('💥 Error global no capturado:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('💥 Promesa rechazada no capturada:', event.reason);
    event.preventDefault();
});

// Exportar para testing
export { AppInitializer };
