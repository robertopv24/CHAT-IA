// securityUtils.js - Utilidades de seguridad centralizadas CORREGIDO

/**
 * Configuración de seguridad para DOMPurify
 */
const SECURITY_CONFIG = {
    // Elementos HTML permitidos
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'span',
        'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'div', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],

    // Atributos permitidos
    ALLOWED_ATTR: [
        'class', 'data-language', 'style', 'href', 'target', 'rel',
        'src', 'alt', 'title', 'width', 'height', 'border', 'cellpadding', 'cellspacing'
    ],

    // Elementos prohibidos (seguridad)
    FORBID_TAGS: [
        'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
        'link', 'meta', 'style', 'base', 'applet', 'frame', 'frameset'
    ],

    // Atributos prohibidos (seguridad)
    FORBID_ATTR: [
        'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
        'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur',
        'onchange', 'onsubmit', 'onreset', 'onselect', 'onabort',
        'oncanplay', 'oncanplaythrough', 'oncuechange', 'ondurationchange',
        'onemptied', 'onended', 'onloadeddata', 'onloadedmetadata',
        'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress',
        'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend',
        'ontimeupdate', 'onvolumechange', 'onwaiting'
    ]
};

/**
 * Sanitiza HTML de forma segura
 * @param {string} dirtyHtml - HTML no sanitizado
 * @param {Object} customConfig - Configuración personalizada opcional
 * @returns {string} HTML sanitizado
 */
export function sanitizeHTML(dirtyHtml, customConfig = {}) {
    // CORRECCIÓN: Usar DOMPurify global en lugar de import
    if (typeof DOMPurify === 'undefined') {
        console.error('❌ DOMPurify no está disponible');
        // Fallback básico - eliminar tags HTML
        return dirtyHtml.replace(/<[^>]*>/g, '');
    }

    const config = {
        ...SECURITY_CONFIG,
        ...customConfig
    };

    try {
        return DOMPurify.sanitize(dirtyHtml, config);
    } catch (error) {
        console.error('❌ Error sanitizando HTML:', error);
        // En caso de error, devolver texto plano
        return DOMPurify.sanitize(dirtyHtml, {
            ALLOWED_TAGS: [], // No permitir ningún tag
            ALLOWED_ATTR: [] // No permitir ningún atributo
        });
    }
}

/**
 * Sanitiza contenido Markdown convertido a HTML
 * @param {string} markdownContent - Contenido Markdown
 * @returns {string} HTML sanitizado
 */
export function sanitizeMarkdown(markdownContent) {
    if (!markdownContent) return '';

    // CORRECCIÓN: Verificar que marked esté disponible
    if (typeof marked === 'undefined') {
        console.error('❌ marked.js no está disponible');
        return sanitizeHTML(markdownContent);
    }

    try {
        // Convertir Markdown a HTML
        const dirtyHtml = marked.parse(markdownContent);

        // Sanitizar el HTML resultante
        return sanitizeHTML(dirtyHtml, {
            // Configuración específica para Markdown
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'span',
                'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
            ],
            ALLOWED_ATTR: [
                'class', 'data-language', 'href', 'target', 'rel', 'src', 'alt', 'title'
            ]
        });
    } catch (error) {
        console.error('❌ Error procesando Markdown:', error);
        return sanitizeHTML(markdownContent); // Fallback a sanitización básica
    }
}

/**
 * Sanitiza texto para uso en atributos HTML
 * @param {string} text - Texto a sanitizar
 * @returns {string} Texto seguro para atributos
 */
