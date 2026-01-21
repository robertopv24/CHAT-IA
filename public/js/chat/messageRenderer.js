// chat/messageRenderer.js - Renderizado especializado de mensajes
import stateManager from '../stateManager.js';
import { formatDate, getInitials } from '../utils.js';
import { sanitizeMarkdown, sanitizePreview } from '../securityUtils.js';

export class MessageRenderer {
    /**
     * Renderiza un mensaje completo
     */
    static renderMessage(message, isReply = false, replyingTo = null) {
        const messageElement = document.createElement('div');
        messageElement.dataset.uuid = message.uuid;

        const messageClass = this.getMessageClass(message);
        messageElement.className = `message ${messageClass}`;

        // Construir contenido del mensaje
        messageElement.innerHTML = this.buildMessageHTML(message, isReply, replyingTo);

        // Aplicar comportamientos adicionales
        this.applyMessageBehaviors(messageElement, message);

        return messageElement;
    }

    /**
     * Determina la clase CSS del mensaje
     */
    static getMessageClass(message) {
        const state = stateManager.getState();

        if (message.ai_model) return 'ai';
        if (state.currentUser && message.user_id == state.currentUser.id) return 'user';
        return 'participant';
    }

    /**
     * Construye el HTML completo del mensaje
     */
    static buildMessageHTML(message, isReply, replyingTo) {
        const avatarHTML = this.buildAvatarHTML(message);
        const contentHTML = this.buildContentHTML(message, isReply, replyingTo);

        return `
            ${avatarHTML}
            <div class="message-content-wrapper">
                ${contentHTML}
            </div>
        `;
    }

    /**
     * Construye el avatar del mensaje
     */
    static buildAvatarHTML(message) {
        if (message.ai_model) {
            return `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
            `;
        } else if (message.avatar_url) {
            return `
                <div class="message-avatar">
                    <img src="${message.avatar_url}" alt="${message.user_name}" class="user-avatar">
                </div>
            `;
        } else {
            const initials = getInitials(message.user_name);
            return `
                <div class="message-avatar">
                    <div class="avatar-initials">${initials}</div>
                </div>
            `;
        }
    }

    /**
     * Construye el contenido del mensaje (reply + contenido + tiempo)
     */
    static buildContentHTML(message, isReply, replyingTo) {
        const replyHTML = this.buildReplyHTML(message, isReply, replyingTo);
        const messageContent = this.buildMessageContent(message);
        const timeHTML = `<div class="message-time">${formatDate(message.created_at)}</div>`;

        return `
            ${replyHTML}
            <div class="message-content">
                ${messageContent}
            </div>
            ${timeHTML}
        `;
    }

    /**
     * Construye el bloque de respuesta
     */
    static buildReplyHTML(message, isReply, replyingTo) {
        let replyHTML = '';

        if (isReply && replyingTo) {
            const repliedContent = replyingTo.content.length > 70 ?
                sanitizePreview(replyingTo.content.substring(0, 70)) + '...' :
                sanitizePreview(replyingTo.content);

            replyHTML = `
                <div class="reply-preview" data-reply-uuid="${replyingTo.message_uuid}">
                    <div class="reply-author">${this.escapeHTML(replyingTo.content ? 'Mensaje original' : 'Usuario')}</div>
                    <div class="reply-text-snippet">${repliedContent}</div>
                </div>
            `;
        } else if (message.replied_uuid) {
            let repliedContent = message.replied_content || 'Mensaje original';
            let repliedAuthor = message.replied_author_name || 'Usuario';

            if (message.replied_deleted) {
                repliedContent = '<em><i class="fas fa-ban"></i> Mensaje eliminado</em>';
            } else {
                repliedContent = repliedContent.length > 70 ?
                    sanitizePreview(repliedContent.substring(0, 70)) + '...' :
                    sanitizePreview(repliedContent);
            }

            replyHTML = `
                <div class="reply-preview" data-reply-uuid="${message.replied_uuid}">
                    <div class="reply-author">${this.escapeHTML(repliedAuthor)}</div>
                    <div class="reply-text-snippet">${repliedContent}</div>
                </div>
            `;
        }

        return replyHTML;
    }

