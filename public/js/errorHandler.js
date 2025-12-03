// errorHandler.js - Estrategia unificada de manejo de errores
class ErrorHandler {
    static handle(error, context, metadata = {}) {
        const errorInfo = this.normalizeError(error, context, metadata);

        // Log para desarrollo
        this.logError(errorInfo);

        // Mostrar al usuario según tipo de error
        this.showUserFriendlyMessage(errorInfo);

        // Métricas y reporting
        this.reportError(errorInfo);

        // Recovery automático cuando sea posible
        return this.attemptRecovery(errorInfo);
    }

    static normalizeError(error, context, metadata) {
        let normalizedError = {
            message: error.message || 'Error desconocido',
            stack: error.stack,
            code: error.code || 'UNKNOWN',
            status: error.status || 0,
            context: context,
            timestamp: new Date().toISOString(),
            metadata: metadata,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Para APIError, extraer detalles adicionales
        if (error.name === 'APIError') {
            normalizedError = {
                ...normalizedError,
                code: error.code,
                status: error.status,
                details: error.details
            };
        }

        return normalizedError;
    }

    static logError(errorInfo) {
        const logMessage = `💥 [${errorInfo.context}] ${errorInfo.code}: ${errorInfo.message}`;

        if (errorInfo.code === 'NETWORK_ERROR' || errorInfo.status >= 500) {
            console.error(logMessage, errorInfo);
        } else if (errorInfo.code === 'VALIDATION_ERROR' || errorInfo.status === 400) {
            console.warn(logMessage, errorInfo);
        } else {
            console.error(logMessage, errorInfo);
        }
    }

    static showUserFriendlyMessage(errorInfo) {
        const message = this.getUserMessage(errorInfo);
        const type = this.getNotificationType(errorInfo);

        // Importar dinámicamente para evitar dependencias circulares
        import('./utils.js').then(({ showNotification }) => {
            showNotification(message, type);
        }).catch(() => {
            // Fallback básico si utils no está disponible
            console.log(`[${type.toUpperCase()}] ${message}`);
        });
    }

    static getUserMessage(errorInfo) {
        const messages = {
            'NETWORK_ERROR': 'Error de conexión. Verifica tu internet e intenta nuevamente.',
            'TIMEOUT': 'La operación tardó demasiado tiempo. Intenta nuevamente.',
            'UNAUTHORIZED': 'Tu sesión expiró. Por favor, inicia sesión nuevamente.',
            'FORBIDDEN': 'No tienes permisos para realizar esta acción.',
            'NOT_FOUND': 'El recurso solicitado no existe.',
            'VALIDATION_ERROR': 'Datos inválidos. Verifica la información e intenta nuevamente.',
            'TOO_MANY_REQUESTS': 'Demasiadas solicitudes. Por favor, espera un momento.',
            'SERVICE_UNAVAILABLE': 'El servicio no está disponible temporalmente. Intenta más tarde.',
            'WEBSOCKET_MAX_RECONNECT': 'No se pudo conectar al servidor. Recarga la página para intentar nuevamente.',
            'DEFAULT': 'Ocurrió un error inesperado. Por favor, intenta nuevamente.'
        };

        return messages[errorInfo.code] || messages.DEFAULT;
    }

    static getNotificationType(errorInfo) {
        const errorTypes = {
            'error': ['NETWORK_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'SERVICE_UNAVAILABLE', 'WEBSOCKET_MAX_RECONNECT'],
            'warning': ['TIMEOUT', 'VALIDATION_ERROR', 'TOO_MANY_REQUESTS', 'NOT_FOUND'],
            'info': ['DEFAULT']
        };

        for (const [type, codes] of Object.entries(errorTypes)) {
            if (codes.includes(errorInfo.code)) {
                return type;
            }
        }

        return 'error';
    }

    static reportError(errorInfo) {
        // En producción, enviar a servicio de logging
        if (window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            this.sendToLoggingService(errorInfo);
        }
    }

    static sendToLoggingService(errorInfo) {
        try {
            // Ejemplo con fetch (implementar según tu servicio de logging)
            fetch('/api/logs/error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...errorInfo,
                    // No enviar stack completo en producción por seguridad
                    stack: errorInfo.stack ? errorInfo.stack.substring(0, 200) : ''
                })
            }).catch(() => {
                // Silenciar errores de logging para evitar bucles
            });
        } catch (e) {
            // Silenciar errores de logging
        }
    }

    static attemptRecovery(errorInfo) {
        const recoveryStrategies = {
            'UNAUTHORIZED': () => this.handleAuthError(),
            'NETWORK_ERROR': () => this.handleNetworkError(),
            'WEBSOCKET_MAX_RECONNECT': () => this.handleWebSocketReconnect(),
            'DEFAULT': () => this.handleDefaultError()
        };

        const strategy = recoveryStrategies[errorInfo.code] || recoveryStrategies.DEFAULT;
        return strategy(errorInfo);
    }

    static handleAuthError() {
        // Forzar logout y redirigir a login
        import('./auth.js').then(({ handleLogout }) => {
            handleLogout();
        }).catch(() => {
            // Fallback básico
            window.location.reload();
        });
    }

    static handleNetworkError() {
        // Intentar reconectar WebSocket después de un delay
        setTimeout(() => {
            import('./websocket.js').then(({ connectWebSocket }) => {
                connectWebSocket();
            });
        }, 5000);
    }

    static handleWebSocketReconnect() {
        // Ofrecer recargar página
        if (confirm('No se pudo conectar al servidor. ¿Quieres recargar la página?')) {
            window.location.reload();
        }
    }

    static handleDefaultError() {
        // No hacer nada por defecto
        return false;
    }

    // Métodos de utilidad para tipos comunes de errores
    static handleAPIError(error, context, metadata = {}) {
        return this.handle(error, context, metadata);
    }

    static handleNetworkError(context, metadata = {}) {
        const error = new Error('Error de conexión de red');
        error.code = 'NETWORK_ERROR';
        return this.handle(error, context, metadata);
    }

    static handleTimeout(context, metadata = {}) {
        const error = new Error('Timeout de la operación');
        error.code = 'TIMEOUT';
        return this.handle(error, context, metadata);
    }
}

export default ErrorHandler;
