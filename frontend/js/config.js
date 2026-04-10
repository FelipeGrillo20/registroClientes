// frontend/js/config.js

// Detectar automáticamente el ambiente
const isProduction =
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

// Base URL de la API
// ⚠️ IMPORTANTE: En producción debe ser la URL completa (no cadena vacía).
// El operador || en agendamiento.js trata '' como falsy y cae al fallback localhost:5000
const API_BASE_URL = isProduction
  ? 'https://stconsultores.cloud'  // Producción: URL completa del servidor Hostinger
  : 'http://localhost:5000';       // Desarrollo local

// Configuración global de la API
window.API_CONFIG = {
  BASE_URL: API_BASE_URL,

  ENDPOINTS: {
    // ⭐ BASE: usada por módulos como agendamiento.js
    // → const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000'
    BASE: API_BASE_URL,

    // Autenticación
    AUTH: {
      LOGIN:                 `${API_BASE_URL}/api/auth/login`,
      REGISTER:              `${API_BASE_URL}/api/auth/register`,
      LOGOUT:                `${API_BASE_URL}/api/auth/logout`,
      VERIFY:                `${API_BASE_URL}/api/auth/verify`,
      CHANGE_PASSWORD:       `${API_BASE_URL}/api/auth/change-password`,
      USERS:                 `${API_BASE_URL}/api/auth/users`,
      ADMIN_CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/admin/change-user-password`
    },

    // Clientes
    CLIENTS:          `${API_BASE_URL}/api/clients`,

    // Consultas
    CONSULTAS:        `${API_BASE_URL}/api/consultas`,

    // Empresas
    EMPRESAS:         `${API_BASE_URL}/api/empresas`,

    // Sistema de Vigilancia Epidemiológica
    MESA_TRABAJO_SVE: `${API_BASE_URL}/api/mesa-trabajo-sve`,
    CONSULTAS_SVE:    `${API_BASE_URL}/api/consultas-sve`,

    // Agendamiento de citas
    CITAS:            `${API_BASE_URL}/api/citas`,

    // Créditos
    CREDITOS:         `${API_BASE_URL}/api/creditos`
  }
};

// Logs
if (!isProduction) {
  console.log('🔧 Modo: DESARROLLO');
  console.log('🔗 API URL:', API_BASE_URL);
} else {
  console.log('🚀 Modo: PRODUCCIÓN');
  console.log('🔗 API URL:', API_BASE_URL);
}