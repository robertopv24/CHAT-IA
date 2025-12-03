// api.js - Funciones de API REFACTORIZADAS con manejo unificado de errores
import stateManager from './stateManager.js';
import { APIError, createAPIErrorFromResponse } from './apiError.js';
import ErrorHandler from './errorHandler.js';

// Configuración centralizada
const API_CONFIG = {
    DEFAULT_TIMEOUT: 15000,
    MAX_RETRIES: 2,
    RETRY_DELAY: 1000,
    MAX_CACHE_SIZE: 50,
    CACHE_DURATION: 1000
};

// Cache mejorado con límites
const requestCache = new Map();

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

export function setCookie(name, value, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? 'Secure' : '';
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict; ${secure}`;
}

export function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Realiza una llamada a la API con manejo simplificado de errores
 */
export async function apiCall(endpoint, options = {}) {
    const { apiBaseUrl } = stateManager.getState();
    const url = `${apiBaseUrl}${endpoint}`;

    // Cache solo para GET
    if (options.method === 'GET' || !options.method) {
        const cached = getCachedResponse(url, options.body);
        if (cached) return cached;
    }

    const config = buildRequestConfig(options);

    try {
        const result = await executeRequest(url, config);

        // Cachear respuesta exitosa de GET
        if (config.method === 'GET' && !result.error) {
            cacheResponse(url, options.body, result);
        }

        return result;
    } catch (error) {
        // ✅ CORRECCIÓN: Usar manejador unificado de errores
        ErrorHandler.handle(error, 'api_call', {
            endpoint,
            method: config.method,
            url
        });
        throw error;
    }
}

/**
 * Construye la configuración de la solicitud
 */
function buildRequestConfig(options) {
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        },
        timeout: options.timeout || API_CONFIG.DEFAULT_TIMEOUT,
        retries: options.retries ?? API_CONFIG.MAX_RETRIES,
        ...options
    };

    // Agregar token de autenticación
    const token = getCookie('auth_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Serializar body si es objeto (no FormData)
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        config.body = JSON.stringify(options.body);
    } else {
        config.body = options.body;
    }

    return config;
}

/**
 * Ejecuta la solicitud con reintentos
 */
async function executeRequest(url, config, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
        const response = await fetch(url, {
            method: config.method,
            headers: config.headers,
            body: config.body,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return await processResponse(response);

    } catch (error) {
        clearTimeout(timeoutId);

        // ✅ CORRECCIÓN: Reintentar solo en errores recuperables
        if (shouldRetry(error) && retryCount < config.retries) {
            console.warn(`🔄 Reintento ${retryCount + 1}/${config.retries} para ${url}`);
            await delay(API_CONFIG.RETRY_DELAY * (retryCount + 1));
            return executeRequest(url, config, retryCount + 1);
        }

        throw createAPIError(error);
    }
}

/**
 * Procesa la respuesta HTTP
 */
async function processResponse(response) {
    let data;
    const text = await response.text();

    try {
        data = text ? JSON.parse(text) : {};
    } catch (parseError) {
        if (response.ok) {
            return text;
        }
        throw new APIError(
            'Respuesta no válida del servidor',
            response.status,
            'INVALID_RESPONSE'
        );
    }

    if (!response.ok) {
        throw createAPIErrorFromResponse(response, data);
    }

    return data;
}

/**
 * Gestión de cache
 */
function getCachedResponse(url, body) {
    const cacheKey = generateCacheKey(url, body);
    const cached = requestCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < API_CONFIG.CACHE_DURATION) {
        console.log('📦 Cache hit:', url);
        return cached.data;
    }

    // Limpiar entrada expirada
    if (cached) {
        requestCache.delete(cacheKey);
    }

    return null;
}

function cacheResponse(url, body, data) {
    const cacheKey = generateCacheKey(url, body);

    requestCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });

    // Limpiar cache si excede tamaño máximo
    if (requestCache.size > API_CONFIG.MAX_CACHE_SIZE) {
        const firstKey = requestCache.keys().next().value;
        requestCache.delete(firstKey);
        console.log('🧹 Cache limpiado (límite excedido)');
    }
}

function generateCacheKey(url, body) {
    return `${url}_${JSON.stringify(body || {})}`;
}

/**
 * Utilidades
 */
function shouldRetry(error) {
    return error.name === 'AbortError' ||
           (error.name === 'TypeError' && error.message.includes('fetch'));
}

function createAPIError(error) {
    if (error.name === 'AbortError') {
        return APIError.timeout('La solicitud tardó demasiado tiempo');
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return APIError.networkError('Error de conexión de red');
    }

    if (error instanceof APIError) {
        return error;
    }

    return new APIError(error.message || 'Error desconocido');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Métodos específicos para tipos comunes de solicitudes
 */
export const api = {
    get: (endpoint, options = {}) =>
        apiCall(endpoint, { ...options, method: 'GET' }),

    post: (endpoint, body, options = {}) =>
        apiCall(endpoint, { ...options, method: 'POST', body }),

    put: (endpoint, body, options = {}) =>
        apiCall(endpoint, { ...options, method: 'PUT', body }),

    patch: (endpoint, body, options = {}) =>
        apiCall(endpoint, { ...options, method: 'PATCH', body }),

    delete: (endpoint, options = {}) =>
        apiCall(endpoint, { ...options, method: 'DELETE' })
};

/**
 * Utilidad para verificar el estado de la API
 */
export async function checkAPIHealth() {
    try {
        const response = await apiCall('/api/health', {
            timeout: 5000,
            retries: 1
        });
        return {
            status: 'healthy',
            response,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        // ✅ CORRECCIÓN: No manejar error aquí, dejar que el caller lo maneje
        return {
            status: 'unhealthy',
            error: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Sube un archivo al servidor
 */
export async function apiUploadFile(file, chatUuid, options = {}) {
    const { apiBaseUrl } = stateManager.getState();
    const url = `${apiBaseUrl}/api/chat/upload-file`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('chat_uuid', chatUuid);

    if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
    }

    const config = {
        method: 'POST',
        body: formData,
        timeout: options.timeout || 60000,
        retries: options.retries ?? 1,
        headers: {
            'Accept': 'application/json',
            ...options.headers
        }
    };

    const token = getCookie('auth_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        return await executeRequest(url, config);
    } catch (error) {
        // ✅ CORRECCIÓN: Usar manejador unificado de errores
        ErrorHandler.handle(error, 'api_upload_file', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            chatUuid: chatUuid
        });
        throw error;
    }
}

/**
 * Versión con XMLHttpRequest para progreso real
 */
export function apiUploadFileWithProgress(file, chatUuid, onProgress, options = {}) {
    return new Promise((resolve, reject) => {
        const { apiBaseUrl } = stateManager.getState();
        const url = `${apiBaseUrl}/api/chat/upload-file`;
        const xhr = new XMLHttpRequest();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('chat_uuid', chatUuid);

        if (options.metadata) {
            formData.append('metadata', JSON.stringify(options.metadata));
        }

        // Configurar progreso
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
        }

        // Manejar respuesta
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (error) {
                    const apiError = new APIError('Respuesta no válida del servidor', xhr.status, 'INVALID_RESPONSE');
                    reject(apiError);
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    reject(createAPIErrorFromResponse({ status: xhr.status }, errorData));
                } catch {
                    reject(new APIError(xhr.statusText || 'Error de subida', xhr.status));
                }
            }
        });

        // Manejar errores
        xhr.addEventListener('error', () => {
            reject(new APIError('Error de conexión', 0, 'NETWORK_ERROR'));
        });

        xhr.addEventListener('timeout', () => {
            reject(APIError.timeout(`Timeout de subida (${options.timeout || 60000}ms)`));
        });

        // Configurar timeout
        xhr.timeout = options.timeout || 60000;

        // Abrir y enviar solicitud
        xhr.open('POST', url);

        const token = getCookie('auth_token');
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(formData);
    });
}

/**
 * Limpiar cache de requests
 */
export function clearAPICache() {
    requestCache.clear();
    console.log('🧹 Cache de API limpiado completamente');
}

/**
 * Función para diagnóstico del sistema de API
 */
export function diagnoseAPI() {
    const state = stateManager.getState();

    return {
        baseUrl: state.apiBaseUrl,
        cacheSize: requestCache.size,
        maxCacheSize: API_CONFIG.MAX_CACHE_SIZE,
        isAuthenticated: state.isAuthenticated,
        hasToken: !!getCookie('auth_token'),
        cacheEntries: Array.from(requestCache.entries()).map(([key, value]) => ({
            key: key.substring(0, 50) + '...',
            age: Date.now() - value.timestamp,
            data: value.data
        }))
    };
}

// Limpieza periódica de cache
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of requestCache.entries()) {
        if (now - value.timestamp > API_CONFIG.CACHE_DURATION * 2) {
            requestCache.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Limpiados ${cleaned} entradas de cache expiradas`);
    }
}, API_CONFIG.CACHE_DURATION * 5);
