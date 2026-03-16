// frontend/js/consulta.js
// ORQUESTADOR PRINCIPAL - Inicialización y coordinación de módulos
//
// ORDEN DE CARGA EN consulta.html (antes de este archivo):
//   1. consulta-api.js       → Variables globales, auth, utilidades
//   2. consulta-cliente.js   → Tarjeta del cliente, contacto emergencia
//   3. consulta-historial.js → Historial de consultas (Orientación Psicosocial)
//   4. consulta-form.js      → Formulario principal de consultas
//   5. consulta-sve.js       → Sistema de Vigilancia Epidemiológica
//   6. consulta-documentos.js → Documentos adjuntos
//   7. consulta.js           → Este orquestador

document.addEventListener('DOMContentLoaded', () => {

  // -----------------------------------------------
  // 1. Cargar datos del cliente
  // -----------------------------------------------
  loadClientData();

  // -----------------------------------------------
  // 2. Establecer fecha de hoy en el formulario
  // -----------------------------------------------
  const fechaInput = document.getElementById("fecha");
  if (fechaInput) {
    fechaInput.value = getFechaLocalHoy();
  }

  // -----------------------------------------------
  // 3. Inicializar módulo SVE (si corresponde)
  // -----------------------------------------------
  inicializarSVE();

  // -----------------------------------------------
  // 4. Actualizar botón Dashboard según modalidad
  // -----------------------------------------------
  actualizarBotonDashboardConsulta();

  // -----------------------------------------------
  // 5. Controlar visibilidad de secciones por modalidad
  // -----------------------------------------------
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  const historialSection = document.querySelector('.historial-section');

  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    // Eliminar del DOM la sección de historial de orientación psicosocial
    if (historialSection) {
      historialSection.remove();
    }
  }

});

console.log('✅ Orquestador consulta.js cargado');