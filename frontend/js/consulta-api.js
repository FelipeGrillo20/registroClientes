// frontend/js/consulta-api.js
// MÓDULO 1: Autenticación y utilidades de API
// Expone funciones base usadas por todos los demás módulos de consulta

// ============================================
// URLs DE LA API
// ============================================
const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;
const CONSULTAS_API_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS;

// ============================================
// VARIABLES GLOBALES COMPARTIDAS
// ============================================
let clienteActual = null;
let editandoConsultaId = null;
let consultasDelCliente = [];

// Exponer globalmente para otros módulos (informe.js, etc.)
window.clienteActual = null;
window.consultasDelCliente = [];

// ============================================
// AUTENTICACIÓN
// ============================================

// Obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Obtener headers con autenticación
function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getAuthToken()}`
  };
}

// ============================================
// UTILIDADES DE URL
// ============================================

// Obtener ID del cliente desde la URL
function getClienteIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("cliente");
}

// ============================================
// FUNCIONES UTILITARIAS GENERALES
// ============================================

// Formatear fecha de YYYY-MM-DD a DD/MM/YYYY (sin bug de zona horaria UTC)
function formatDate(dateString) {
  const partes = dateString.substring(0, 10).split('-');
  const year = partes[0];
  const month = partes[1];
  const day = partes[2];
  return `${day}/${month}/${year}`;
}

// Obtener fecha local de hoy en formato YYYY-MM-DD (evita bug de zona horaria UTC)
function getFechaLocalHoy() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Escapar HTML para prevenir XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Capitalizar primera letra
function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

console.log('✅ Módulo consulta-api.js cargado');