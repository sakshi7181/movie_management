// api.js

// === CSRF token helper ===
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Check if cookie starts with name=
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Provide a hoisted helper that reads the cookie on demand to avoid TDZ errors
function getCsrfToken() { return getCookie('csrftoken'); }
window.getCsrfToken = getCsrfToken;

// Quick runtime diagnostic: mark that api.js loaded and expose csrf helper
console.log('api.js loaded — csrftoken length:', getCsrfToken() ? getCsrfToken().length : 0);


// === Create reusable Axios instance ===
if (typeof axios === 'undefined') {
    // Helpful debug message when axios isn't loaded before this script
    console.error("axios is not loaded. Please include axios before api.js (for example via CDN or bundle). movieApi will be unavailable.");
    // Provide a minimal stub that throws on use to make failures clearer upstream
    window.movieApi = new Proxy({}, {
        get() {
            return function() {
                throw new Error('axios is not available. Please include axios before api.js');
            };
        }
    });
} else {
    // Create a base axios instance used by helper methods
    const axiosInstance = axios.create({
        baseURL: "http://127.0.0.1:8001/api/",
        withCredentials: true,  // include cookies for session auth
        xsrfCookieName: 'csrftoken',
        xsrfHeaderName: 'X-CSRFToken',
        headers: {
            // Default CSRF header for session-authenticated requests. This will be removed
            // automatically for requests that use Authorization (JWT/Token) below.
            "X-CSRFToken": getCsrfToken(),
            // Do not force Content-Type here; allow per-request override (FormData should let browser set boundary)
        },
    });

    // If an API JWT or token is stored (from login), attach it to requests.
    // Preference: JWT (Bearer) if available; fallback to DRF Token auth.
    try {
        const jwtAccess = localStorage.getItem('apiJwtAccess');
        const apiToken = localStorage.getItem('apiToken');
        if (jwtAccess) {
            axiosInstance.defaults.headers['Authorization'] = `Bearer ${jwtAccess}`;
            console.debug('[movieApi] Using stored JWT access token for Authorization header');
        } else if (apiToken) {
            axiosInstance.defaults.headers['Authorization'] = `Token ${apiToken}`;
            console.debug('[movieApi] Using stored API token for Authorization header');
        }
    } catch (e) {
        console.debug('[movieApi] Error reading tokens from localStorage', e);
    }

    // --- Debugging interceptors: Log outgoing requests and incoming responses ---
    // These are intentionally verbose to help diagnose cross-site cookie / auth issues.
    axiosInstance.interceptors.request.use(function (config) {
        try {
            // Ensure Authorization header is up-to-date in case login changed tokens after page load
            try {
                const jwtAccess = localStorage.getItem('apiJwtAccess');
                const apiToken = localStorage.getItem('apiToken');
                if (jwtAccess) {
                    config.headers['Authorization'] = `Bearer ${jwtAccess}`;
                } else if (apiToken) {
                    config.headers['Authorization'] = `Token ${apiToken}`;
                }
            } catch (e) {
                // ignore localStorage read errors
            }

            // If Authorization is present (JWT/Token) we don't need CSRF headers — remove to avoid confusion
            if (config.headers && config.headers['Authorization']) {
                if (config.headers['X-CSRFToken']) {
                    delete config.headers['X-CSRFToken'];
                }
                // Also ensure axios' xsrf header is not set automatically
                config.xsrfHeaderName = null;
            }

            console.debug('[movieApi] Outgoing request:', config.method?.toUpperCase(), config.url);
            console.debug('[movieApi] Request headers (preview):', JSON.stringify(config.headers).slice(0, 400));
            console.debug('[movieApi] document.cookie:', document.cookie);
        } catch (e) {
            console.debug('[movieApi] Request debug error', e);
        }
        return config;
    }, function (error) {
        console.error('[movieApi] Request creation failed', error);
        return Promise.reject(error);
    });

    axiosInstance.interceptors.response.use(function (response) {
        try {
            console.debug('[movieApi] Response', response.status, response.config.url);
            // Only log small bodies to avoid flooding the console
            if (response.data && typeof response.data === 'object') {
                console.debug('[movieApi] Response data (preview):', JSON.stringify(response.data).slice(0, 200));
            } else {
                console.debug('[movieApi] Response data (preview):', String(response.data).slice(0, 200));
            }
        } catch (e) {
            console.debug('[movieApi] Response debug error', e);
        }
        return response;
    }, function (error) {
        // Provide a clearer debug log when a request fails (401, 403, 500 etc.)
        if (error && error.response) {
            try {
                console.error('[movieApi] Response error:', error.response.status, error.response.config?.url);
                console.error('[movieApi] Response headers:', error.response.headers);
                console.error('[movieApi] Response body:', error.response.data);
            } catch (e) {
                console.error('[movieApi] Error while logging response error', e);
            }
        } else {
            console.error('[movieApi] Network / Axios error', error);
        }
        return Promise.reject(error);
    });

    // Helper wrapper providing the methods the templates expect.
    const movieApi = {
        // Fetch list of movies
        async list() {
            const res = await axiosInstance.get('movies/');
            return res.data;
        },

        // Create a movie. Accepts FormData (for file upload) or plain object
        async create(payload) {
            if (payload instanceof FormData) {
                // Let browser set Content-Type (including multipart boundary)
                const res = await axiosInstance.post('movies/', payload, {
                    headers: { 'X-CSRFToken': getCsrfToken() },
                });
                return res.data;
            } else {
                const res = await axiosInstance.post('movies/', payload);
                return res.data;
            }
        },

        // Update a movie by id. Accepts FormData or plain object
        async update(id, payload) {
            const url = `movies/${id}/`;
            if (payload instanceof FormData) {
                const res = await axiosInstance.put(url, payload, {
                    headers: { 'X-CSRFToken': getCsrfToken() },
                });
                return res.data;
            } else {
                const res = await axiosInstance.put(url, payload);
                return res.data;
            }
        },

        // Delete a movie by id
        async delete(id) {
            const url = `movies/${id}/`;
            const res = await axiosInstance.delete(url);
            return res.data;
        },

        // Expose the underlying axios instance for advanced use/debugging
        _axios: axiosInstance,
    };

    // Export globally
    window.movieApi = movieApi;
    window._movieApiAxios = axiosInstance;
    console.log("✅ api.js initialized successfully (wrapper created)");
}
