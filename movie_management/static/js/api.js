const API_URL = 'http://127.0.0.1:8001/api';  // Change this to your API URL

// Helper function to get CSRF token from cookies or from META tag
function getCsrfToken() {
  // First try to get token from cookies
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
  
  // Try to get from cookie first
  const tokenFromCookie = getCookie('csrftoken');
  if (tokenFromCookie) {
    console.log('Found CSRF token in cookie');
    return tokenFromCookie;
  }
  
  // If not in cookie, try to get from meta tag
  const tokenElement = document.querySelector('meta[name="csrf-token"]');
  if (tokenElement) {
    console.log('Found CSRF token in meta tag');
    return tokenElement.getAttribute('content');
  }
  
  console.warn('Could not find CSRF token in cookie or meta tag');
  return null;
}

// Helper function for API requests
async function apiRequest(endpoint, method = 'GET', data = null) {
  console.log(`Making ${method} request to ${API_URL}${endpoint}`);
  
  const options = {
    method,
    headers: {},
    credentials: 'include'  // Important for session-based authentication
  };
  
  // Using session authentication instead of token authentication
  console.log('Using Django session authentication for API request');
  
  // Add CSRF token for non-GET requests (especially important for DELETE)
  if (method !== 'GET') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      options.headers['X-CSRFToken'] = csrfToken;
      options.headers['Content-Type'] = 'application/json';
      console.log('Including CSRF token for request:', csrfToken.substring(0, 6) + '...');
      
      // For DELETE requests, ensure the CSRF token is included in a custom header as well
      // This is because some browsers/servers handle empty body DELETE requests differently
      if (method === 'DELETE') {
        console.log('Special handling for DELETE request');
        // Some frameworks require this for processing DELETE requests properly
        options.body = JSON.stringify({csrfmiddlewaretoken: csrfToken});
      }
    } else {
      console.warn('No CSRF token available for non-GET request');
    }
  }
  
  if (data) {
    if (data instanceof FormData) {
      // Don't set Content-Type for FormData - browser will set it with boundary
      options.body = data;
      console.log('Sending FormData with', data.getAll('title')[0], 'and file:', data.get('poster'));
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
      console.log('Sending JSON data:', data);
    }
  }

  try {
    console.log('Fetch options:', { 
      url: `${API_URL}${endpoint}`,
      method: options.method,
      headers: options.headers,
      hasBody: !!options.body
    });
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      if (method === 'DELETE') return null;
      
      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await response.json();
        console.log('Response data:', jsonData);
        return jsonData;
      } else {
        const textData = await response.text();
        console.log('Response text:', textData);
        return textData ? JSON.parse(textData) : {};
      }
    }
    
    // Handle error response
    console.error(`API Error ${response.status}`);
    let errorText = '';
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        console.error('Error details:', errorData);
        errorText = JSON.stringify(errorData);
      } else {
        errorText = await response.text();
        console.error('Error text:', errorText);
      }
    } catch (e) {
      errorText = `HTTP error ${response.status}`;
      console.error('Could not parse error response');
    }
    
    throw new Error(errorText);
  } catch (error) {
    console.error('Fetch error:', error.message);
    throw error;
  }
}

// Authentication API functions - now using Django's session authentication
const authApi = {
  // These functions remain for compatibility but now use session auth
  login: async (username, password) => {
    console.log('Using Django session authentication - direct API login not needed');
    // For compatibility with existing code, return a basic response
    return { success: true };
  },
  
  logout: async () => {
    console.log('Using Django session authentication - please use Django logout');
    // Django logout will handle the session
    window.location.href = '/logout/';
  },
  
  // Always return true since we're using Django's session auth
  isAuthenticated: () => {
    return true; // We assume if they can access the page, they're authenticated with Django
  },
  
  getToken: () => {
    return null; // No token needed with session auth
  },
  
  getUser: () => {
    // Return the Django user info that was passed to the template
    return { 
      id: window.currentUserId, 
      username: window.currentUsername 
    };
  },
  
  // Helper method to check if a movie belongs to the current user
  checkOwnership: (movie) => {
    const currentUserId = parseInt(window.currentUserId);
    const currentUsername = window.currentUsername;
    
    // Check all possible owner field combinations
    const ownershipChecks = [
      { field: 'created_by', value: movie.created_by, match: movie.created_by == currentUserId },
      { field: 'created_by_id', value: movie.created_by_id, match: movie.created_by_id == currentUserId },
      { field: 'user_id', value: movie.user_id, match: movie.user_id == currentUserId },
      { field: 'owner_id', value: movie.owner_id, match: movie.owner_id == currentUserId },
      { field: 'creator_id', value: movie.creator_id, match: movie.creator_id == currentUserId },
      
      // Object relationships
      { field: 'created_by.id', value: movie.created_by?.id, match: movie.created_by?.id == currentUserId },
      { field: 'user.id', value: movie.user?.id, match: movie.user?.id == currentUserId },
      { field: 'owner.id', value: movie.owner?.id, match: movie.owner?.id == currentUserId },
      
      // Username matches
      { field: 'created_by.username', value: movie.created_by?.username, match: movie.created_by?.username === currentUsername },
      { field: 'user.username', value: movie.user?.username, match: movie.user?.username === currentUsername },
      { field: 'owner.username', value: movie.owner?.username, match: movie.owner?.username === currentUsername },
    ];
    
    console.log(`Ownership debug for movie ${movie.id} - ${movie.title}:`, ownershipChecks);
    
    // Return true if any ownership check matches
    return ownershipChecks.some(check => check.match);
  }
};

// Movie API functions (using session-based authentication)
const movieApi = {
  list: () => apiRequest('/movies/'),
  get: (id) => apiRequest(`/movies/${id}/`),
  create: (data) => apiRequest('/movies/', 'POST', data),
  update: (id, data) => apiRequest(`/movies/${id}/`, 'PUT', data),
  delete: (id) => apiRequest(`/movies/${id}/`, 'DELETE')
};

// Export for use in other files
window.movieApi = movieApi;
window.authApi = authApi;