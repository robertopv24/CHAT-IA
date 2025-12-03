// apiError.js - Clase personalizada para errores de API
export class APIError extends Error {
    constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Mantener el stack trace limpio
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, APIError);
        }
    }

    // Métodos de utilidad para tipos comunes de errores
    static badRequest(message, details = null) {
        return new APIError(message, 400, 'BAD_REQUEST', details);
    }

    static unauthorized(message = 'No autorizado') {
        return new APIError(message, 401, 'UNAUTHORIZED');
    }

    static forbidden(message = 'Acceso denegado') {
        return new APIError(message, 403, 'FORBIDDEN');
    }

    static notFound(message = 'Recurso no encontrado') {
        return new APIError(message, 404, 'NOT_FOUND');
    }

    static timeout(message = 'Timeout de la solicitud') {
        return new APIError(message, 408, 'TIMEOUT');
    }

    static conflict(message = 'Conflicto en la solicitud') {
        return new APIError(message, 409, 'CONFLICT');
    }

    static validationError(message = 'Error de validación', details = null) {
        return new APIError(message, 422, 'VALIDATION_ERROR', details);
    }

    static tooManyRequests(message = 'Demasiadas solicitudes') {
        return new APIError(message, 429, 'TOO_MANY_REQUESTS');
    }

    static serverError(message = 'Error interno del servidor') {
        return new APIError(message, 500, 'INTERNAL_SERVER_ERROR');
    }

    static serviceUnavailable(message = 'Servicio no disponible') {
        return new APIError(message, 503, 'SERVICE_UNAVAILABLE');
    }

    static networkError(message = 'Error de conexión') {
        return new APIError(message, 0, 'NETWORK_ERROR');
    }

    // Convertir a objeto para logging o respuesta
    toObject() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    // Verificar tipo de error
    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    isServerError() {
        return this.status >= 500;
    }

    isNetworkError() {
        return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
    }

    isAuthenticationError() {
        return this.status === 401 || this.code === 'UNAUTHORIZED';
    }

    isAuthorizationError() {
        return this.status === 403 || this.code === 'FORBIDDEN';
    }

    // Método para mostrar error de forma amigable
    toUserFriendlyMessage() {
        switch (this.code) {
            case 'NETWORK_ERROR':
                return 'Error de conexión. Verifica tu internet e intenta nuevamente.';

            case 'TIMEOUT':
                return 'La solicitud tardó demasiado tiempo. Intenta nuevamente.';

            case 'UNAUTHORIZED':
                return 'No estás autorizado para realizar esta acción.';

            case 'FORBIDDEN':
                return 'No tienes permisos para acceder a este recurso.';

            case 'NOT_FOUND':
                return 'El recurso solicitado no existe.';

            case 'TOO_MANY_REQUESTS':
                return 'Demasiadas solicitudes. Por favor, espera un momento.';

            case 'VALIDATION_ERROR':
                return this.details?.message || 'Datos inválidos proporcionados.';

            default:
                return this.message || 'Ha ocurrido un error inesperado.';
        }
    }
}

// Función helper para crear errores desde respuestas HTTP
export function createAPIErrorFromResponse(response, data = null) {
    const status = response.status;
    const message = data?.error || data?.message || response.statusText || 'Error desconocido';
    const code = data?.code || getErrorCodeFromStatus(status);
    const details = data?.details || data?.errors || null;

    return new APIError(message, status, code, details);
}

// Función helper para mapear códigos de estado a códigos de error
function getErrorCodeFromStatus(status) {
    const codeMap = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        408: 'TIMEOUT',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'TOO_MANY_REQUESTS',
        500: 'INTERNAL_SERVER_ERROR',
        502: 'BAD_GATEWAY',
        503: 'SERVICE_UNAVAILABLE',
        504: 'GATEWAY_TIMEOUT'
    };

    return codeMap[status] || 'UNKNOWN_ERROR';
}

// Función helper para crear errores desde excepciones de fetch
export function createAPIErrorFromException(error) {
    if (error.name === 'AbortError') {
        return APIError.timeout('La solicitud fue cancelada por timeout');
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return APIError.networkError('Error de conexión de red');
    }

    if (error instanceof APIError) {
        return error;
    }

    return new APIError(error.message || 'Error desconocido');
}

// Función para logging de errores de API
export function logAPIError(error, context = '') {
    if (!(error instanceof APIError)) {
        error = createAPIErrorFromException(error);
    }

    const logData = {
        context,
        error: error.toObject(),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    console.error(`❌ API Error [${context}]:`, logData);

    // En producción, enviar a servicio de logging
    if (window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1') {
        // Aquí podrías enviar a Sentry, LogRocket, etc.
        sendErrorToLoggingService(logData);
    }

    return error;
}

// Función auxiliar para enviar errores a servicio de logging
function sendErrorToLoggingService(logData) {
    try {
        // Ejemplo de implementación con fetch
        fetch('/api/logs/error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData)
        }).catch(() => {
            // Silenciar errores de logging para evitar bucles
        });
    } catch (e) {
        // Silenciar errores de logging
    }
}

// Exportar por defecto
export default {
    APIError,
    createAPIErrorFromResponse,
    createAPIErrorFromException,
    logAPIError
};
