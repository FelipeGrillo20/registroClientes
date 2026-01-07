// frontend/js/config.js

// Detectar automáticamente el ambiente
const isProduction =
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

// Base URL de la API
const API_BASE_URL = isProduction
  ? ''                // Producción: mismo dominio
  : 'http://localhost:5000'; // Desarrollo local

// Configuración global de la API
window.API_CONFIG = {
  BASE_URL: API_BASE_URL,

  ENDPOINTS: {
    // Autenticación
    AUTH: {
      LOGIN: `/api/auth/login`,
      REGISTER: `/api/auth/register`,
      LOGOUT: `/api/auth/logout`,
      VERIFY: `/api/auth/verify`,
      CHANGE_PASSWORD: `/api/auth/change-password`,
      USERS: `/api/auth/users`,
      ADMIN_CHANGE_PASSWORD: `/api/auth/admin/change-user-password`
    },

    // Clientes
    CLIENTS: `/api/clients`,

    // Consultas
    CONSULTAS: `/api/consultas`,

    // Empresas
    EMPRESAS: `/api/empresas`,

    // Sistema de Vigilancia Epidemiológica
    MESA_TRABAJO_SVE: `/api/mesa-trabajo-sve`,
    CONSULTAS_SVE: `/api/consultas-sve`
  }
};

// Logs
if (!isProduction) {
  console.log('🔧 Modo: DESARROLLO');
  console.log('🔗 API URL:', API_BASE_URL);
} else {
  console.log('🚀 Modo: PRODUCCIÓN');
  console.log('🔗 API URL: mismo dominio (/api)');
}

