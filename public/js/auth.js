const AUTH_TOKEN_KEY = 'authToken';
const USER_DATA_KEY = 'user';

// Store token after login
function storeToken(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    // Also set cookies for server-side rendering
    var maxAge = 24 * 60 * 60; // 1 day in seconds
    document.cookie = 'token=' + token + '; path=/; max-age=' + maxAge;
    document.cookie = 'user=' + encodeURIComponent(JSON.stringify(user)) + '; path=/; max-age=' + maxAge;
    updateNavbar();
}

// Get stored token
function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Get stored user data
function getUser() {
    const u = localStorage.getItem(USER_DATA_KEY);
    return u ? JSON.parse(u) : null;
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// Logout
function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    // Clear cookies too
    document.cookie = 'token=; path=/; max-age=0';
    document.cookie = 'user=; path=/; max-age=0';
    updateNavbar();
    window.location.href = '/auth/logout';
}

// Small wrapper that injects Authorization header automatically
async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    const token = getToken();
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, options);
}

// Update navbar UI (called on load and after login/logout)
function updateNavbar() {
    const loggedOut = document.querySelectorAll('[data-show-if-logged-out]');
    const loggedIn = document.querySelectorAll('[data-show-if-logged-in]');
    if (isLoggedIn()) {
        const user = getUser();
        loggedOut.forEach(el => el.style.display = 'none');
        loggedIn.forEach(el => el.style.display = 'block');
        const usernameEl = document.getElementById('username');
        if (usernameEl && user) usernameEl.textContent = `Welcome, ${user.username}`;
    } else {
        loggedOut.forEach(el => el.style.display = 'block');
        loggedIn.forEach(el => el.style.display = 'none');
    }
}

document.addEventListener('DOMContentLoaded', updateNavbar);

// Export helpers to global scope (for inline scripts in views)
window.storeToken = storeToken;
window.getToken = getToken;
window.getUser = getUser;
window.isLoggedIn = isLoggedIn;
window.logout = logout;
window.authFetch = authFetch;
