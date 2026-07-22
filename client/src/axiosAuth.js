import axios from 'axios';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    const headers = config.headers || {};
    config.headers = { ...headers, Authorization: `Bearer ${token}` };
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    if (status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userRole');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        sessionStorage.setItem('sessionExpired', '1');
        window.location.assign('/login?session=expired');
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
