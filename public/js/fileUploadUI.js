// fileUploadUI.js - Versión corregida con gestión robusta de subidas
import { apiUploadFile, apiUploadFileWithProgress } from './api.js';
import { showNotification } from './utils.js';
import { elements } from './elements.js';
import stateManager from './stateManager.js';
import ErrorHandler from './errorHandler.js';

class FileUploadManager {
    constructor() {
        this.currentFiles = [];
        this.uploadQueue = [];
        this.isUploading = false;
        this.maxConcurrentUploads = 2;
        this.uploadProgress = new Map();
    }

    async uploadAllFiles(chatUuid) {
        if (this.isUploading) {
            showNotification('Ya hay una subida en progreso', 'warning');
            return { successful: [], failed: [] };
        }

        if (this.currentFiles.length === 0) {
            showNotification('No hay archivos para subir', 'warning');
            return { successful: [], failed: [] };
        }

        this.isUploading = true;

        // ✅ CORRECCIÓN: Actualizar UI para mostrar estado de subida
        this.updateUploadUIState(true);

        const results = {
            successful: [],
            failed: []
        };

        try {
            showNotification(`Iniciando subida de ${this.currentFiles.length} archivo(s)`, 'info');

            // ✅ CORRECCIÓN: Subir archivos en lotes controlados
            for (let i = 0; i < this.currentFiles.length; i += this.maxConcurrentUploads) {
                const batch = this.currentFiles.slice(i, i + this.maxConcurrentUploads);
                const batchResults = await this.uploadBatch(batch, chatUuid, i);

                results.successful.push(...batchResults.successful);
                results.failed.push(...batchResults.failed);

                // ✅ CORRECCIÓN: Pequeña pausa entre lotes para no saturar
                if (i + this.maxConcurrentUploads < this.currentFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // ✅ CORRECCIÓN: Mostrar resultados detallados
            this.showUploadResults(results);

        } catch (error) {
            console.error('❌ Error en proceso de subida:', error);
            ErrorHandler.handle(error, 'file_upload_process');
        } finally {
            this.isUploading = false;
            this.updateUploadUIState(false);
        }

        return results;
    }

    async uploadBatch(files, chatUuid, startIndex) {
        const uploadPromises = files.map((file, batchIndex) => {
            const globalIndex = startIndex + batchIndex;
            return this.uploadSingleFile(file, chatUuid, globalIndex)
                .then(result => ({
                    success: true,
                    file,
                    result,
                    index: globalIndex
                }))
                .catch(error => ({
                    success: false,
                    file,
                    error,
                    index: globalIndex
                }));
        });

        const results = await Promise.allSettled(uploadPromises);

        return {
            successful: results.filter(r => r.status === 'fulfilled' && r.value.success).map(r => r.value),
            failed: results.filter(r => r.status === 'fulfilled' && !r.value.success).map(r => r.value)
                         .concat(results.filter(r => r.status === 'rejected').map(r => r.reason))
        };
    }

    async uploadSingleFile(file, chatUuid, fileIndex) {
        console.log(`📤 Subiendo archivo ${fileIndex}:`, file.name);

        return new Promise((resolve, reject) => {
            apiUploadFileWithProgress(
                file,
                chatUuid,
                (progress) => {
                    this.updateUploadProgress(fileIndex, progress);
                },
                {
                    timeout: 120000, // 2 minutos para archivos grandes
                    metadata: {
                        original_name: file.name,
                        file_size: file.size,
                        mime_type: file.type
                    }
                }
            )
            .then(response => {
                this.updateUploadProgress(fileIndex, 100);
                console.log(`✅ Archivo subido: ${file.name}`, response);
                resolve(response);
            })
            .catch(error => {
                console.error(`❌ Error subiendo archivo ${file.name}:`, error);

                // ✅ CORRECCIÓN: Marcar error específico en UI
                this.markUploadError(fileIndex, error);

                // ✅ CORRECCIÓN: Usar manejador unificado de errores
                ErrorHandler.handle(error, 'upload_single_file', {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    chatUuid: chatUuid
                });

                reject(error);
            });
        });
    }

    updateUploadProgress(fileIndex, progress) {
        const fileElement = elements.fileUploadList?.querySelector(`[data-index="${fileIndex}"]`);
        if (!fileElement) {
            console.warn(`⚠️ No se encontró elemento para archivo ${fileIndex}`);
            return;
        }

        const progressContainer = fileElement.querySelector('.upload-progress');
        const progressFill = fileElement.querySelector('.progress-fill');
        const progressText = fileElement.querySelector('.progress-text');

        if (progressContainer && progressFill && progressText) {
            progressContainer.classList.remove('hidden');
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;

            // ✅ CORRECCIÓN: Actualizar estado interno
            this.uploadProgress.set(fileIndex, progress);
        }
    }

    markUploadError(fileIndex, error) {
        const fileElement = elements.fileUploadList?.querySelector(`[data-index="${fileIndex}"]`);
        if (!fileElement) return;

        const progressContainer = fileElement.querySelector('.upload-progress');
        if (progressContainer) {
            progressContainer.innerHTML = `
                <span class="text-red-400 text-xs flex items-center">
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    Error: ${error.message || 'Error de subida'}
                </span>
            `;
        }
    }

    updateUploadUIState(uploading) {
        if (elements.fileUploadConfirm) {
            elements.fileUploadConfirm.disabled = uploading;
            elements.fileUploadConfirm.textContent = uploading ? 'Subiendo...' : 'Subir';
        }

        if (elements.fileUploadCancel) {
            elements.fileUploadCancel.disabled = uploading;
        }
    }

    showUploadResults(results) {
        const totalFiles = results.successful.length + results.failed.length;

        if (results.failed.length === 0) {
            showNotification(`✅ Todos los ${totalFiles} archivos se subieron correctamente`, 'success');
        } else if (results.successful.length === 0) {
            showNotification(`❌ No se pudo subir ningún archivo`, 'error');
        } else {
            showNotification(
                `📊 Subida completada: ${results.successful.length}/${totalFiles} archivos exitosos`,
                results.failed.length > 0 ? 'warning' : 'success'
            );

            // ✅ CORRECCIÓN: Mostrar detalles de errores si hay muchos fallos
            if (results.failed.length > 0) {
                console.warn('📋 Archivos con error:', results.failed.map(f => ({
                    name: f.file.name,
                    error: f.error?.message
                })));
            }
        }
    }

    // Métodos de compatibilidad con la API anterior
    addFiles(files) {
        const validFiles = files.filter(file => {
            if (file.size > 100 * 1024 * 1024) { // 100MB límite
                showNotification(`El archivo ${file.name} es demasiado grande (máximo 100MB)`, 'error');
                return false;
            }

            if (!this.isFileTypeAllowed(file.type, file.name)) {
                showNotification(`Tipo de archivo no permitido: ${file.name}`, 'error');
                return false;
            }

            return true;
        });

        this.currentFiles = [...this.currentFiles, ...validFiles];
        return validFiles;
    }

    removeFile(index) {
        if (index >= 0 && index < this.currentFiles.length) {
            this.currentFiles.splice(index, 1);
            this.uploadProgress.delete(index);
            return true;
        }
        return false;
    }

    clearFiles() {
        this.currentFiles = [];
        this.uploadProgress.clear();
    }

    isFileTypeAllowed(fileType, fileName) {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'text/plain',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/mpeg'
        ];

        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.mp3', '.wav', '.mp4', '.mpeg'];

        // Verificar por tipo MIME
        if (fileType && allowedTypes.includes(fileType)) {
            return true;
        }

        // Verificar por extensión como fallback
        const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return allowedExtensions.includes(fileExtension);
    }

    getCurrentFiles() {
        return [...this.currentFiles];
    }

    getUploadStatus() {
        return {
            isUploading: this.isUploading,
            totalFiles: this.currentFiles.length,
            progress: Object.fromEntries(this.uploadProgress),
            maxConcurrent: this.maxConcurrentUploads
        };
    }
}

// ✅ CORRECCIÓN: Instancia única del manager
const fileUploadManager = new FileUploadManager();

// ========== FUNCIONES PÚBLICAS (compatibilidad) ==========

export function showFileUploadModal() {
    console.log('🔧 showFileUploadModal llamado');

    if (!elements.fileUploadModal) {
        console.error('❌ Modal de subida de archivos no encontrado');
        elements.fileUploadModal = document.getElementById('file-upload-modal');

        if (!elements.fileUploadModal) {
            console.error('❌ Modal de subida de archivos no existe en el DOM');
            showNotification('Error: Modal de archivos no disponible', 'error');
            return;
        }
    }

    console.log('✅ Modal encontrado, mostrando...');

    // ✅ CORRECCIÓN: Resetear estado usando el manager
    resetFileUploadState();

    if (elements.fileUpload) {
        elements.fileUpload.value = ''; // Limpiar input
    }

    if (elements.fileUploadList) {
        elements.fileUploadList.innerHTML = '<p class="text-gray-400 py-4 text-center">No hay archivos seleccionados</p>';
    }

    // Mostrar el modal
    elements.fileUploadModal.classList.remove('hidden');
    console.log('✅ Modal mostrado correctamente');
}

export function hideFileUploadModal() {
    console.log('🔧 hideFileUploadModal llamado');

    if (elements.fileUploadModal) {
        elements.fileUploadModal.classList.add('hidden');
        resetFileUploadState();
    }
}

export function setupFileUploadListeners() {
    console.log('🔧 setupFileUploadListeners llamado');

    if (!elements.fileUpload) {
        console.error('❌ Elemento fileUpload no encontrado');
        elements.fileUpload = document.getElementById('file-upload');

        if (!elements.fileUpload) {
            console.error('❌ Elemento fileUpload no existe en el DOM');
            return;
        }
    }

    console.log('✅ Elemento fileUpload encontrado');

    // Listener para selección de archivos
    elements.fileUpload.addEventListener('change', function(event) {
        console.log('📁 Archivos seleccionados:', event.target.files);
        handleFileSelect(event);
    });

    // Listener para botón de confirmar subida
    if (!elements.fileUploadConfirm) {
        elements.fileUploadConfirm = document.getElementById('file-upload-confirm');
    }

    if (elements.fileUploadConfirm) {
        elements.fileUploadConfirm.addEventListener('click', function() {
            console.log('🔼 Botón de subir clickeado');
            handleFileUpload();
        });
    } else {
        console.error('❌ Botón fileUploadConfirm no encontrado');
    }

    // Listener para botón de cancelar
    if (!elements.fileUploadCancel) {
        elements.fileUploadCancel = document.getElementById('file-upload-cancel');
    }

    if (elements.fileUploadCancel) {
        elements.fileUploadCancel.addEventListener('click', function() {
            console.log('❌ Botón de cancelar clickeado');
            hideFileUploadModal();
        });
    } else {
        console.error('❌ Botón fileUploadCancel no encontrado');
    }

    // ✅ CORRECCIÓN: Configurar drag and drop
    setupDragAndDrop();

    console.log('✅ Todos los listeners de fileUpload configurados');
}

// ✅ CORRECCIÓN: Función para configurar drag and drop
function setupDragAndDrop() {
    const modalBody = elements.fileUploadModal?.querySelector('.modal-body');

    if (modalBody) {
        // Prevenir comportamientos por defecto
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            modalBody.addEventListener(eventName, preventDefaults, false);
        });