    /**
     * Construye el contenido principal del mensaje
     */
    static buildMessageContent(message) {
        if (message.deleted) {
            return `<p><em><i class="fas fa-ban"></i> Este mensaje fue eliminado.</em></p>`;
        }

        switch (message.message_type) {
            case 'image':
                return this.renderImageMessage(message);
            case 'audio':
                return this.renderAudioMessage(message);
            case 'video':
                return this.renderVideoMessage(message);
            case 'file':
                return this.renderFileMessage(message);
            case 'text':
            default:
                return this.renderTextMessage(message);
        }
    }

    /**
     * Renderiza mensaje de imagen
     */
    static renderImageMessage(message) {
        if (!message.file_data?.file_url) {
            return `<p>🖼️ Imagen no disponible</p>`;
        }

        return `
            <div class="message-image">
                <a href="${message.file_data.file_url}" target="_blank" rel="noopener noreferrer">
                    <img src="${message.file_data.file_url}"
                         alt="${this.escapeHTML(message.file_data.original_name || 'Imagen')}"
                         loading="lazy">
                </a>
            </div>
        `;
    }

    /**
     * Renderiza mensaje de archivo
     */
    static renderFileMessage(message) {
        if (!message.file_data?.file_url) {
            return `<p>📎 Archivo no disponible</p>`;
        }

        const fileSize = message.file_data.file_size ?
            this.formatFileSize(message.file_data.file_size) : '';

        const isEpub = message.file_data.original_name?.toLowerCase().endsWith('.epub');
        const fileIcon = isEpub ? 'fa-book-open' : 'fa-file-alt';
        const iconColor = isEpub ? '#f39c12' : 'var(--primary)';

        return `
            <div class="message-file">
                <a href="${message.file_data.file_url}"
                   download="${this.escapeHTML(message.file_data.original_name || 'archivo')}"
                   class="file-download-link">
                   <div class="file-icon" style="color: ${iconColor};">
                        <i class="fas ${fileIcon}"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${this.escapeHTML(message.file_data.original_name || 'Archivo')}</div>
                        ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                    </div>
                </a>
            </div>
        `;
    }

    /**
     * Renderiza mensaje de audio
     */
    static renderAudioMessage(message) {
        if (!message.file_data?.file_url) {
            return `<p>🎵 Audio no disponible</p>`;
        }

        return `
            <div class="message-audio">
                <div class="audio-info">
                    <i class="fas fa-headphones"></i>
                    <span>${this.escapeHTML(message.file_data.original_name || 'Audio')}</span>
                </div>
                <audio controls preload="metadata">
                    <source src="${message.file_data.file_url}" type="${message.file_data.mime_type || 'audio/mpeg'}">
                    Tu navegador no soporta el elemento de audio.
                </audio>
            </div>
        `;
    }

    /**
     * Renderiza mensaje de video
     */
    static renderVideoMessage(message) {
        if (!message.file_data?.file_url) {
            return `<p>🎥 Video no disponible</p>`;
        }

        return `
            <div class="message-video">
                <video controls preload="metadata">
                    <source src="${message.file_data.file_url}" type="${message.file_data.mime_type || 'video/mp4'}">
                    Tu navegador no soporta el elemento de video.
                </video>
                 <div class="video-info">
                    <i class="fas fa-video"></i>
                    <span>${this.escapeHTML(message.file_data.original_name || 'Video')}</span>
                </div>
            </div>
        `;
    }

    /**
     * Renderiza mensaje de texto con sanitización
     */
    static renderTextMessage(message) {
        try {
            let html = sanitizeMarkdown(message.content || '');

            // Si es solo un link, prepararlo para preview
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const match = urlRegex.exec(message.content || '');

            if (match && match[0]) {
                const url = match[0];
                html += `<div class="link-preview-container" data-url="${url}"></div>`;
            }

            return html;
        } catch (error) {
            console.error('Error sanitizando mensaje:', error);
            return DOMPurify.sanitize(message.content || '');
        }
    }

