// avatarUI.js - Gestión de la UI del avatar de usuario (CORREGIDO)
import { apiCall } from './api.js';
import { showNotification } from './utils.js';
import { elements } from './elements.js';
import stateManager from './stateManager.js';

// Variable para rastrear si el modal ha sido creado
let avatarModalCreated = false;

export function showAvatarUploadModal() {
    // Si el modal no ha sido creado, crearlo
    if (!avatarModalCreated) {
        createAvatarUploadModal();
    }

    // Resetear el modal al mostrarlo
    if (elements.avatarUploadModal) {
        // Limpiar input
        if (elements.avatarUploadInput) {
            elements.avatarUploadInput.value = '';
        }

        // Resetear vista previa
        if (elements.avatarPreview) {
            elements.avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
            elements.avatarPreview.style.backgroundImage = '';
            elements.avatarPreview.style.backgroundColor = '#4B5563'; // bg-gray-600
        }

        elements.avatarUploadModal.classList.remove('hidden');
    } else {
        console.error('No se pudo crear el modal de avatar');
    }
}

export function hideAvatarUploadModal() {
    if (elements.avatarUploadModal) {
        elements.avatarUploadModal.classList.add('hidden');
    }
}

function createAvatarUploadModal() {
    // Crear el modal de avatar
    const modalHTML = `
        <div id="avatar-upload-modal" class="modal-overlay hidden">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="text-lg font-bold">Actualizar Avatar</h3>
                </div>
                <div class="modal-body">
                    <div class="flex flex-col items-center space-y-4">
                        <div id="avatar-preview" class="w-32 h-32 rounded-full bg-gray-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-gray-400 overflow-hidden">
                            <i class="fas fa-user"></i>
                        </div>
                        <input type="file" id="avatar-upload-input" accept="image/jpeg,image/png,image/gif" class="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white">
                        <p class="text-sm text-gray-400 text-center">Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 2MB</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" id="avatar-upload-cancel">Cancelar</button>
                    <button class="modal-btn primary" id="avatar-upload-confirm">Actualizar Avatar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    avatarModalCreated = true;

    // Actualizar los elementos en el objeto `elements`
    elements.avatarUploadModal = document.getElementById('avatar-upload-modal');
    elements.avatarUploadInput = document.getElementById('avatar-upload-input');
    elements.avatarPreview = document.getElementById('avatar-preview');
    elements.avatarUploadCancel = document.getElementById('avatar-upload-cancel');
    elements.avatarUploadConfirm = document.getElementById('avatar-upload-confirm');

    // Configurar los listeners del modal de avatar
    setupAvatarModalListeners();
}

function setupAvatarModalListeners() {
    if (elements.avatarUploadInput) {
        elements.avatarUploadInput.addEventListener('change', handleAvatarSelect);
    }

    if (elements.avatarUploadCancel) {
        elements.avatarUploadCancel.addEventListener('click', hideAvatarUploadModal);
    }

    if (elements.avatarUploadConfirm) {
        elements.avatarUploadConfirm.addEventListener('click', handleAvatarUpload);
    }
}

export function setupAvatarUploadListeners() {
    // Buscar o crear botón de editar avatar en el perfil
    let editAvatarBtn = document.getElementById('edit-avatar-btn');

    if (!editAvatarBtn) {
        const profileActions = document.querySelector('.profile-actions');
        if (profileActions) {
            editAvatarBtn = document.createElement('button');
            editAvatarBtn.id = 'edit-avatar-btn';
            editAvatarBtn.className = 'auth-button w-full mb-3';
            editAvatarBtn.innerHTML = '<i class="fas fa-user-edit"></i> Cambiar Avatar';
            editAvatarBtn.addEventListener('click', showAvatarUploadModal);
            profileActions.insertBefore(editAvatarBtn, profileActions.firstChild);

            console.log('✅ Botón de avatar creado en el perfil');
        } else {
            console.warn('⚠️ No se encontró el contenedor de acciones del perfil');
        }
    } else {
        editAvatarBtn.addEventListener('click', showAvatarUploadModal);
        console.log('✅ Botón de avatar ya existe, listener añadido');
    }

    console.log('✅ Listeners de avatar configurados');
}

function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecciona una imagen válida', 'error');
        return;
    }

    // Validar tamaño (2MB máximo)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('La imagen no debe superar los 2MB', 'error');
        return;
    }

    // Mostrar vista previa
    const reader = new FileReader();
    reader.onload = function(e) {
        if (elements.avatarPreview) {
            elements.avatarPreview.innerHTML = '';
            elements.avatarPreview.style.backgroundImage = `url(${e.target.result})`;
            elements.avatarPreview.style.backgroundSize = 'cover';
            elements.avatarPreview.style.backgroundPosition = 'center';
            elements.avatarPreview.style.backgroundColor = 'transparent';
        }
    };
    reader.readAsDataURL(file);
}

export async function handleAvatarUpload() {
    const fileInput = elements.avatarUploadInput;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showNotification('Selecciona una imagen para tu avatar', 'warning');
        return;
    }

    const file = fileInput.files[0];

    try {
        // Deshabilitar botón durante la subida
        if (elements.avatarUploadConfirm) {
            elements.avatarUploadConfirm.disabled = true;
            elements.avatarUploadConfirm.textContent = 'Subiendo...';
        }

        // Subir avatar - usar FormData para la subida de archivos
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await apiCall('/api/user/avatar', {
            method: 'POST',
            body: formData,
            // NO establecer Content-Type, el navegador lo hará automáticamente con el boundary correcto
            headers: {
                'Accept': 'application/json'
            }
        });

        showNotification('Avatar actualizado correctamente', 'success');
        hideAvatarUploadModal();

        // CORRECCIÓN: Usar la función corregida updateUserAvatar
        updateUserAvatar(response.avatar_url);

    } catch (error) {
        console.error('Error actualizando avatar:', error);
        showNotification('Error al actualizar el avatar: ' + error.message, 'error');
    } finally {
        if (elements.avatarUploadConfirm) {
            elements.avatarUploadConfirm.disabled = false;
            elements.avatarUploadConfirm.textContent = 'Actualizar Avatar';
        }
    }
}

// CORRECCIÓN COMPLETA: Función para actualizar el avatar en toda la aplicación
function updateUserAvatar(avatarUrl) {
    // Actualizar avatar en el menú principal
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.innerHTML = '';
        userAvatar.style.backgroundImage = `url(${avatarUrl})`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.style.backgroundPosition = 'center';
        userAvatar.style.backgroundColor = 'transparent';
    }

    // Actualizar avatar en el perfil
    const profileAvatar = document.querySelector('.user-avatar.large');
    if (profileAvatar) {
        profileAvatar.innerHTML = '';
        profileAvatar.style.backgroundImage = `url(${avatarUrl})`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        profileAvatar.style.backgroundColor = 'transparent';
    }

    // CORRECCIÓN CRÍTICA: Actualizar el estado global usando stateManager correctamente
    const state = stateManager.getState();
    if (state.currentUser) {
        // Usar setCurrentUser para actualizar el estado global de forma inmutable
        stateManager.setCurrentUser({
            ...state.currentUser,
            avatar_url: avatarUrl
        });

        console.log('✅ Avatar actualizado en el estado global:', avatarUrl);
    } else {
        console.warn('⚠️ No hay usuario actual para actualizar el avatar');
    }

    console.log('✅ Avatar actualizado en la interfaz');
}
