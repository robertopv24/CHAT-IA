<!DOCTYPE html>
<html lang="es">
<head>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FoxIA - Asistente Cognitivo</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" integrity="sha384-wcIxkf4k558AjM3Yz3BBFQUbk/zgIYC2R0QpeeYb+TwlBVMrlgLqwRjRtGZiK7ww" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" integrity="sha384-hIoBPJpTUs74ddyc4bFZSM1TVlQDA60VBbJS0oA934VSz82sBx1X7kSx2ATBDIyd" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" integrity="sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk" crossorigin="anonymous"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Notificación flotante -->
    <div id="notification" class="notification hidden"></div>

    <!-- Menú contextual para nuevo chat -->
    <div id="new-chat-menu" class="context-menu hidden" style="width: 240px;">
        <div class="context-menu-item" id="create-ai-chat-btn">
            <i class="fas fa-robot"></i> Nuevo chat con IA
        </div>
        <div class="context-menu-item" id="create-group-chat-btn">
            <i class="fas fa-users"></i> Nuevo grupo
        </div>
        <div class="context-menu-item" id="message-contact-btn">
            <i class="fas fa-user-plus"></i> Enviar mensaje a contacto
        </div>
    </div>

    <!-- Modal para crear grupo -->
    <div id="group-create-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Crear nuevo grupo</h3>
            </div>
            <div class="modal-body">
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-1">Nombre del grupo</label>
                    <input type="text" id="group-name-input" class="modal-input" placeholder="Ej. Equipo de Desarrollo">
                </div>
                <div class="mb-2">
                    <label class="block text-sm font-medium mb-1">Seleccionar participantes</label>
                    <div class="search-box mb-2">
                        <input type="text" id="group-contact-search" class="modal-input text-sm" placeholder="Buscar contactos...">
                    </div>
                </div>
                <div id="group-participants-list" class="max-h-60 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800 bg-opacity-50">
                    <!-- Los contactos se cargarán aquí con checkboxes -->
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="group-create-cancel">Cancelar</button>
                <button class="modal-btn primary" id="group-create-confirm">Crear Grupo</button>
            </div>
        </div>
    </div>

    <!-- Menú contextual para chats -->
    <div id="context-menu" class="context-menu hidden">
        <div class="context-menu-item" id="context-rename">
            <i class="fas fa-edit"></i> Renombrar
        </div>
        <div class="context-menu-item delete" id="context-delete">
            <i class="fas fa-trash"></i> Eliminar
        </div>
    </div>

    <div id="message-context-menu" class="context-menu hidden">
        <div class="context-menu-item" id="context-message-reply">
            <i class="fas fa-reply"></i> Responder
        </div>
        <div class="context-menu-item" id="context-message-copy">
            <i class="fas fa-copy"></i> Copiar Texto
        </div>
        <div class="context-menu-item delete" id="context-message-delete">
            <i class="fas fa-trash"></i> Eliminar Mensaje
        </div>
    </div>

    <div id="replying-to-bar" class="replying-to-bar hidden">
        <div class="reply-content">
            <div class="reply-title">Respondiendo a:</div>
            <div id="replying-to-text" class="reply-text"></div>
        </div>
        <button id="cancel-reply-btn" class="cancel-reply-btn">&times;</button>
    </div>

    <!-- Menú contextual para contactos -->
    <div id="contact-context-menu" class="context-menu hidden">
        <div class="context-menu-item" id="context-contact-rename">
            <i class="fas fa-edit"></i> Renombrar (Apodo)
        </div>
        <div class="context-menu-item" id="context-contact-block">
            <!-- El texto se actualizará dinámicamente -->
        </div>
        <div class="context-menu-item delete" id="context-contact-delete">
            <i class="fas fa-user-times"></i> Eliminar Contacto
        </div>
    </div>

    <!-- Modal para renombrar chat -->
    <div id="rename-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Renombrar conversación</h3>
            </div>
            <div class="modal-body">
                <input type="text" id="rename-input" class="modal-input" placeholder="Nuevo nombre">
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="rename-cancel">Cancelar</button>
                <button class="modal-btn primary" id="rename-confirm">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Modal para apodo de contacto -->
    <div id="nickname-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Asignar Apodo al Contacto</h3>
            </div>
            <div class="modal-body">
                <input type="text" id="nickname-input" class="modal-input" placeholder="Apodo (dejar en blanco para quitar)">
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="nickname-cancel">Cancelar</button>
                <button class="modal-btn primary" id="nickname-confirm">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Modal para editar tripletes -->
    <div id="triplet-edit-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Editar Triplet</h3>
            </div>
            <div class="modal-body">
                <input type="hidden" id="triplet-id">
                <input type="text" id="triplet-subject" class="modal-input" placeholder="Sujeto">
                <input type="text" id="triplet-predicate" class="modal-input" placeholder="Predicado">
                <input type="text" id="triplet-object" class="modal-input" placeholder="Objeto">
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="triplet-cancel">Cancelar</button>
                <button class="modal-btn primary" id="triplet-confirm">Guardar</button>
            </div>
        </div>
    </div>

    <!-- Modal para subir archivos -->
    <div id="file-upload-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Subir archivos</h3>
            </div>
            <div class="modal-body">
                <input type="file" id="file-upload" multiple class="w-full p-2 border border-gray-600 rounded mb-4">
                <div id="file-upload-list" class="max-h-60 overflow-y-auto">
                    <p class="text-gray-400">No hay archivos seleccionados</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="file-upload-cancel">Cancelar</button>
                <button class="modal-btn primary" id="file-upload-confirm">Subir</button>
            </div>
        </div>
    </div>

    <!-- Modal para Agregar usuario -->
    <div id="user-add-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Agregar usuario</h3>
            </div>
            <div class="modal-body">
                <div class="user-add-box">
                    <input type="text" id="user-add-input" class="modal-input" placeholder="Nombre o email">
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="user-search-cancel">Cancelar</button>
                <button class="modal-btn primary" id="modal-add-contact-btn">Agregar</button>
            </div>
        </div>
    </div>

    <!-- Modal para búsqueda de mensajes -->
    <div id="message-search-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 class="text-lg font-bold">Buscar en la Conversación</h3>
            </div>
            <div class="modal-body">
                <div class="search-box mb-4">
                    <input type="text" id="message-search-input" class="modal-input" placeholder="Texto a buscar...">
                    <button id="message-search-btn" class="modal-btn primary">Buscar</button>
                </div>
                <div id="message-search-results" class="search-results">
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" id="message-search-close-btn">Cerrar</button>
            </div>
        </div>
    </div>

    <!-- Pantalla de Autenticación -->
    <div id="auth-screen" class="auth-screen">
        <div class="auth-container">
            <div class="auth-header">
                <h2>Iniciar Sesión</h2>
                <p>Bienvenido a FoxIA Assistant</p>
            </div>
            <div id="login-form" class="auth-form">
                <div class="form-group">
                    <label for="login-email">Correo Electrónico</label>
                    <input type="email" id="login-email" placeholder="Tu correo electrónico" value="">
                </div>
                <div class="form-group">
                    <label for="login-password">Contraseña</label>
                    <input type="password" id="login-password" placeholder="Tu contraseña" value="">
                </div>
                <p id="login-error-message" class="error-message"></p>
                <button id="login-btn" class="auth-button">Entrar</button>
            </div>

            <div id="register-form" class="auth-form hidden">
                <div class="form-group">
                    <label for="register-username">Nombre de Usuario</label>
                    <input type="text" id="register-username" placeholder="Tu nombre de usuario">
                </div>
                <div class="form-group">
                    <label for="register-email">Correo Electrónico</label>
                    <input type="email" id="register-email" placeholder="Tu correo electrónico">
                </div>
                <div class="form-group">
                    <label for="register-password">Contraseña</label>
                    <input type="password" id="register-password" placeholder="Tu contraseña">
                </div>
                <p id="register-error-message" class="error-message"></p>
                <button id="register-btn" class="auth-button">Registrarse</button>
            </div>

            <div class="auth-footer">
                <p id="auth-toggle-text">¿No tienes una cuenta? <a id="show-register">Regístrate aquí</a></p>
                <p id="login-toggle-text" class="hidden">¿Ya tienes una cuenta? <a id="show-login">Inicia sesión</a></p>
            </div>
        </div>
    </div>

    <!-- Aplicación principal -->
    <div id="app-container" class="app-container hidden">
        <!-- Menú principal -->
        <div class="main-menu">
            <div class="menu-item active" title="Chats" data-panel="chats-panel">
                <i class="fas fa-comment-dots"></i>
            </div>
            <div class="menu-item" title="Contactos" data-panel="contacts-panel">
                <i class="fas fa-users"></i>
            </div>
            <div class="menu-item" title="Notificaciones" data-panel="notifications-panel">
                <i class="fas fa-bell"></i>
                <span class="notification-badge hidden" id="notification-badge">0</span>
            </div>
            <div class="menu-item" title="Configuración" data-panel="settings-panel">
                <i class="fas fa-cog"></i>
            </div>
            <div class="menu-item" title="Ayuda" data-panel="help-panel">
                <i class="fas fa-question-circle"></i>
            </div>
            <div class="user-avatar" title="Tu perfil" id="profile-btn">
                U
            </div>
        </div>

        <!-- Panel de chats -->
        <div class="content-panel active" id="chats-panel">
            <!-- Cabecera -->
            <div class="chats-header">
                <h2>Conversaciones</h2>
                <div class="header-actions">
                    <i class="fas fa-status"></i>
                    <i class="fas fa-edit" id="new-chat-btn"></i>
                    <i class="fas fa-ellipsis-vertical"></i>
                </div>
            </div>

            <!-- Buscador de chats-->
            <div class="search-container-chat">
                <div class="search-box-chat">
                    <i class="fas fa-search"></i>
                    <input type="text" id="search-input-chat" placeholder="Buscar o empezar un nuevo chat">
                </div>
            </div>

            <!-- Lista de chats -->
            <div class="chats-container" id="chats-list">
                <!-- Los chats se cargarán dinámicamente -->
            </div>
        </div>

        <!-- Panel de Contactos -->
        <div class="content-panel" id="contacts-panel">
            <div class="content-header">
                <h2 class="text-2xl font-bold">Contactos</h2>
                <p class="text-gray-400">Gestiona tus contactos y colaboradores</p>
                <button class="btn-primary" id="add-contact-btn">
                    <i class="fas fa-user-plus"></i> Agregar contacto
                </button>
            </div>
            <!-- Buscador de chats-->
            <div class="search-container-contacts">
                <div class="search-box-contacts">
                    <i class="fas fa-search"></i>
                    <input type="text" id="search-input-contacts" placeholder="Buscar contacto">
                </div>
            </div>
            <div class="content-body">
                <div class="contacts-section">
                    <h4>Contactos</h4>
                    <div id="contacts-list"></div>
                </div>
            </div>
        </div>

        <!-- Panel de Notificaciones -->
        <div class="content-panel" id="notifications-panel">
            <div class="content-header">
                <h2 class="text-2xl font-bold">Notificaciones</h2>
                <p class="text-gray-400">Revisa tus alertas y mensajes importantes</p>
                <button class="btn-secondary" id="mark-all-read-btn">
                    <i class="fas fa-check-double"></i> Marcar todas como leídas
                </button>
            </div>
            <div class="content-body">
                <div class="notifications-section">
                    <h4>Solicitudes de contacto</h4>
                    <div id="contact-requests-list"></div>
                </div>
                <div class="notifications-section">
                    <h4>Notificaciones</h4>
                    <div id="notifications-list"></div>
                </div>
            </div>
        </div>

        <!-- Panel de Configuración -->
        <div class="content-panel" id="settings-panel">
            <div class="content-header">
                <h2 class="text-2xl font-bold">Configuración</h2>
                <p class="text-gray-400">Personaliza tu experiencia con FoxIA</p>
            </div>
            <div class="content-body">
                <div class="setting-item">
                    <h3 class="text-lg font-medium mb-2">Preferencias de chat</h3>
                    <div class="flex items-center justify-between mb-4">
                        <span>Mostrar razonamiento del asistente</span>
                        <label class="switch">
                            <input type="checkbox" checked>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                <div class="setting-item">
                    <h3 class="text-lg font-medium mb-2">Privacidad</h3>
                    <div class="flex items-center justify-between mb-4">
                        <span>Guardar historial de conversaciones</span>
                        <label class="switch">
                            <input type="checkbox" checked>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Panel de Ayuda -->
        <div class="content-panel" id="help-panel">
            <div class="content-header">
                <h2 class="text-2xl font-bold">Centro de Ayuda</h2>
                <p class="text-gray-400">Encuentra respuestas y soporte técnico</p>
            </div>
            <div class="content-body">
                <div class="help-section mb-6">
                    <h3 class="text-lg font-medium mb-2">¿Cómo usar FoxIA?</h3>
                    <p class="text-gray-400 mb-4">FoxIA es un asistente cognitivo que puede ayudarte con una variedad de tareas. Simplemente escribe tus preguntas o solicitudes en el chat y FoxIA te responderá.</p>
                </div>
                <div class="help-section">
                    <h3 class="text-lg font-medium mb-2">Soporte Técnico</h3>
                    <p class="text-gray-400">Para reportar problemas o solicitar ayuda, contacta a nuestro equipo de soporte en support@foxia.com</p>
                </div>
            </div>
        </div>

        <!-- Panel de Perfil -->
        <div class="content-panel" id="profile-panel">
            <div class="content-header">
                <h2 class="text-2xl font-bold">Tu Perfil</h2>
                <p class="text-gray-400">Gestiona tu información personal</p>
            </div>
            <div class="content-body">
                <div class="profile-info mb-6">
                    <div class="flex items-center mb-4">
                        <div class="user-avatar large">U</div>
                        <div class="ml-4">
                            <h3 class="text-xl font-semibold" id="profile-username">Usuario</h3>
                            <p class="text-gray-400" id="profile-email">usuario@ejemplo.com</p>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="auth-button w-full mb-3">Editar Perfil</button>
                    <button class="auth-button secondary w-full" id="logout-btn">Cerrar Sesión</button>
                </div>
            </div>
        </div>

        <!-- Área de chat -->
        <div class="content-panel" id="chat-panel">
            <div class="chat-header">
                <div class="chat-partner">
                    <i class="fas fa-arrow-left back-button" id="back-button"></i>
                    <div class="chat-avatar">F</div>
                    <div>
                        <div class="chat-title" id="chat-title">FoxIA Assistant</div>
                        <div class="chat-status" id="connection-status">Desconectado</div>
                        <div class="chat-participants" id="chat-participants"></div>
                    </div>
                </div>
                <div class="chat-actions">
                    <i class="fas fa-search" id="search-messages-btn"></i>
                    <i class="fas fa-ellipsis-vertical"></i>
                </div>
            </div>

            <!-- Historial Cronológico -->
            <div id="chat-history-section" class="chat-history-section hidden">
                <div class="history-header">
                    <h4 class="text-md font-semibold">Historial Cronológico</h4>
                    <button id="toggle-history" class="toggle-btn"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div id="history-content" class="history-content"></div>
            </div>


            <!-- Área de mensajes -->
            <div class="messages-container" id="messages-container">

            </div>

            <!-- Tripletes Relevantes -->
            <div id="triplets-panel" class="triplets-panel hidden">
                <h4 class="text-md font-semibold">Tripletes Relevantes</h4>
                <div id="triplets-content"></div>
            </div>

            <!-- Indicador de pensamiento -->
            <div id="thinking-container" class="thinking-container hidden">
                <div class="thinking-dots">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                </div>
                <span>Pensando...</span>
            </div>

            <!-- Input de mensaje -->
            <div class="message-input-container">
                <!-- Selector de emojis movido aquí -->
                <div id="emoji-picker-container" class="hidden">
                    <emoji-picker id="emoji-picker" class="dark"></emoji-picker>
                </div>
                <div class="input-actions">
                    <i class="far fa-face-smile" id="emoji-btn" style="cursor: pointer;"></i>
                    <i class="fas fa-paperclip" id="attach-file-btn"></i>
                </div>
                <textarea id="message-input" class="message-input" placeholder="Escribe un mensaje" rows="1"></textarea>
                <div class="send-button" id="send-btn">
                    <i class="fas fa-paper-plane"></i>
                </div>
            </div>
        </div>
    </div>

    <script type="module" src="js/main.js"></script>

    <script>
            document.addEventListener("DOMContentLoaded", function() {
                // Opciones de renderizado de KaTeX
                window.katexRenderOptions = {
                    delimiters: [
                        {left: "$$", right: "$$", display: true}, // Para bloques $$...$$
                        {left: "$", right: "$", display: false},  // Para fórmulas en línea $...$
                        {left: "\\(", right: "\\)", display: false},
                        {left: "\\[", right: "\\]", display: true}
                    ],
                    throwOnError : false
                };
            });
        </script>

</body>
</html>