    /**
     * Aplica comportamientos adicionales al mensaje renderizado
     */
    static applyMessageBehaviors(messageElement, message) {
        // Renderizar matemáticas y código
        this.renderMathAndCode(messageElement);

        // Cargar previews de enlaces
        this.loadLinkPreviews(messageElement);

        // Agregar event listeners
        this.addMessageEventListeners(messageElement, message);
    }

    /**
     * Renderiza matemáticas (KaTeX) y resalta código
     */
    static renderMathAndCode(element) {
        // Renderizar matemáticas con KaTeX
        if (window.renderMathInElement) {
            window.renderMathInElement(element, window.katexRenderOptions || {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ],
                throwOnError: false
            });
        }

        // Resaltar código
        if (window.hljs) {
            element.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }
    }

    /**
     * Agrega event listeners al mensaje
     */
    static addMessageEventListeners(messageElement, message) {
        // Listener para menú contextual
        messageElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();

            import('../elements.js').then(({ elements }) => {
                stateManager.setActiveContextMenuMessage(message);

                // Mostrar/ocultar opción de eliminar según permisos
                const state = stateManager.getState();
                if (elements.contextMessageDeleteBtn) {
                    const canDelete = state.currentUser &&
                        message.user_id == state.currentUser.id &&
                        !message.deleted;
                    elements.contextMessageDeleteBtn.style.display = canDelete ? 'flex' : 'none';
                }

                if (elements.messageContextMenu) {
                    elements.messageContextMenu.style.top = `${event.clientY}px`;
                    elements.messageContextMenu.style.left = `${event.clientX}px`;
                    elements.messageContextMenu.classList.remove('hidden');
                }
            });
        });

        // Listener para bloques de respuesta
        const replyBlock = messageElement.querySelector('.reply-preview');
        if (replyBlock) {
            replyBlock.addEventListener('click', () => {
                const originalMessageUuid = replyBlock.dataset.replyUuid;
                this.scrollToMessage(originalMessageUuid);
            });
        }
    }

    /**
     * Desplaza a un mensaje específico
     */
    static async scrollToMessage(messageUuid) {
        const { showNotification } = await import('../utils.js');

        // Buscar mensaje en el DOM actual
        let targetMessage = document.querySelector(`.message[data-uuid="${messageUuid}"]`);

        if (targetMessage) {
            targetMessage.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Destacar temporalmente
            targetMessage.classList.add('highlighted');
            setTimeout(() => {
                if (targetMessage) {
                    targetMessage.classList.remove('highlighted');
                }
            }, 2000);
        } else {
            showNotification('El mensaje original no está cargado en la vista actual', 'warning');
        }
    }

    /**
     * Formatea el tamaño de archivo
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    static escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Carga previews de enlaces dinámicamente
     */
    static async loadLinkPreviews(element) {
        const containers = element.querySelectorAll('.link-preview-container');
        if (containers.length === 0) return;

        const { apiCall } = await import('../api.js'); // Import dinámico para evitar ciclos

        containers.forEach(async container => {
            const url = container.dataset.url;
            if (!url) return;

            container.innerHTML = `
                <div class="link-preview-loading">
                    <i class="fas fa-spinner fa-spin"></i> Cargando vista previa...
                </div>
            `;

            try {
                const data = await apiCall('/api/utils/link-preview', {
                    method: 'POST',
                    body: { url }
                });

                if (data.error || (!data.title && !data.description)) {
                    container.remove(); // No mostrar si falla o no hay datos
                    return;
                }

                const domain = new URL(url).hostname;
                const imageHTML = data.image ? `
                    <div class="link-preview-image">
                        <img src="${this.escapeHTML(data.image)}" alt="Preview">
                    </div>
                ` : '';

                container.innerHTML = `
                    <div class="link-preview-card">
                        <a href="${this.escapeHTML(url)}" target="_blank" rel="noopener noreferrer">
                            ${imageHTML}
                            <div class="link-preview-info">
                                <div class="link-preview-title">${this.escapeHTML(data.title || domain)}</div>
                                <div class="link-preview-description">${this.escapeHTML(data.description || url)}</div>
                                <div class="link-preview-domain">${domain}</div>
                            </div>
                        </a>
                    </div>
                `;
            } catch (error) {
                console.warn('Error cargando link preview:', error);
                container.remove();
            }
        });
    }
}
