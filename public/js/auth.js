// auth.js - Funciones de autenticación ACTUALIZADO con manejo unificado de errores
import stateManager from './stateManager.js';
import { apiCall, setCookie, deleteCookie, getCookie } from './api.js';
import { APIError } from './apiError.js';
import {
    showNotification,
    showPanel,
    fetchChats,
    updateProfileInfo,
    showApp,
    showAuthScreen,
    elements
} from './ui.js';
import { displayAvatar } from './utils.js';
import { connectWebSocket } from './websocket.js';
import ErrorHandler from './errorHandler.js';

export async function checkAuthStatus() {
    const token = getCookie('auth_token');
    if (token) {
        try {
            const data = await apiCall('/api/user/profile');

            // CORRECCIÓN: Usar setCurrentUser correctamente
            stateManager.setCurrentUser(data.profile || data.user || data);

            showApp();
            fetchChats();
            // Cargar contactos
            import('./contactsUI.js').then(({ fetchContacts }) => fetchContacts());
            updateProfileInfo();

            if (elements.connectionStatus) {
                elements.connectionStatus.textContent = 'Conectado';
                elements.connectionStatus.style.color = 'var(--success)';
            }

            // ✅ CORRECCIÓN: Conectar WebSocket de forma controlada
            setTimeout(() => {
                connectWebSocket().catch(error => {
                    console.warn('⚠️ WebSocket no pudo conectarse:', error);
                    // No mostrar error al usuario, es opcional
                });
            }, 500);

        } catch (error) {
            console.error('Error validating token:', error);
            await handleAuthError(error, 'validando token');
            deleteCookie('auth_token');
            showAuthScreen();
        }
    } else {
        showAuthScreen();
    }
}

export async function handleLogin() {
    const email = elements.loginEmail ? elements.loginEmail.value.trim() : '';
    const password = elements.loginPassword ? elements.loginPassword.value.trim() : '';

    if (!email || !password) {
        showAuthError('Por favor, completa todos los campos.', 'warning');
        return;
    }

    try {
        // Mostrar estado de carga
        if (elements.loginBtn) {
            elements.loginBtn.disabled = true;
            elements.loginBtn.textContent = 'Iniciando sesión...';
        }

        const data = await apiCall('/api/auth/login', {
            method: 'POST',
            body: { email, password },
            timeout: 10000 // 10 segundos para login
        });

        setCookie('auth_token', data.token);

        // CORRECCIÓN: Usar setCurrentUser correctamente
        stateManager.setCurrentUser(data.user);

        showApp();
        fetchChats();
        // Cargar contactos
        import('./contactsUI.js').then(({ fetchContacts }) => fetchContacts());
        updateProfileInfo();

        if (elements.connectionStatus) {
            elements.connectionStatus.textContent = 'Conectado';
            elements.connectionStatus.style.color = 'var(--success)';
        }

        showNotification('¡Sesión iniciada correctamente!', 'success');

        // ✅ CORRECCIÓN: Conectar WebSocket de forma controlada
        setTimeout(() => {
            connectWebSocket().catch(error => {
                console.warn('⚠️ WebSocket no pudo conectarse:', error);
                // No es crítico para el login
            });
        }, 500);

    } catch (error) {
        await handleAuthError(error, 'iniciando sesión');
    } finally {
        // Restaurar botón
        if (elements.loginBtn) {
            elements.loginBtn.disabled = false;
            elements.loginBtn.textContent = 'Entrar';
        }
    }
}

export async function handleRegister() {
    const username = elements.registerUsername ? elements.registerUsername.value.trim() : '';
    const email = elements.registerEmail ? elements.registerEmail.value.trim() : '';
    const password = elements.registerPassword ? elements.registerPassword.value.trim() : '';

    if (!username || !email || !password) {
        showAuthError('Por favor, completa todos los campos.', 'warning');
        return;
    }

    if (password.length < 8) {
        showAuthError('La contraseña debe tener al menos 8 caracteres.', 'warning');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError('Por favor, ingresa un email válido.', 'warning');
        return;
    }

    try {
        // Mostrar estado de carga
        if (elements.registerBtn) {
            elements.registerBtn.disabled = true;
            elements.registerBtn.textContent = 'Registrando...';
        }

        const data = await apiCall('/api/auth/register', {
            method: 'POST',
            body: { name: username, email, password },
            timeout: 15000 // 15 segundos para registro
        });

        showNotification('¡Registro exitoso! Por favor verifica tu email antes de iniciar sesión.', 'success');
        showLoginForm();

    } catch (error) {
        await handleAuthError(error, 'registrando usuario');
    } finally {
        // Restaurar botón
        if (elements.registerBtn) {
            elements.registerBtn.disabled = false;
            elements.registerBtn.textContent = 'Registrarse';
        }
    }
}

