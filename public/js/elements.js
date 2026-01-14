// elements.js - Cache centralizado de elementos del DOM
export const elements = {
    // Autenticación
    authScreen: document.getElementById('auth-screen'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginBtn: document.getElementById('login-btn'),
    loginErrorMessage: document.getElementById('login-error-message'),
    registerUsername: document.getElementById('register-username'),
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    registerBtn: document.getElementById('register-btn'),
    registerErrorMessage: document.getElementById('register-error-message'),
    showRegisterLink: document.getElementById('show-register'),
    showLoginLink: document.getElementById('show-login'),
    logoutBtn: document.getElementById('logout-btn'),

    // Navegación principal
    menuItems: document.querySelectorAll('.menu-item'),
    contentPanels: document.querySelectorAll('.content-panel'),
    profileBtn: document.getElementById('profile-btn'),
    profileUsername: document.getElementById('profile-username'),
    profileEmail: document.getElementById('profile-email'),

    // Panel de chats
    chatsPanel: document.getElementById('chats-panel'),
    chatsList: document.getElementById('chats-list'),
    searchInputChat: document.getElementById('search-input-chat'),
    newChatBtn: document.getElementById('new-chat-btn'),
    newChatMenu: document.getElementById('new-chat-menu'),
    createAiChatBtn: document.getElementById('create-ai-chat-btn'),
    createGroupChatBtn: document.getElementById('create-group-chat-btn'),
    messageContactBtn: document.getElementById('message-contact-btn'),

    // Panel de chat
    chatPanel: document.getElementById('chat-panel'),
    chatTitle: document.getElementById('chat-title'),
    connectionStatus: document.getElementById('connection-status'),
    backButton: document.getElementById('back-button'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    thinkingContainer: document.getElementById('thinking-container'),
    searchMessagesBtn: document.getElementById('search-messages-btn'),
    attachFileBtn: document.getElementById('attach-file-btn'),

    // Panel de contactos
    contactsList: document.getElementById('contacts-list'),
    addContactBtn: document.getElementById('add-contact-btn'),
    contactSearchInput: document.getElementById('search-input-contacts'),

    // Panel de notificaciones
    notificationBadge: document.getElementById('notification-badge'),
    notificationsList: document.getElementById('notifications-list'),
    markAllReadBtn: document.getElementById('mark-all-read-btn'),

    // Elementos de UI general
    notification: document.getElementById('notification'),
    tripletsPanel: document.getElementById('triplets-panel'),
    tripletsContent: document.getElementById('triplets-content'),
    chatHistorySection: document.getElementById('chat-history-section'),
    historyContent: document.getElementById('history-content'),
    toggleHistoryBtn: document.getElementById('toggle-history'),

    // Menús contextuales
    contextMenu: document.getElementById('context-menu'),
    contextRenameBtn: document.getElementById('context-rename'),
    contextDeleteBtn: document.getElementById('context-delete'),

    contactContextMenu: document.getElementById('contact-context-menu'),
    contextContactRenameBtn: document.getElementById('context-contact-rename'),
    contextContactBlockBtn: document.getElementById('context-contact-block'),
    contextContactDeleteBtn: document.getElementById('context-contact-delete'),

    messageContextMenu: document.getElementById('message-context-menu'),
    contextMessageReplyBtn: document.getElementById('context-message-reply'),
    contextMessageCopyBtn: document.getElementById('context-message-copy'),
    contextMessageDeleteBtn: document.getElementById('context-message-delete'),

    // Modales
    userAddModal: document.getElementById('user-add-modal'),
    userAddInput: document.getElementById('user-add-input'),
    modalAddContactBtn: document.getElementById('modal-add-contact-btn'),
    userSearchCancelBtn: document.getElementById('user-search-cancel'),

    renameModal: document.getElementById('rename-modal'),
    renameInput: document.getElementById('rename-input'),
    renameConfirmBtn: document.getElementById('rename-confirm'),
    renameCancelBtn: document.getElementById('rename-cancel'),

    nicknameModal: document.getElementById('nickname-modal'),
    nicknameInput: document.getElementById('nickname-input'),
    nicknameConfirmBtn: document.getElementById('nickname-confirm'),
    nicknameCancelBtn: document.getElementById('nickname-cancel'),


    // File Upload
    fileUploadModal: document.getElementById('file-upload-modal'),
    fileUpload: document.getElementById('file-upload'),
    fileUploadList: document.getElementById('file-upload-list'),
    fileUploadConfirm: document.getElementById('file-upload-confirm'),
    fileUploadCancel: document.getElementById('file-upload-cancel'),

    // Avatar Upload
    avatarUploadModal: null, // Se creará dinámicamente
    avatarUploadInput: null,
    avatarPreview: null,
    avatarUploadCancel: null,
    avatarUploadConfirm: null,


    messageSearchModal: document.getElementById('message-search-modal'),
    messageSearchInput: document.getElementById('message-search-input'),
    messageSearchBtn: document.getElementById('message-search-btn'),
    messageSearchResults: document.getElementById('message-search-results'),
    messageSearchCloseBtn: document.getElementById('message-search-close-btn'),

    // Elementos de emojis
    emojiBtn: document.getElementById('emoji-btn'),
    emojiPickerContainer: document.getElementById('emoji-picker-container'),
    emojiPicker: document.querySelector('emoji-picker'),

    // Elementos de respuesta
    replyingToBar: document.getElementById('replying-to-bar'),
    replyingToText: document.getElementById('replying-to-text'),
    cancelReplyBtn: document.getElementById('cancel-reply-btn'),

    // Elementos de tripletes (si existen)
    tripletEditModal: document.getElementById('triplet-edit-modal'),
    tripletId: document.getElementById('triplet-id'),
    tripletSubject: document.getElementById('triplet-subject'),
    tripletPredicate: document.getElementById('triplet-predicate'),
    tripletObject: document.getElementById('triplet-object'),
    tripletCancel: document.getElementById('triplet-cancel'),
    tripletConfirm: document.getElementById('triplet-confirm'),

    // Grupos
    groupCreateModal: document.getElementById('group-create-modal'),
    groupNameInput: document.getElementById('group-name-input'),
    groupContactSearch: document.getElementById('group-contact-search'),
    groupParticipantsList: document.getElementById('group-participants-list'),
    groupCreateConfirmBtn: document.getElementById('group-create-confirm'),
    groupCreateCancelBtn: document.getElementById('group-create-cancel')
};

// Función para verificar que los elementos críticos existen
export function validateCriticalElements() {
    const criticalElements = [
        'authScreen', 'appContainer', 'chatsList', 'messagesContainer',
        'messageInput', 'sendBtn', 'chatPanel', 'chatsPanel'
    ];

    const missingElements = criticalElements.filter(key => !elements[key]);

    if (missingElements.length > 0) {
        console.warn('⚠️ Elementos críticos faltantes:', missingElements);
        return false;
    }

    return true;
}

// Función para inicializar elementos dinámicos
export function initializeDynamicElements() {
    // Elementos que pueden ser creados dinámicamente
    elements.menuItems = document.querySelectorAll('.menu-item');
    elements.emojiPicker = document.querySelector('emoji-picker');

    // Botón y menú de nuevo chat
    elements.newChatBtn = document.getElementById('new-chat-btn');
    elements.newChatMenu = document.getElementById('new-chat-menu');

    // Elementos del menú de nuevo chat
    elements.createAiChatBtn = document.getElementById('create-ai-chat-btn');
    elements.createGroupChatBtn = document.getElementById('create-group-chat-btn');
    elements.messageContactBtn = document.getElementById('message-contact-btn');

    // Modales de grupos
    elements.groupCreateModal = document.getElementById('group-create-modal');
    elements.groupNameInput = document.getElementById('group-name-input');
    elements.groupContactSearch = document.getElementById('group-contact-search');
    elements.groupParticipantsList = document.getElementById('group-participants-list');
    elements.groupCreateConfirmBtn = document.getElementById('group-create-confirm');
    elements.groupCreateCancelBtn = document.getElementById('group-create-cancel');

    console.log('✅ Elementos dinámicos inicializados');
}
