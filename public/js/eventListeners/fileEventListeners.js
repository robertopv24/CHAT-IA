// eventListeners/fileEventListeners.js - Listeners de archivos
import stateManager from '../stateManager.js';
import { showNotification } from '../utils.js';
import { showFileUploadModal, hideFileUploadModal, handleFileUpload } from '../fileUploadUI.js';

export class FileEventListeners {
    static async setup() {
        await this.setupFileActionListeners();
        console.log('✅ File event listeners configurados');
    }

    static async setupFileActionListeners() {
        const { elements } = await import('../elements.js');

        if (elements.attachFileBtn) {
            elements.attachFileBtn.removeEventListener('click', this.handleAttachFile);
            elements.attachFileBtn.addEventListener('click', this.handleAttachFile);
        }
    }

    static handleAttachFile = () => {
        const state = stateManager.getState();
        if (!state.currentChat) {
            showNotification('Abre un chat para subir archivos', 'warning');
            return;
        }
        showFileUploadModal();
    }
}