export function handleLogout() {
    console.log('🚀 EJECUTANDO handleLogout');

    const state = stateManager.getState();
    console.log('📊 Estado antes del logout:', {
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser ? state.currentUser.email : 'null',
        websocket: state.websocket ? 'presente' : 'null'
    });

    // Limpiar WebSocket de forma segura
    if (state.websocket) {
        try {
            if (state.websocket.readyState === WebSocket.OPEN) {
                state.websocket.close(1000, 'Logout normal');
                console.log('🔌 WebSocket cerrado');
            }
        } catch (error) {
            console.warn('⚠️ Error cerrando WebSocket:', error);
        }
    }

    // Limpiar cookies
    try {
        deleteCookie('auth_token');
        console.log('🍪 Cookie auth_token eliminada');
    } catch (error) {
        console.warn('⚠️ Error eliminando cookie:', error);
    }

    // CORRECCIÓN: Usar clearAuth correctamente
    stateManager.clearAuth();
    console.log('🗑️ Estado limpiado');

    // Mostrar notificación
    try {
        showNotification('Sesión cerrada correctamente', 'success');
        console.log('📢 Notificación mostrada');
    } catch (error) {
        console.warn('⚠️ Error mostrando notificación:', error);
    }

    // Redirigir
    try {
        showAuthScreen();
        console.log('🔄 Redirigido a pantalla de auth');
    } catch (error) {
        console.warn('⚠️ Error redirigiendo:', error);
        // Forzar redirección
        if (elements.authScreen) elements.authScreen.classList.remove('hidden');
        if (elements.appContainer) elements.appContainer.classList.add('hidden');
    }

    console.log('🎉 Logout completado');
}

export function showLoginForm() {
    if (elements.registerForm) elements.registerForm.classList.add('hidden');
    if (elements.loginForm) elements.loginForm.classList.remove('hidden');
    clearAuthErrors();
}

export function showRegisterForm() {
    if (elements.loginForm) elements.loginForm.classList.add('hidden');
    if (elements.registerForm) elements.registerForm.classList.remove('hidden');
    clearAuthErrors();
}

/**
 * ✅ CORRECCIÓN: Maneja errores de autenticación usando el manejador unificado
 */
async function handleAuthError(error, context = '') {
    // ✅ Usar el manejador unificado de errores
    ErrorHandler.handle(error, `auth_${context}`);

    // ✅ Mantener lógica específica de UI para formularios
    if (error instanceof APIError) {
        switch (error.code) {
            case 'UNAUTHORIZED':
                showAuthError('Email o contraseña incorrectos.', 'error');
                break;

            case 'VALIDATION_ERROR':
                showAuthError(error.details?.message || 'Datos inválidos.', 'error');
                break;

            case 'CONFLICT':
                showAuthError('Este email ya está registrado.', 'error');
                break;

            default:
                showAuthError(error.message, 'error');
        }
    } else {
        showAuthError('Error inesperado. Intenta nuevamente.', 'error');
    }
}

/**
 * Muestra errores en los formularios de autenticación
 */
function showAuthError(message, type = 'error') {
    const errorElement = elements.loginErrorMessage || elements.registerErrorMessage;
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.color = type === 'error' ? 'var(--danger)' : 'var(--warning)';
    }

    // También mostrar notificación para errores importantes
    if (type === 'error' && !message.includes('correctos')) {
        showNotification(message, type);
    }
}

/**
 * Limpia los mensajes de error
 */
function clearAuthErrors() {
    if (elements.loginErrorMessage) elements.loginErrorMessage.textContent = '';
    if (elements.registerErrorMessage) elements.registerErrorMessage.textContent = '';
}

/**
 * Valida formato de email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