export function sanitizeAttribute(text) {
    if (typeof text !== 'string') return '';

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitiza contenido para mostrar en vista previa
 * @param {string} content - Contenido a sanitizar
 * @param {number} maxLength - Longitud máxima (opcional)
 * @returns {string} Contenido sanitizado para vista previa
 */
export function sanitizePreview(content, maxLength = 100) {
    if (!content) return '';

    // Sanitizar contenido
    const sanitized = sanitizeHTML(content, {
        ALLOWED_TAGS: ['strong', 'em', 'code'], // Solo tags básicos para vista previa
        ALLOWED_ATTR: [] // No atributos en vista previa
    });

    // Limitar longitud si es necesario
    if (maxLength > 0 && sanitized.length > maxLength) {
        return sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
}

/**
 * Valida y sanitiza URLs
 * @param {string} url - URL a validar
 * @param {Array} allowedProtocols - Protocolos permitidos (default: ['http:', 'https:'])
 * @returns {string|null} URL sanitizada o null si no es válida
 */
export function sanitizeURL(url, allowedProtocols = ['http:', 'https:']) {
    if (!url) return null;

    try {
        const parsedUrl = new URL(url);

        // Verificar protocolo permitido
        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            console.warn('⚠️ Protocolo no permitido:', parsedUrl.protocol);
            return null;
        }

        // Devolver URL sanitizada
        return parsedUrl.toString();
    } catch (error) {
        console.warn('⚠️ URL inválida:', url);
        return null;
    }
}

/**
 * Sanitiza datos de usuario para prevenir XSS
 * @param {Object} userData - Datos del usuario
 * @returns {Object} Datos sanitizados
 */
export function sanitizeUserData(userData) {
    if (!userData || typeof userData !== 'object') return {};

    const sanitized = {};

    Object.keys(userData).forEach(key => {
        const value = userData[key];

        if (typeof value === 'string') {
            // Sanitizar strings según el contexto
            switch (key) {
                case 'name':
                case 'username':
                case 'email':
                    // Para nombres y emails, solo permitir texto básico
                    sanitized[key] = sanitizeHTML(value, {
                        ALLOWED_TAGS: [], // No HTML
                        ALLOWED_ATTR: []
                    });
                    break;

                case 'bio':
                case 'description':
                    // Para biografías, permitir Markdown básico
                    sanitized[key] = sanitizeMarkdown(value);
                    break;

                default:
                    // Para otros campos, sanitización básica
                    sanitized[key] = sanitizeHTML(value);
            }
        } else {
            // Mantener valores no-string tal cual
            sanitized[key] = value;
        }
    });

    return sanitized;
}

/**
 * Verifica si un string contiene código malicioso
 * @param {string} text - Texto a verificar
 * @returns {boolean} True si parece malicioso
 */
export function isPotentiallyMalicious(text) {
    if (typeof text !== 'string') return false;

    const maliciousPatterns = [
        /<script\b[^>]*>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /vbscript:/i,
        /expression\s*\(/i,
        /url\s*\(/i,
        /<\?php/i,
        /<\%/i
    ];

    return maliciousPatterns.some(pattern => pattern.test(text));
}

/**
 * Sanitiza contenido con detección de malware
 * @param {string} content - Contenido a sanitizar
 * @returns {Object} Resultado con contenido sanitizado y flags
 */
export function sanitizeWithSecurityCheck(content) {
    const result = {
        content: '',
        isMalicious: false,
        warnings: []
    };

    if (!content) return result;

    // Detectar contenido potencialmente malicioso
    if (isPotentiallyMalicious(content)) {
        result.isMalicious = true;
        result.warnings.push('Contenido potencialmente malicioso detectado');
    }

    // Sanitizar contenido
    result.content = sanitizeHTML(content);

    // Verificar si la sanitización removió contenido sospechoso
    if (result.content !== content && result.content.length < content.length) {
        result.warnings.push('Se removió contenido potencialmente inseguro');
    }

    return result;
}

/**
 * Logger de seguridad
 */
export const securityLogger = {
    warn: (message, data = null) => {
        console.warn(`🚨 SEGURIDAD: ${message}`, data);

        // En un entorno de producción, aquí se enviaría a un servicio de logging
        if (window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            // Enviar a servicio de logging (implementar según necesidades)
            logToSecurityService(message, data);
        }
    },

    error: (message, error = null) => {
        console.error(`💥 ERROR SEGURIDAD: ${message}`, error);

        if (window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            logToSecurityService(`ERROR: ${message}`, error);
        }
    },

    info: (message, data = null) => {
        console.info(`🛡️ INFO SEGURIDAD: ${message}`, data);
    }
};

// Función auxiliar para logging de seguridad
function logToSecurityService(message, data) {
    // Implementar según el servicio de logging utilizado
    // Ejemplo: Sentry, LogRocket, etc.
    try {
        // Placeholder para implementación real
        if (window.Sentry) {
            window.Sentry.captureMessage(`Security: ${message}`, {
                level: 'warning',
                extra: data
            });
        }

        // Ejemplo con fetch (descomentar si tienes un endpoint de logging)
        /*
        fetch('/api/security/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                data,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            })
        }).catch(() => {
            // Silenciar errores de logging para evitar bucles
        });
        */
    } catch (error) {
        console.error('Error enviando log de seguridad:', error);
    }
}

/**
 * CORRECCIÓN: Inicializador de seguridad
 * Verifica que todas las dependencias estén disponibles
 */
export function initializeSecurity() {
    const securityStatus = {
        DOMPurify: typeof DOMPurify !== 'undefined',
        marked: typeof marked !== 'undefined',
        hljs: typeof hljs !== 'undefined',
        timestamp: new Date().toISOString()
    };

    if (!securityStatus.DOMPurify) {
        console.error('❌ DOMPurify no está disponible - la sanitización no funcionará');
        securityLogger.error('DOMPurify no disponible', securityStatus);
    }

    if (!securityStatus.marked) {
        console.warn('⚠️ marked.js no está disponible - el renderizado de Markdown no funcionará');
    }

    // Configurar hooks de seguridad si DOMPurify está disponible
    if (securityStatus.DOMPurify && DOMPurify.addHook) {
        // Hook para bloquear elementos peligrosos
        DOMPurify.addHook('uponSanitizeElement', (node, data) => {
            // Bloquear scripts y iframes incluso si se cuelan
            if (data.tagName === 'script' || data.tagName === 'iframe') {
                securityLogger.warn('Elemento peligroso bloqueado', {
                    tagName: data.tagName,
                    node: node.outerHTML
                });
                return node.parentNode?.removeChild(node);
            }
        });

        // Hook para bloquear atributos peligrosos
        DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
            if (data.attrName.match(/^on\w+/)) {
                securityLogger.warn('Atributo peligroso removido', {
                    attribute: data.attrName,
                    value: data.attrValue
                });
                return false; // Remover el atributo
            }
        });
    }

    securityLogger.info('Sistema de seguridad inicializado', securityStatus);
    return securityStatus;
}

// CORRECCIÓN: Exportar por defecto un objeto con todas las funciones
const securityUtils = {
    sanitizeHTML,
    sanitizeMarkdown,
    sanitizeAttribute,
    sanitizePreview,
    sanitizeURL,
    sanitizeUserData,
    isPotentiallyMalicious,
    sanitizeWithSecurityCheck,
    securityLogger,
    initializeSecurity
};

export default securityUtils;