        // Resaltar área de drop
        ['dragenter', 'dragover'].forEach(eventName => {
            modalBody.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            modalBody.addEventListener(eventName, unhighlight, false);
        });

        // Manejar drop
        modalBody.addEventListener('drop', handleDrop, false);
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    const modalBody = elements.fileUploadModal?.querySelector('.modal-body');
    if (modalBody) {
        modalBody.style.backgroundColor = 'var(--bg-secondary)';
        modalBody.style.border = '2px dashed var(--accent)';
    }
}

function unhighlight() {
    const modalBody = elements.fileUploadModal?.querySelector('.modal-body');
    if (modalBody) {
        modalBody.style.backgroundColor = '';
        modalBody.style.border = '';
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);

    if (files.length > 0) {
        handleFileSelect({ target: { files } });
    }
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    console.log('📁 Procesando archivos:', files.length);

    if (files.length === 0) return;

    // ✅ CORRECCIÓN: Usar el manager para agregar archivos
    const validFiles = fileUploadManager.addFiles(files);

    if (validFiles.length > 0) {
        renderFileList();
    }
}

function renderFileList() {
    if (!elements.fileUploadList) {
        console.error('❌ fileUploadList no encontrado');
        return;
    }

    elements.fileUploadList.innerHTML = '';

    const currentFiles = fileUploadManager.getCurrentFiles();

    if (currentFiles.length === 0) {
        elements.fileUploadList.innerHTML = '<p class="text-gray-400 py-4 text-center">No hay archivos seleccionados</p>';
        return;
    }

    console.log('📝 Renderizando lista de archivos:', currentFiles.length);

    currentFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item flex items-center justify-between p-3 border-b border-gray-600';
        fileElement.setAttribute('data-index', index);

        fileElement.innerHTML = `
            <div class="file-info flex items-center space-x-3 flex-1">
                <i class="fas ${getFileIcon(file.type)} text-blue-400 text-lg"></i>
                <div class="flex-1 min-w-0">
                    <div class="file-name text-sm font-medium truncate">${DOMPurify.sanitize(file.name)}</div>
                    <div class="file-size text-xs text-gray-400">${formatFileSize(file.size)}</div>
                    <div class="file-type text-xs text-gray-500">${file.type || 'Tipo desconocido'}</div>
                </div>
            </div>
            <div class="file-actions flex items-center space-x-2">
                <div class="upload-progress hidden flex items-center">
                    <div class="progress-bar w-20 bg-gray-600 rounded-full h-2 mr-2">
                        <div class="progress-fill bg-green-500 h-2 rounded-full" style="width: 0%"></div>
                    </div>
                    <span class="progress-text text-xs text-gray-400">0%</span>
                </div>
                <button class="remove-file text-red-400 hover:text-red-300 p-1 rounded" data-index="${index}" title="Eliminar archivo">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Listener para eliminar archivo
        const removeBtn = fileElement.querySelector('.remove-file');
        removeBtn.addEventListener('click', () => {
            console.log('🗑️ Eliminando archivo:', index);
            if (fileUploadManager.removeFile(index)) {
                renderFileList();
            }
        });

        elements.fileUploadList.appendChild(fileElement);
    });

    // ✅ CORRECCIÓN: Actualizar contador de archivos
    updateFileCount();
}

export async function handleFileUpload() {
    console.log('🚀 Iniciando subida REAL de archivos...');

    const state = stateManager.getState();
    if (!state.currentChat) {
        showNotification('No hay un chat activo para subir archivos', 'error');
        return;
    }

    // ✅ CORRECCIÓN: Usar el manager para la subida
    const results = await fileUploadManager.uploadAllFiles(state.currentChat.uuid);

    if (results.successful.length > 0) {
        hideFileUploadModal();

        // Recargar mensajes del chat para mostrar los archivos subidos
        if (state.currentChat) {
            const { fetchMessages } = await import('./chatUI.js');
            fetchMessages(state.currentChat.uuid);
        }
    }
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fa-file-image';
    if (fileType.startsWith('video/')) return 'fa-file-video';
    if (fileType.startsWith('audio/')) return 'fa-file-audio';
    if (fileType.includes('pdf')) return 'fa-file-pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fa-file-excel';
    if (fileType.includes('zip') || fileType.includes('compressed')) return 'fa-file-archive';
    if (fileType.includes('text')) return 'fa-file-text';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateFileCount() {
    const fileCount = fileUploadManager.getCurrentFiles().length;
    const modalTitle = elements.fileUploadModal?.querySelector('.modal-header h3');

    if (modalTitle && fileCount > 0) {
        modalTitle.textContent = `Subir archivos (${fileCount})`;
    } else if (modalTitle) {
        modalTitle.textContent = 'Subir archivos';
    }
}

function resetFileUploadState() {
    fileUploadManager.clearFiles();
    console.log('🔄 Estado de subida de archivos reseteado');
}

// ✅ CORRECCIÓN: Función para diagnóstico
export function diagnoseFileUpload() {
    const status = fileUploadManager.getUploadStatus();

    return {
        managerStatus: status,
        elements: {
            fileUploadModal: !!elements.fileUploadModal,
            fileUpload: !!elements.fileUpload,
            fileUploadList: !!elements.fileUploadList,
            fileUploadConfirm: !!elements.fileUploadConfirm,
            fileUploadCancel: !!elements.fileUploadCancel
        },
        state: stateManager.getState().currentChat ? 'chat_activo' : 'sin_chat'
    };
}

// ✅ CORRECCIÓN: Exportar el manager para casos avanzados
export { fileUploadManager };
