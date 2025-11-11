// frontend/js/informe.js

/**
 * Módulo para la generación de informes clínicos del paciente
 * Funciones principales:
 * - generarInformePaciente(): Genera el contenido HTML del informe
 * - mostrarModalInforme(): Muestra el modal con el informe
 * - cerrarModalInforme(): Cierra el modal del informe
 * - imprimirInforme(): Abre ventana de impresión/PDF
 */

// Formatear fecha para el informe
function formatDateInforme(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Escape HTML para seguridad
function escapeHtmlInforme(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Calcular días en proceso con lógica especial
function calcularDiasEnProceso(fechaInicial, fechaFinal) {
  const fecha1 = new Date(fechaInicial);
  const fecha2 = new Date(fechaFinal);
  
  // Resetear horas para comparar solo fechas
  fecha1.setHours(0, 0, 0, 0);
  fecha2.setHours(0, 0, 0, 0);
  
  // Calcular diferencia en días
  const diferenciaMilisegundos = fecha2 - fecha1;
  const diferenciaDias = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
  
  // Si es el mismo día (diferencia = 0), retornar 1 día
  return diferenciaDias === 0 ? 1 : diferenciaDias;
}

// Generar informe del paciente
window.generarInformePaciente = function() {
  // Obtener datos desde window (compartidos desde consulta.js)
  const clienteActual = window.clienteActual;
  const consultasDelCliente = window.consultasDelCliente;
  
  // Obtener usuario logueado
  const userData = window.getUserData();
  const profesionalNombre = userData ? userData.nombre : 'No especificado';
  const profesionalCedula = userData ? userData.cedula : null;
  
  // Construir ruta de la firma según la cédula del profesional
  const rutaFirma = profesionalCedula ? `img/firmas/firma_${profesionalCedula}.png` : null;

  if (!clienteActual || !consultasDelCliente || consultasDelCliente.length === 0) {
    alert("⚠️ No hay información suficiente para generar el informe");
    return;
  }

  // Ordenar consultas por fecha y por ID para mantener el orden correcto en el informe
  const consultasOrdenadas = [...consultasDelCliente].sort((a, b) => {
    const diffFecha = new Date(a.fecha) - new Date(b.fecha);
    if (diffFecha !== 0) return diffFecha;
    return a.id - b.id;
  });

  const numeroSesiones = consultasDelCliente.length;
  const numeroHoras = numeroSesiones; // 1 hora por sesión
  
  // ============================================
  // CÁLCULO CORREGIDO DE FECHAS Y DÍAS EN PROCESO
  // ============================================
  
  // Fecha inicial: La fecha de la primera sesión (Sesión 1)
  const fechaInicial = new Date(consultasOrdenadas[0].fecha);
  
  // Fecha final: La fecha de la sesión que tiene estado "Cerrado"
  // Si hay múltiples cerradas, tomar la última
  const consultasCerradas = consultasOrdenadas.filter(c => c.estado === 'Cerrado');
  let fechaCierre;
  
  if (consultasCerradas.length > 0) {
    // Usar la fecha de la última consulta cerrada
    fechaCierre = new Date(consultasCerradas[consultasCerradas.length - 1].fecha);
  } else {
    // Fallback: Si no hay consultas cerradas, usar la última consulta
    fechaCierre = new Date(consultasOrdenadas[consultasOrdenadas.length - 1].fecha);
  }
  
  // Calcular días en proceso con lógica especial (mínimo 1 día)
  const diasEnProceso = calcularDiasEnProceso(fechaInicial, fechaCierre);
  
  // Formatear fechas
  const mesesES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const mesCierre = mesesES[fechaCierre.getMonth()];
  const anioCierre = fechaCierre.getFullYear();
  const fechaCierreFormateada = formatDateInforme(fechaCierre.toISOString());

  // Crear contenido del informe
  const informeHTML = `
    <div class="informe-container">
      <!-- Encabezado del Informe -->
      <div class="informe-header">
        <div class="informe-logo">
          <div class="logo-circle">📋</div>
          <h1>Orientación Psicológica</h1>
        </div>
        <div class="informe-fecha-generacion">
          <strong>Fecha de generación:</strong> ${formatDateInforme(new Date().toISOString())}
        </div>
      </div>

      <!-- Información Personal -->
      <div class="informe-section informe-datos-personales">
        <h2 class="informe-section-title">
          <span class="section-icon">👤</span>
          Datos del Trabajador
        </h2>
        <div class="informe-grid">
          <div class="informe-data-item">
            <span class="data-label">Cédula:</span>
            <span class="data-value">${clienteActual.cedula || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Nombre Completo:</span>
            <span class="data-value">${clienteActual.nombre || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Vínculo:</span>
            <span class="data-value">${clienteActual.vinculo || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Sede:</span>
            <span class="data-value">${clienteActual.sede || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Empresa:</span>
            <span class="data-value">${clienteActual.cliente_final || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Email:</span>
            <span class="data-value">${clienteActual.email || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Teléfono:</span>
            <span class="data-value">${clienteActual.telefono || '-'}</span>
          </div>
          <div class="informe-data-item">
            <span class="data-label">Contacto de Emergencia:</span>
            <span class="data-value">${clienteActual.contacto_emergencia_nombre ? 
              `${clienteActual.contacto_emergencia_nombre} (${clienteActual.contacto_emergencia_parentesco}) - ${clienteActual.contacto_emergencia_telefono}` 
              : '-'}</span>
          </div>
        </div>
      </div>

      <!-- Resumen Estadístico -->
      <div class="informe-section informe-estadisticas">
        <h2 class="informe-section-title">
          <span class="section-icon">📊</span>
          Resumen del Proceso
        </h2>
        <div class="estadisticas-grid">
          <div class="estadistica-card">
            <div class="estadistica-icon">📅</div>
            <div class="estadistica-valor">${numeroSesiones}</div>
            <div class="estadistica-label">Sesiones Recibidas</div>
          </div>
          <div class="estadistica-card">
            <div class="estadistica-icon">⏱️</div>
            <div class="estadistica-valor">${numeroHoras}h</div>
            <div class="estadistica-label">Horas de Atención</div>
          </div>
          <div class="estadistica-card">
            <div class="estadistica-icon">📆</div>
            <div class="estadistica-valor">${diasEnProceso}</div>
            <div class="estadistica-label">Días en Proceso</div>
          </div>
          <div class="estadistica-card">
            <div class="estadistica-icon">✅</div>
            <div class="estadistica-valor">${mesCierre}</div>
            <div class="estadistica-label">Mes de Cierre</div>
          </div>
        </div>
        <div class="informe-cierre-info">
          <div class="cierre-item">
            <strong>📅 Fecha de Inicio:</strong> ${formatDateInforme(fechaInicial.toISOString())}
          </div>
          <div class="cierre-item">
            <strong>📅 Fecha de Cierre:</strong> ${fechaCierreFormateada}
          </div>
          <div class="cierre-item">
            <strong>📆 Año de Cierre:</strong> ${anioCierre}
          </div>
        </div>
      </div>

      <!-- Motivo Principal -->
      <div class="informe-section informe-motivo">
        <h2 class="informe-section-title">
          <span class="section-icon">📝</span>
          Motivo de Consulta
        </h2>
        <div class="motivo-principal">
          ${consultasOrdenadas[0].motivo_consulta || 'No especificado'}
        </div>
      </div>

      <!-- Historial de Sesiones -->
      <div class="informe-section informe-sesiones">
        <h2 class="informe-section-title">
          <span class="section-icon">📖</span>
          Historial de Sesiones
        </h2>
        ${consultasOrdenadas.map((consulta, index) => `
          <div class="sesion-detalle">
            <div class="sesion-header">
              <span class="sesion-numero">Sesión ${index + 1}</span>
              <span class="sesion-fecha">📅 ${formatDateInforme(consulta.fecha)}</span>
              <span class="sesion-modalidad badge-modalidad-informe">${consulta.modalidad}</span>
            </div>
            ${consulta.columna1 ? `
              <div class="sesion-observaciones">
                <strong>Observaciones:</strong>
                <p>${escapeHtmlInforme(consulta.columna1)}</p>
              </div>
            ` : `
              <div class="sesion-sin-observaciones">
                Sin observaciones registradas
              </div>
            `}
          </div>
        `).join('')}
      </div>

      <!-- Firma -->
      <div class="informe-footer">
        <div class="firma-seccion">
          ${rutaFirma ? `
            <div class="firma-imagen-container">
              <img src="${rutaFirma}" 
                   alt="Firma del Profesional" 
                   class="firma-imagen" 
                   onerror="this.style.display='none'">
            </div>
          ` : ''}
          <div class="firma-linea"></div>
          <p class="firma-texto">Firma del Profesional</p>
          <p class="firma-nombre">${profesionalNombre}</p>
          ${profesionalCedula ? `<p class="firma-cedula">C.C. ${profesionalCedula}</p>` : ''}
        </div>
        <div class="informe-nota">
          <strong>Nota:</strong> Este documento es confidencial y de uso exclusivo para fines médicos y terapéuticos.
        </div>
      </div>
    </div>
  `;

  // Abrir modal con el informe
  mostrarModalInforme(informeHTML);
};

// Mostrar modal con el informe
function mostrarModalInforme(contenidoHTML) {
  // Crear modal si no existe
  let modal = document.getElementById('modalInformePaciente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalInformePaciente';
    modal.className = 'modal-overlay-informe';
    modal.innerHTML = `
      <div class="modal-content-informe">
        <div class="modal-header-informe">
          <h2>📄 Historial Psicológico del Trabajador</h2>
          <button type="button" class="btn-close-modal-informe" onclick="cerrarModalInforme()">&times;</button>
        </div>
        <div class="modal-body-informe" id="contenidoInforme">
          <!-- Contenido del informe se inserta aquí -->
        </div>
        <div class="modal-footer-informe">
          <button type="button" class="btn-imprimir-informe" onclick="imprimirInforme()">
            🖨️ Imprimir / Guardar PDF
          </button>
          <button type="button" class="btn-cerrar-informe" onclick="cerrarModalInforme()">
            Cerrar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Insertar contenido y mostrar modal
  document.getElementById('contenidoInforme').innerHTML = contenidoHTML;
  modal.classList.add('show');
}

// Cerrar modal de informe
window.cerrarModalInforme = function() {
  const modal = document.getElementById('modalInformePaciente');
  if (modal) {
    modal.classList.remove('show');
  }
};

// Imprimir informe
window.imprimirInforme = function() {
  const clienteActual = window.clienteActual;
  const contenido = document.getElementById('contenidoInforme').innerHTML;
  
  const ventanaImpresion = window.open('', '_blank');
  ventanaImpresion.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Seguimiento Psicológico - ${clienteActual.nombre}</title>
      <link rel="stylesheet" href="css/informe.css">
      <style>
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          padding: 30px; 
          background: white;
          color: #2c3e50;
        }
      </style>
    </head>
    <body>
      ${contenido}
    </body>
    </html>
  `);
  
  ventanaImpresion.document.close();
  ventanaImpresion.focus();
  
  setTimeout(() => {
    ventanaImpresion.print();
  }, 500);
};