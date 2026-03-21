import axios from 'axios';

/**
 * Central Axios instance.
 * In development, Vite proxy routes /api → VITE_BACKEND_URL (e.g. http://localhost:5000).
 * In production, set VITE_API_URL to your deployed backend URL (e.g. https://api.yourapp.com/api).
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 180000, // 3 minutes — AI Vision PDF extraction can take up to 2min
});

// Optional: request interceptor for future auth tokens
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // When sending FormData, remove Content-Type so the browser can set
    // the correct multipart/form-data header with the proper boundary
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    return config;
});

// Response error interceptor — auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;
        const url = err.config?.url || '';

        // If any request returns 401 (except the initial /auth/me check),
        // the token is invalid — clear it and redirect to login
        if (status === 401 && url !== '/auth/me') {
            localStorage.removeItem('token');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/') {
                window.location.href = '/login';
            }
        }

        // Suppress expected errors: 401 on auth check, 404 on notes fetch
        const isExpected =
            (status === 401 && url === '/auth/me') ||
            (status === 404 && url.startsWith('/notes/'));
        if (!isExpected) {
            console.error('API error:', err.response?.data?.error || err.message);
        }
        return Promise.reject(err);
    }
);

export default api;
