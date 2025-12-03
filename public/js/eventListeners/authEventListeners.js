// eventListeners/authEventListeners.js - Listeners de autenticación
import { handleLogin, handleRegister, handleLogout, showLoginForm, showRegisterForm } from '../auth.js';

export class AuthEventListeners {
    static async setup() {
        await this.setupAuthFormListeners();
        await this.setupLogoutListener();
        console.log('✅ Auth event listeners configurados');
    }

    static async setupAuthFormListeners() {
        const { elements } = await import('../elements.js');

        if (elements.loginBtn) {
            elements.loginBtn.removeEventListener('click', handleLogin);
            elements.loginBtn.addEventListener('click', handleLogin);
        }

        if (elements.registerBtn) {
            elements.registerBtn.removeEventListener('click', handleRegister);
            elements.registerBtn.addEventListener('click', handleRegister);
        }

        if (elements.showRegisterLink) {
            elements.showRegisterLink.removeEventListener('click', showRegisterForm);
            elements.showRegisterLink.addEventListener('click', showRegisterForm);
        }

        if (elements.showLoginLink) {
            elements.showLoginLink.removeEventListener('click', showLoginForm);
            elements.showLoginLink.addEventListener('click', showLoginForm);
        }
    }

    static async setupLogoutListener() {
        const { elements } = await import('../elements.js');

        if (elements.logoutBtn) {
            elements.logoutBtn.removeEventListener('click', handleLogout);
            elements.logoutBtn.addEventListener('click', handleLogout);
        }
    }
}
