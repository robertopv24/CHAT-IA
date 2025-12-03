// /admin/js/admin.js - VERSIÓN MEJORADA Y COMPLETA

class AdminPanel {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.currentUser = null;
        this.currentSection = 'dashboard';
        this.settings = [];
        this.users = [];
        this.stats = {};
        this.logs = [];

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.checkAuthAndInitialize();
        });
    }

    // --- UTILIDADES MEJORADAS ---
    getToken() {
        const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
        if (!token) {
            console.warn('No se encontró token de autenticación');
        }
        return token;
    }

    deleteToken() {
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/admin;';
    }

    showNotification(message, type = 'info', duration = 5000) {
        // Eliminar notificaciones existentes
        document.querySelectorAll('.admin-notification').forEach(notification => {
            notification.remove();
        });

        const notification = document.createElement('div');
        notification.className = `admin-notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas fa-${
                        type === 'error' ? 'exclamation-triangle' :
                        type === 'success' ? 'check-circle' :
                        type === 'warning' ? 'exclamation-circle' :
                        'info-circle'
                    } mr-2"></i>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-lg hover:opacity-70">&times;</button>
            </div>
        `;
        document.body.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    }

    showLoading(message = 'Cargando...', container = 'admin-content') {
        const target = document.getElementById(container);
        if (target) {
            target.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p class="text-gray-400">${message}</p>
                </div>
            `;
        }
    }

    handleApiError(error, context = '') {
        console.error(`API Error${context ? ' en ' + context : ''}:`, error);

        if (error.message.includes('403') || error.message.includes('permisos')) {
            this.showNotification('No tienes permisos de administrador para realizar esta acción', 'error', 8000);
        } else if (error.message.includes('401')) {
            this.showNotification('Sesión expirada. Redirigiendo...', 'error', 3000);
            this.deleteToken();
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            this.showNotification(error.message || 'Error de conexión con el servidor', 'error');
        }
    }

    async apiRequest(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No hay token de autenticación');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(`${this.API_BASE_URL}${endpoint}`, config);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = {};
                }

                const errorMessage = errorData.error || `Error ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en API request a ${endpoint}:`, error);
            throw error;
        }
    }

    // --- AUTENTICACIÓN E INICIALIZACIÓN ---
    async checkAuthAndInitialize() {
        const token = this.getToken();

        if (!token) {
            this.showAuthError('No has iniciado sesión');
            return;
        }

        try {
            // Verificar perfil y permisos
            const profileData = await this.apiRequest('/api/user/profile');

            if (!profileData.profile || !profileData.profile.is_admin) {
                throw new Error('Acceso Denegado. No tienes permisos de administrador.');
            }

            this.currentUser = profileData.profile;
            this.initializeAdminPanel();

        } catch (error) {
            this.showAuthError(error.message);
        }
    }

    showAuthError(message) {
        const authMessage = document.getElementById('auth-message');
        if (authMessage) {
            authMessage.innerHTML = `
                <div class="text-center max-w-md mx-auto">
                    <div class="bg-red-500 text-white p-6 rounded-lg shadow-lg">
                        <i class="fas fa-exclamation-triangle text-3xl mb-4"></i>
                        <h2 class="text-xl font-bold mb-2">${message}</h2>
                        <p class="text-red-100 mb-4">Serás redirigido al portal principal.</p>
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                    </div>
                </div>
            `;
        }

        this.deleteToken();
        setTimeout(() => {
            window.location.href = '/';
        }, 4000);
    }

    // --- INTERFAZ DE USUARIO ---
    initializeAdminPanel() {
        document.getElementById('auth-message').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');

        this.createNavigation();
        this.loadSection('dashboard');
        this.setupEventListeners();

        this.showNotification(`Bienvenido al panel de administración, ${this.currentUser.name}`, 'success', 4000);
    }

    createNavigation() {
        const adminApp = document.getElementById('admin-app');

        adminApp.innerHTML = `
            <!-- Header -->
            <header class="bg-gray-900 shadow-lg border-b border-gray-700">
                <div class="max-w-7xl mx-auto px-4">
                    <div class="flex justify-between items-center h-16">
                        <div class="flex items-center">
                            <i class="fas fa-shield-alt text-blue-400 text-2xl mr-3"></i>
                            <h1 class="text-xl font-bold text-white">Panel de Administración</h1>
                            <span class="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded-full flex items-center">
                                <i class="fas fa-check-circle mr-1"></i>Admin Verificado
                            </span>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="text-right">
                                <div class="text-gray-300 text-sm">${this.currentUser.name}</div>
                                <div class="text-gray-400 text-xs">${this.currentUser.email}</div>
                            </div>
                            <button id="admin-logout-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-200 flex items-center">
                                <i class="fas fa-sign-out-alt mr-2"></i>Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Main Layout -->
            <div class="flex h-[calc(100vh-4rem)]">
                <!-- Sidebar -->
                <aside class="bg-gray-800 w-64 flex-shrink-0 border-r border-gray-700">
                    <div class="p-4 border-b border-gray-700">
                        <div class="text-sm text-gray-400">Usuario ID</div>
                        <div class="text-white font-mono text-sm">${this.currentUser.id}</div>
                        <div class="text-sm text-gray-400 mt-2">Último acceso</div>
                        <div class="text-white text-sm">${new Date().toLocaleDateString()}</div>
                    </div>

                    <nav class="p-4 space-y-2">
                        <button data-section="dashboard" class="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition duration-200 admin-nav-btn flex items-center ${this.currentSection === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300'}">
                            <i class="fas fa-tachometer-alt mr-3 w-5"></i>Dashboard
                        </button>
                        <button data-section="users" class="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition duration-200 admin-nav-btn flex items-center ${this.currentSection === 'users' ? 'bg-blue-600 text-white' : 'text-gray-300'}">
                            <i class="fas fa-users mr-3 w-5"></i>Gestión de Usuarios
                        </button>
                        <button data-section="settings" class="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition duration-200 admin-nav-btn flex items-center ${this.currentSection === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-300'}">
                            <i class="fas fa-cog mr-3 w-5"></i>Configuraciones
                        </button>
                        <button data-section="system" class="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition duration-200 admin-nav-btn flex items-center ${this.currentSection === 'system' ? 'bg-blue-600 text-white' : 'text-gray-300'}">
                            <i class="fas fa-server mr-3 w-5"></i>Sistema
                        </button>
                        <button data-section="logs" class="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition duration-200 admin-nav-btn flex items-center ${this.currentSection === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-300'}">
                            <i class="fas fa-clipboard-list mr-3 w-5"></i>Logs del Sistema
                        </button>
                    </nav>
                </aside>

                <!-- Main Content -->
                <main class="flex-1 bg-gray-900 overflow-auto">
                    <div id="admin-main-content" class="p-6">
                        <!-- El contenido se carga aquí dinámicamente -->
                    </div>
                </main>
            </div>
        `;
    }

    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.loadSection(section);
            });
        });

        // Logout
        document.getElementById('admin-logout-btn').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas cerrar sesión del panel de administración?')) {
                this.deleteToken();
                this.showNotification('Sesión cerrada correctamente', 'success', 3000);
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            }
        });
    }

    // --- CARGA DE SECCIONES ---
    async loadSection(section) {
        this.currentSection = section;

        // Actualizar navegación activa
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('text-gray-300');
            if (btn.dataset.section === section) {
                btn.classList.add('bg-blue-600', 'text-white');
                btn.classList.remove('text-gray-300');
            }
        });

        this.showLoading(`Cargando ${this.getSectionTitle(section)}...`, 'admin-main-content');

        try {
            switch (section) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'system':
                    await this.loadSystemInfo();
                    break;
                case 'logs':
                    await this.loadLogs();
                    break;
                default:
                    await this.loadDashboard();
            }
        } catch (error) {
            this.handleApiError(error, `cargando sección ${section}`);
        }
    }

    getSectionTitle(section) {
        const titles = {
            dashboard: 'Dashboard',
            users: 'Gestión de Usuarios',
            settings: 'Configuraciones',
            system: 'Información del Sistema',
            logs: 'Logs del Sistema'
        };
        return titles[section] || 'Sección';
    }

    // --- DASHBOARD MEJORADO ---
    async loadDashboard() {
        const mainContent = document.getElementById('admin-main-content');

        try {
            const [statsData, systemData, usersData] = await Promise.all([
                this.apiRequest('/api/admin/stats').catch(() => ({ stats: {} })),
                this.apiRequest('/api/system/info').catch(() => ({})),
                this.apiRequest('/api/admin/users?limit=5').catch(() => ({ users: [] }))
            ]);

            const stats = statsData.stats || {};
            const systemInfo = systemData || {};
            const recentUsers = usersData.users || [];

            mainContent.innerHTML = `
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-white mb-6">Dashboard de Administración</h2>

                    <!-- Estadísticas Principales -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                            <div class="flex items-center">
                                <div class="p-3 rounded-full bg-blue-500 text-white mr-4">
                                    <i class="fas fa-users text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">Usuarios Totales</p>
                                    <p class="text-2xl font-bold text-white">${stats.users?.total_users || 0}</p>
                                    <p class="text-xs text-green-400">${stats.users?.active_users || 0} activos</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                            <div class="flex items-center">
                                <div class="p-3 rounded-full bg-green-500 text-white mr-4">
                                    <i class="fas fa-comments text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">Mensajes Totales</p>
                                    <p class="text-2xl font-bold text-white">${stats.messages?.total_messages || 0}</p>
                                    <p class="text-xs text-blue-400">${stats.recent_activity?.messages_24h || 0} hoy</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                            <div class="flex items-center">
                                <div class="p-3 rounded-full bg-purple-500 text-white mr-4">
                                    <i class="fas fa-comment-dots text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">Chats Activos</p>
                                    <p class="text-2xl font-bold text-white">${stats.chats?.total_chats || 0}</p>
                                    <p class="text-xs text-yellow-400">${stats.recent_activity?.new_chats_24h || 0} nuevos</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                            <div class="flex items-center">
                                <div class="p-3 rounded-full bg-yellow-500 text-white mr-4">
                                    <i class="fas fa-shield-alt text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">Administradores</p>
                                    <p class="text-2xl font-bold text-white">${stats.users?.admin_users || 0}</p>
                                    <p class="text-xs text-gray-400">de ${stats.users?.total_users || 0} usuarios</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Usuarios Recientes -->
                        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                                <i class="fas fa-clock mr-2"></i>Usuarios Recientes
                            </h3>
                            <div class="space-y-3">
                                ${recentUsers.length > 0 ? recentUsers.map(user => `
                                    <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                        <div class="flex items-center">
                                            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                                                ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div class="text-white text-sm font-medium">${user.name || 'Sin nombre'}</div>
                                                <div class="text-gray-400 text-xs">${user.email}</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-xs text-gray-400">${new Date(user.created_at).toLocaleDateString()}</div>
                                            <span class="inline-block w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}"></span>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div class="text-center text-gray-400 py-4">
                                        <i class="fas fa-users text-2xl mb-2"></i>
                                        <p>No hay usuarios recientes</p>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Información del Sistema -->
                        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                                <i class="fas fa-info-circle mr-2"></i>Información del Sistema
                            </h3>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">PHP Version:</span>
                                    <span class="text-white font-mono">${systemInfo.php_version || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Servidor:</span>
                                    <span class="text-white">${systemInfo.server_software || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Memoria:</span>
                                    <span class="text-white">${systemInfo.memory_usage ? (systemInfo.memory_usage / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Usuario Admin:</span>
                                    <span class="text-green-400 font-medium">${this.currentUser.email}</span>
                                </div>
                                <div class="flex justify-between items-center py-2">
                                    <span class="text-gray-400">Hora del Servidor:</span>
                                    <span class="text-white">${new Date().toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Actividad Reciente -->
                    <div class="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                            <i class="fas fa-chart-line mr-2"></i>Actividad Reciente (24h)
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="text-center p-4 bg-gray-700 rounded-lg">
                                <div class="text-2xl font-bold text-blue-400">${stats.recent_activity?.active_users_24h || 0}</div>
                                <div class="text-gray-400 text-sm">Usuarios Activos</div>
                            </div>
                            <div class="text-center p-4 bg-gray-700 rounded-lg">
                                <div class="text-2xl font-bold text-green-400">${stats.recent_activity?.messages_24h || 0}</div>
                                <div class="text-gray-400 text-sm">Mensajes Enviados</div>
                            </div>
                            <div class="text-center p-4 bg-gray-700 rounded-lg">
                                <div class="text-2xl font-bold text-purple-400">${stats.recent_activity?.new_chats_24h || 0}</div>
                                <div class="text-gray-400 text-sm">Nuevos Chats</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            throw error;
        }
    }

    // --- GESTIÓN DE USUARIOS MEJORADA ---
    async loadUsers(page = 1, search = '', status = '', role = '') {
        const mainContent = document.getElementById('admin-main-content');

        try {
            const params = new URLSearchParams({
                page: page,
                limit: 20,
                ...(search && { search }),
                ...(status && { status }),
                ...(role && { role })
            });

            const data = await this.apiRequest(`/api/admin/users?${params}`);

            mainContent.innerHTML = `
                <div class="mb-8">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                        <h2 class="text-2xl font-bold text-white">Gestión de Usuarios</h2>
                        <div class="flex flex-wrap gap-2">
                            <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                                ${data.pagination?.total || 0} usuarios
                            </span>
                            <span class="bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                                <i class="fas fa-check-circle mr-1"></i>Admin DB Verificado
                            </span>
                        </div>
                    </div>

                    <!-- Filtros -->
                    <div class="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Buscar</label>
                                <input type="text" id="user-search" value="${search}"
                                       placeholder="Email o nombre..."
                                       class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Estado</label>
                                <select id="user-status" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                                    <option value="">Todos</option>
                                    <option value="active" ${status === 'active' ? 'selected' : ''}>Activos</option>
                                    <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactivos</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Rol</label>
                                <select id="user-role" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                                    <option value="">Todos</option>
                                    <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administradores</option>
                                    <option value="user" ${role === 'user' ? 'selected' : ''}>Usuarios</option>
                                </select>
                            </div>
                            <div class="flex items-end">
                                <button id="apply-filters" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm">
                                    Aplicar Filtros
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de Usuarios -->
                    ${data.users && data.users.length > 0 ? `
                        <div class="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-700">
                                    <thead class="bg-gray-750">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rol</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Registro</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actividad</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-gray-800 divide-y divide-gray-700">
                                        ${data.users.map(user => `
                                            <tr class="hover:bg-gray-750 transition duration-150">
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="flex items-center">
                                                        <div class="flex-shrink-0 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                            ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                                        </div>
                                                        <div class="ml-4">
                                                            <div class="text-sm font-medium text-white">${user.name || 'Sin nombre'}</div>
                                                            <div class="text-sm text-gray-400">${user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <span class="px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}">
                                                        ${user.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                    ${user.email_verified ? `
                                                        <span class="ml-1 px-2 py-1 text-xs rounded-full bg-blue-500 text-white">
                                                            Verificado
                                                        </span>
                                                    ` : ''}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <span class="px-2 py-1 text-xs rounded-full ${user.is_admin ? 'bg-purple-500 text-white' : 'bg-gray-500 text-gray-300'}">
                                                        ${user.is_admin ? 'Administrador' : 'Usuario'}
                                                    </span>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                    ${new Date(user.created_at).toLocaleDateString()}
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm text-gray-300">Mensajes: ${user.message_count || 0}</div>
                                                    <div class="text-sm text-gray-300">Chats: ${user.chat_count || 0}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div class="flex space-x-2">
                                                        ${user.is_active ? `
                                                            <button onclick="adminPanel.deactivateUser(${user.id})"
                                                                    class="text-red-400 hover:text-red-300 transition duration-150"
                                                                    title="Desactivar usuario">
                                                                <i class="fas fa-user-slash"></i>
                                                            </button>
                                                        ` : `
                                                            <button onclick="adminPanel.activateUser(${user.id})"
                                                                    class="text-green-400 hover:text-green-300 transition duration-150"
                                                                    title="Activar usuario">
                                                                <i class="fas fa-user-check"></i>
                                                            </button>
                                                        `}

                                                        ${!user.is_admin ? `
                                                            <button onclick="adminPanel.makeAdmin(${user.id})"
                                                                    class="text-purple-400 hover:text-purple-300 transition duration-150"
                                                                    title="Hacer administrador">
                                                                <i class="fas fa-crown"></i>
                                                            </button>
                                                        ` : user.id !== this.currentUser.id ? `
                                                            <button onclick="adminPanel.removeAdmin(${user.id})"
                                                                    class="text-yellow-400 hover:text-yellow-300 transition duration-150"
                                                                    title="Quitar administrador">
                                                                <i class="fas fa-user"></i>
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Paginación -->
                        ${data.pagination && data.pagination.pages > 1 ? `
                            <div class="mt-6 flex justify-center">
                                <div class="flex space-x-2">
                                    ${Array.from({length: data.pagination.pages}, (_, i) => i + 1).map(pageNum => `
                                        <button onclick="adminPanel.loadUsersPage(${pageNum}, '${search}', '${status}', '${role}')"
                                                class="px-3 py-1 rounded ${pageNum === page ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">
                                            ${pageNum}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                            <i class="fas fa-users text-4xl text-gray-500 mb-4"></i>
                            <h3 class="text-xl font-semibold text-gray-300 mb-2">No se encontraron usuarios</h3>
                            <p class="text-gray-400">No hay usuarios que coincidan con los filtros aplicados.</p>
                        </div>
                    `}
                </div>
            `;

            // Configurar event listeners para filtros
            this.setupUserFilters();

        } catch (error) {
            throw error;
        }
    }

    setupUserFilters() {
        const applyFilters = () => {
            const search = document.getElementById('user-search').value;
            const status = document.getElementById('user-status').value;
            const role = document.getElementById('user-role').value;
            this.loadUsers(1, search, status, role);
        };

        document.getElementById('apply-filters').addEventListener('click', applyFilters);

        // Enter en búsqueda
        document.getElementById('user-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }

    async loadUsersPage(page, search, status, role) {
        await this.loadUsers(page, search, status, role);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- GESTIÓN DE USUARIOS - ACCIONES ---
    async deactivateUser(userId) {
        if (!confirm('¿Estás seguro de que deseas desactivar este usuario?')) return;

        try {
            await this.apiRequest('/api/admin/manage-user', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    action: 'deactivate'
                })
            });

            this.showNotification('Usuario desactivado correctamente', 'success');
            this.loadUsers(); // Recargar lista
        } catch (error) {
            this.handleApiError(error, 'desactivar usuario');
        }
    }

    async activateUser(userId) {
        try {
            await this.apiRequest('/api/admin/manage-user', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    action: 'activate'
                })
            });

            this.showNotification('Usuario activado correctamente', 'success');
            this.loadUsers();
        } catch (error) {
            this.handleApiError(error, 'activar usuario');
        }
    }

    async makeAdmin(userId) {
        if (!confirm('¿Estás seguro de que deseas convertir este usuario en administrador?')) return;

        try {
            await this.apiRequest('/api/admin/manage-user', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    action: 'make_admin'
                })
            });

            this.showNotification('Permisos de administrador concedidos', 'success');
            this.loadUsers();
        } catch (error) {
            this.handleApiError(error, 'hacer administrador');
        }
    }

    async removeAdmin(userId) {
        if (!confirm('¿Estás seguro de que deseas quitar los permisos de administrador?')) return;

        try {
            await this.apiRequest('/api/admin/manage-user', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    action: 'remove_admin'
                })
            });

            this.showNotification('Permisos de administrador revocados', 'warning');
            this.loadUsers();
        } catch (error) {
            this.handleApiError(error, 'quitar administrador');
        }
    }

    // --- CONFIGURACIONES DEL SISTEMA ---
    async loadSettings() {
        const mainContent = document.getElementById('admin-main-content');

        try {
            const data = await this.apiRequest('/api/admin/settings');

            mainContent.innerHTML = `
                <div class="mb-8">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-white">Configuraciones del Sistema</h2>
                        <div class="flex space-x-4">
                            <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">${data.count} configuraciones</span>
                            <span class="bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                                <i class="fas fa-check-circle mr-1"></i>Admin DB Verificado
                            </span>
                        </div>
                    </div>

                    ${data.settings && data.settings.length > 0 ? `
                        <div class="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-700">
                                    <thead class="bg-gray-750">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Clave</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Valor</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Descripción</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-gray-800 divide-y divide-gray-700">
                                        ${data.settings.map((setting, index) => `
                                            <tr class="hover:bg-gray-750 transition duration-150">
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <div class="text-sm font-medium text-white">${setting.setting_key}</div>
                                                    <div class="text-xs text-gray-400">${setting.data_type || 'string'}</div>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <div class="text-sm text-gray-300 font-mono bg-gray-900 px-2 py-1 rounded max-w-xs truncate">${setting.setting_value}</div>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <div class="text-sm text-gray-400">${setting.description || 'Sin descripción'}</div>
                                                </td>
                                                <td class="px-6 py-4 whitespace-nowrap">
                                                    <button onclick="adminPanel.editSetting('${setting.setting_key}', '${setting.setting_value.replace(/'/g, "\\'")}', '${setting.description.replace(/'/g, "\\'")}')"
                                                            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2 transition duration-150">
                                                        <i class="fas fa-edit mr-1"></i>Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : `
                        <div class="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                            <i class="fas fa-cog text-4xl text-gray-500 mb-4"></i>
                            <h3 class="text-xl font-semibold text-gray-300 mb-2">No hay configuraciones</h3>
                            <p class="text-gray-400">No se encontraron configuraciones del sistema.</p>
                        </div>
                    `}
                </div>
            `;

        } catch (error) {
            throw error;
        }
    }

    editSetting(key, value, description) {
        const newValue = prompt(`Editar configuración: ${key}\n\nDescripción: ${description}\n\nValor actual: ${value}\n\nNuevo valor:`, value);

        if (newValue !== null && newValue !== value) {
            this.updateSetting(key, newValue);
        }
    }

    async updateSetting(key, value) {
        try {
            await this.apiRequest('/api/admin/update-setting', {
                method: 'POST',
                body: JSON.stringify({
                    key: key,
                    value: value
                })
            });

            this.showNotification(`Configuración "${key}" actualizada correctamente`, 'success');
            this.loadSettings(); // Recargar configuraciones
        } catch (error) {
            this.handleApiError(error, 'actualizar configuración');
        }
    }

    // --- INFORMACIÓN DEL SISTEMA ---
    async loadSystemInfo() {
        const mainContent = document.getElementById('admin-main-content');

        try {
            const [systemRes, storageRes] = await Promise.allSettled([
                this.apiRequest('/api/system/info').catch(() => ({})),
                this.apiRequest('/api/system/storage-stats').catch(() => ({ storage_stats: {} }))
            ]);

            const systemInfo = systemRes.status === 'fulfilled' ? systemRes.value : {};
            const storageStats = storageRes.status === 'fulfilled' ? storageRes.value : { storage_stats: {} };

            mainContent.innerHTML = `
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-white mb-6">Información del Sistema</h2>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <!-- Información del Servidor -->
                        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                                <i class="fas fa-server mr-2"></i>Servidor
                            </h3>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">PHP Version:</span>
                                    <span class="text-white font-mono">${systemInfo.php_version || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Servidor:</span>
                                    <span class="text-white">${systemInfo.server_software || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Memoria Usada:</span>
                                    <span class="text-white">${systemInfo.memory_usage ? (systemInfo.memory_usage / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                                    <span class="text-gray-400">Memoria Pico:</span>
                                    <span class="text-white">${systemInfo.memory_peak ? (systemInfo.memory_peak / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</span>
                                </div>
                                <div class="flex justify-between items-center py-2">
                                    <span class="text-gray-400">Hora del Sistema:</span>
                                    <span class="text-white">${new Date().toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Almacenamiento -->
                        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                                <i class="fas fa-hdd mr-2"></i>Almacenamiento
                            </h3>
                            ${storageStats.storage_stats ? `
                                <div class="space-y-4">
                                    <div>
                                        <div class="flex justify-between text-sm text-gray-400 mb-1">
                                            <span>Uso Total</span>
                                            <span>${(storageStats.storage_stats.total_size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                        <div class="w-full bg-gray-700 rounded-full h-2">
                                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min(100, (storageStats.storage_stats.total_size / (1024 * 1024 * 100)) * 100)}%"></div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-4 text-sm">
                                        <div class="text-center p-3 bg-gray-700 rounded">
                                            <div class="text-blue-400 font-bold text-xl">${storageStats.storage_stats.avatar_files || 0}</div>
                                            <div class="text-gray-400">Avatares</div>
                                        </div>
                                        <div class="text-center p-3 bg-gray-700 rounded">
                                            <div class="text-green-400 font-bold text-xl">${storageStats.storage_stats.chat_files || 0}</div>
                                            <div class="text-gray-400">Archivos</div>
                                        </div>
                                        <div class="text-center p-3 bg-gray-700 rounded">
                                            <div class="text-yellow-400 font-bold text-xl">${storageStats.storage_stats.temp_files || 0}</div>
                                            <div class="text-gray-400">Temporales</div>
                                        </div>
                                        <div class="text-center p-3 bg-gray-700 rounded">
                                            <div class="text-purple-400 font-bold text-xl">${storageStats.storage_stats.cache_files || 0}</div>
                                            <div class="text-gray-400">Cache</div>
                                        </div>
                                    </div>
                                </div>
                            ` : '<p class="text-gray-400">No hay datos de almacenamiento disponibles</p>'}
                        </div>
                    </div>

                    <!-- Estado de Servicios -->
                    <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
                            <i class="fas fa-heartbeat mr-2"></i>Estado de Servicios
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div class="flex items-center p-3 bg-gray-700 rounded">
                                <div class="w-3 h-3 rounded-full bg-green-500 mr-3 animate-pulse"></div>
                                <div>
                                    <div class="text-white font-medium">Servidor Web</div>
                                    <div class="text-gray-400 text-sm">En funcionamiento</div>
                                </div>
                            </div>
                            <div class="flex items-center p-3 bg-gray-700 rounded">
                                <div class="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
                                <div>
                                    <div class="text-white font-medium">Base de Datos</div>
                                    <div class="text-gray-400 text-sm">Conectada</div>
                                </div>
                            </div>
                            <div class="flex items-center p-3 bg-gray-700 rounded">
                                <div class="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
                                <div>
                                    <div class="text-white font-medium">Servicio de Archivos</div>
                                    <div class="text-gray-400 text-sm">Activo</div>
                                </div>
                            </div>
                            <div class="flex items-center p-3 bg-gray-700 rounded">
                                <div class="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
                                <div>
                                    <div class="text-white font-medium">Panel de Admin</div>
                                    <div class="text-gray-400 text-sm">Operativo</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            throw error;
        }
    }

    // --- LOGS DEL SISTEMA ---
    async loadLogs() {
        const mainContent = document.getElementById('admin-main-content');

        try {
            const data = await this.apiRequest('/api/admin/logs?limit=50');

            mainContent.innerHTML = `
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-white mb-6">Logs del Sistema</h2>

                    <!-- Filtros -->
                    <div class="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Nivel</label>
                                <select id="log-level" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                                    <option value="">Todos los niveles</option>
                                    <option value="INFO">INFO</option>
                                    <option value="DEBUG">DEBUG</option>
                                    <option value="WARNING">WARNING</option>
                                    <option value="ERROR">ERROR</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm text-gray-400 mb-2">Buscar en mensajes</label>
                                <input type="text" id="log-search"
                                       placeholder="Buscar..."
                                       class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                            </div>
                            <div class="flex items-end">
                                <button id="refresh-logs" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm flex items-center justify-center">
                                    <i class="fas fa-sync-alt mr-2"></i>Actualizar Logs
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Lista de Logs -->
                    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-700">
                                <thead class="bg-gray-750">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nivel</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mensaje</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">IP</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-gray-800 divide-y divide-gray-700">
                                    ${data.logs && data.logs.length > 0 ? data.logs.map(log => `
                                        <tr class="hover:bg-gray-750 transition duration-150">
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                ${new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap">
                                                <span class="px-2 py-1 text-xs rounded-full ${
                                                    log.level === 'ERROR' ? 'bg-red-500 text-white' :
                                                    log.level === 'WARNING' ? 'bg-yellow-500 text-white' :
                                                    log.level === 'INFO' ? 'bg-blue-500 text-white' :
                                                    'bg-gray-500 text-white'
                                                }">
                                                    ${log.level}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4">
                                                <div class="text-sm text-white">${log.message}</div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                ${log.user_id || 'Sistema'}
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                                                ${log.ip || 'N/A'}
                                            </td>
                                        </tr>
                                    `).join('') : `
                                        <tr>
                                            <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                                                <i class="fas fa-clipboard-list text-2xl mb-2"></i>
                                                <p>No hay logs disponibles</p>
                                            </td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${data.logs && data.logs.length > 0 ? `
                        <div class="mt-4 text-center">
                            <button class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-200 opacity-50 cursor-not-allowed" disabled>
                                <i class="fas fa-download mr-2"></i>Descargar Logs Completos (Próximamente)
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;

            // Configurar event listeners para logs
            this.setupLogsFilters();

        } catch (error) {
            throw error;
        }
    }

    setupLogsFilters() {
        document.getElementById('refresh-logs').addEventListener('click', () => {
            this.loadLogs();
        });
    }
}

// Inicializar el panel de administración
const adminPanel = new AdminPanel();
