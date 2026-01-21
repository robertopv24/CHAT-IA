import { apiCall } from '../api.js';
import stateManager from '../stateManager.js';
import { displayAvatar } from '../utils.js';

/**
 * ChatInfoManager - Gestiona el panel de información y medios del chat activo
 */
export class ChatInfoManager {
    static init() {
        this.panel = document.getElementById('chat-info-panel');
        this.closeBtn = document.getElementById('close-info-panel');
        this.tabs = document.querySelectorAll('.info-tab');
        this.chatPartner = document.querySelector('.chat-partner');

        if (this.chatPartner) {
            this.chatPartner.style.cursor = 'pointer';
            this.chatPartner.addEventListener('click', (e) => {
                // Evitar que el clic en el botón atrás dispare esto
                if (e.target.closest('.back-button')) return;
                this.togglePanel();
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hidePanel());
        }

        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        console.log('✅ ChatInfoManager inicializado');
    }

    static togglePanel() {
        if (!this.panel) return;
        if (this.panel.classList.contains('hidden')) {
            this.showPanel();
        } else {
            this.hidePanel();
        }
    }

    static async showPanel() {
        const state = stateManager.getState();
        const currentChat = state.currentChat;

        if (!currentChat) return;

        this.panel.classList.remove('hidden');
        await this.loadChatDetails(currentChat.uuid);
        this.switchTab('participants');
    }

    static hidePanel() {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
    }

    static async loadChatDetails(chatUuid) {
        try {
            const data = await apiCall(`/api/chat/details?chat_uuid=${chatUuid}`);
            const chat = data.chat;

            const titleEl = document.getElementById('info-title');
            const statusEl = document.getElementById('info-status');
            const avatarEl = document.getElementById('info-avatar');

            if (titleEl) titleEl.textContent = chat.title;
            if (statusEl) statusEl.textContent = chat.is_group ? 'Grupo' : (chat.chat_type === 'ai' ? 'Asistente IA' : 'Chat Directo');

            if (avatarEl) {
                displayAvatar(avatarEl, chat.avatar_url, chat.title);
            }

            this.currentParticipants = data.participants;
        } catch (error) {
            console.error('Error loading chat details:', error);
        }
    }

    static async switchTab(tabName) {
        // Actualizar UI de pestañas
        this.tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.info-tab[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.info-section');
        sections.forEach(s => s.classList.add('hidden'));

        // Mostrar sección activa
        const targetSection = document.getElementById(`info-${tabName}`);
        if (targetSection) targetSection.classList.remove('hidden');

        // Cargar datos según la pestaña
        if (tabName === 'participants') {
            this.renderParticipants();
        } else {
            await this.loadMedia(tabName);
        }
    }

    static renderParticipants() {
        const container = document.getElementById('info-participants');
        if (!container) return;

        if (!this.currentParticipants || this.currentParticipants.length === 0) {
            container.innerHTML = '<div class="empty-info-state">No hay participantes</div>';
            return;
        }

        container.innerHTML = this.currentParticipants.map(user => `
            <div class="participant-item">
                <div class="chat-avatar" style="background-image: url('${user.avatar_url || '/public/assets/images/default-avatar.png'}'); background-size: cover;">
                    ${!user.avatar_url ? (user.name ? user.name.charAt(0).toUpperCase() : 'U') : ''}
                </div>
                <div class="participant-info">
                    <span class="participant-name" title="${user.name}">${user.name}</span>
                    <span class="participant-role">${user.is_admin ? 'Administrador' : 'Participante'}</span>
                </div>
            </div>
        `).join('');
    }

    static async loadMedia(tabName) {
        const container = document.getElementById(`info-${tabName}`);
        if (!container) return;

        container.innerHTML = '<div class="empty-info-state">Cargando...</div>';

        const state = stateManager.getState();
        if (!state.currentChat) return;
        const chatUuid = state.currentChat.uuid;

        try {
            const data = await apiCall(`/api/chat/media?chat_uuid=${chatUuid}&tab=${tabName}`);
            this.renderMedia(tabName, data.media || []);
        } catch (error) {
            console.error(`Error loading ${tabName}:`, error);
            container.innerHTML = `<div class="empty-info-state">Error cargando ${tabName}</div>`;
        }
    }

    static renderMedia(type, items) {
        const container = document.getElementById(`info-${type}`);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = `<div class="empty-info-state">No hay ${this.getTabNameLabel(type)}</div>`;
            return;
        }

        if (type === 'images') {
            container.innerHTML = `<div class="media-grid">
                ${items.map(item => {
                try {
                    const content = JSON.parse(item.content);
                    return `<div class="media-thumbnail">
                            <img src="${content.file_url}" alt="Media" onclick="window.open('${content.file_url}', '_blank')" title="${content.original_name}">
                        </div>`;
                } catch (e) { return ''; }
            }).join('')}
            </div>`;
        } else if (type === 'files') {
            container.innerHTML = items.map(item => {
                try {
                    const content = JSON.parse(item.content);
                    return `<div class="file-item">
                        <i class="fas fa-file-alt"></i>
                        <div class="participant-info" style="min-width: 0;">
                            <a href="${content.file_url}" target="_blank" class="participant-name" title="${content.original_name}">${content.original_name}</a>
                            <span class="participant-role">${(content.file_size / 1024).toFixed(1)} KB • ${new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>`;
                } catch (e) { return ''; }
            }).join('');
        } else if (type === 'audios') {
            container.innerHTML = items.map(item => {
                try {
                    const content = JSON.parse(item.content);
                    return `<div class="file-item" style="flex-direction: column; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
                            <i class="fas fa-music"></i>
                            <div class="participant-info" style="min-width: 0;">
                                <a href="${content.file_url}" target="_blank" class="participant-name" title="${content.original_name}">${content.original_name}</a>
                                <span class="participant-role">${new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <audio controls style="width: 100%; margin-top: 0.5rem; height: 32px;">
                            <source src="${content.file_url}" type="${content.mime_type}">
                        </audio>
                    </div>`;
                } catch (e) { return ''; }
            }).join('');
        } else if (type === 'links') {
            container.innerHTML = items.map(item => {
                const urls = item.content.match(/https?:\/\/[^\s]+/g) || [];
                return urls.map(url => `
                    <div class="link-item">
                        <a href="${url}" target="_blank">${url}</a>
                        <span class="link-time">Enviado por ${item.user_name} • ${new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                `).join('');
            }).join('');
        }
    }

    static getTabNameLabel(type) {
        const labels = {
            images: 'imágenes',
            files: 'archivos',
            audios: 'audios',
            links: 'enlaces'
        };
        return labels[type] || 'elementos';
    }
}
