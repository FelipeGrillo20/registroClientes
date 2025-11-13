// frontend/js/config.js

// Detectar automáticamente el ambiente
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

const API_BASE_URL = isProduction 
  ? 'https://registroclientes-wzh1.onrender.com'  // Producción (Render)
  : 'http://localhost:5000';  // Desarrollo local

// Configuración global de la API
window.API_CONFIG = {
  BASE_URL: API_BASE_URL,
  
  // Endpoints principales
  ENDPOINTS: {
    // Autenticación
    AUTH: {
      LOGIN: `${API_BASE_URL}/api/auth/login`,
      REGISTER: `${API_BASE_URL}/api/auth/register`,
      LOGOUT: `${API_BASE_URL}/api/auth/logout`,
      VERIFY: `${API_BASE_URL}/api/auth/verify`,
      CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/change-password`,
      USERS: `${API_BASE_URL}/api/auth/users`,
      ADMIN_CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/admin/change-user-password`
    },
    
    // Clientes
    CLIENTS: `${API_BASE_URL}/api/clients`,
    
    // Consultas
    CONSULTAS: `${API_BASE_URL}/api/consultas`,
    
    // Empresas
    EMPRESAS: `${API_BASE_URL}/api/empresas`
  }
};

// Log para debug (solo en desarrollo)
if (!isProduction) {
  console.log('🔧 Modo: DESARROLLO');
  console.log('🔗 API URL:', API_BASE_URL);
} else {
  console.log('🚀 Modo: PRODUCCIÓN');
  console.log('🔗 API URL:', API_BASE_URL);
}