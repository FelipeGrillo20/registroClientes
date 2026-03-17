// frontend/js/informe.js

/**
 * Módulo para la generación de informes clínicos del paciente.
 * Cada consulta (consulta_number) tiene su propio informe independiente.
 * Lee fecha_cierre y recomendaciones_finales desde la tabla consultas,
 * no desde el cliente.
 */

function formatDateInforme(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeHtmlInforme(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function calcularEdadInforme(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function calcularTiempoLaboradoInforme(fechaIngreso) {
  if (!fechaIngreso) return null;
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);
  let anios = hoy.getFullYear() - ingreso.getFullYear();
  let meses  = hoy.getMonth()    - ingreso.getMonth();
  let dias   = hoy.getDate()     - ingreso.getDate();
  if (dias < 0) { meses--; dias += new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate(); }
  if (meses < 0) { anios--; meses += 12; }
  const partes = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);
  if (dias  > 0) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`);
  if (partes.length === 0) return 'Recién ingresado';
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}

function calcularDiasEnProceso(fechaInicial, fechaFinal) {
  const fecha1 = new Date(fechaInicial);
  const fecha2 = new Date(fechaFinal);
  fecha1.setHours(0, 0, 0, 0);
  fecha2.setHours(0, 0, 0, 0);
  const diferenciaDias = Math.floor((fecha2 - fecha1) / (1000 * 60 * 60 * 24));
  return diferenciaDias === 0 ? 1 : diferenciaDias;
}

window.generarInformePaciente = function() {
  const clienteActual = window.clienteActual;
  const consultasDelCliente = window.consultasDelCliente;

  // Obtener el consulta_number activo:
  // 1. Desde getConsultaNumberActual (cuando se llama desde consulta.html)
  // 2. Desde _informeConsultaNumber (cuando se llama desde clientes.html via onInforme)
  const consultaNumberActual = (window.getConsultaNumberActual && window.getConsultaNumberActual() !== null)
    ? window.getConsultaNumberActual()
    : (window._informeConsultaNumber ?? null);

  console.log("📊 Generando informe para consulta_number:", consultaNumberActual);

  const userData = window.getUserData();
  const profesionalNombre = userData ? userData.nombre : 'No especificado';
  const profesionalCedula = userData ? userData.cedula : null;
  const rutaFirma = profesionalCedula ? `img/firmas/firma_${profesionalCedula}.png` : null;

  if (!clienteActual || !consultasDelCliente || consultasDelCliente.length === 0) {
    alert("⚠️ No hay información suficiente para generar el informe");
    return;
  }

  if (consultaNumberActual === null) {
    alert("⚠️ No se pudo determinar la consulta activa. Por favor recarga la página.");
    return;
  }

  // Filtrar SOLO las sesiones de la consulta activa
  const sesionesConsulta = consultasDelCliente
    .filter(c => c.consulta_number === consultaNumberActual)
    .sort((a, b) => {
      const diffFecha = new Date(a.fecha) - new Date(b.fecha);
      return diffFecha !== 0 ? diffFecha : a.id - b.id;
    });

  if (sesionesConsulta.length === 0) {
    alert("⚠️ No hay sesiones registradas para esta consulta.");
    return;
  }

  // Leer fecha_cierre y recomendaciones desde las sesiones (no desde clienteActual)
  const sesionConCierre = sesionesConsulta.find(s => s.fecha_cierre);
  const fechaCierreConsulta = sesionConCierre ? sesionConCierre.fecha_cierre : null;
  const recomendacionesConsulta = sesionConCierre ? sesionConCierre.recomendaciones_finales : null;

  // Validar que el caso esté cerrado
  if (!fechaCierreConsulta) {
    alert(
      "⚠️ El caso debe estar cerrado para generar el informe.\n\n" +
      "Por favor cierra la Consulta " + consultaNumberActual +
      " desde el formulario seleccionando estado 'Cerrado'."
    );
    return;
  }

  console.log("✅ Generando informe para Consulta", consultaNumberActual);

  const numeroSesiones = sesionesConsulta.length;
  const numeroHoras = numeroSesiones;

  const fechaInicial = new Date(sesionesConsulta[0].fecha);
  const fechaCierre = new Date(fechaCierreConsulta);

  const diasEnProceso = calcularDiasEnProceso(fechaInicial, fechaCierre);

  const mesesES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const mesCierre = mesesES[fechaCierre.getMonth()];
  const anioCierre = fechaCierre.getFullYear();
  const fechaCierreFormateada = formatDateInforme(fechaCierre.toISOString());

  const informeHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Seguimiento Psicológico - ${clienteActual.nombre} - Consulta ${consultaNumberActual}</title>
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
      <div class="informe-container">

        <div class="informe-header">
          <div class="informe-logo">
            <div class="logo-circle">📋</div>
            <h1>Orientación Psicológica</h1>
          </div>
          <div class="informe-fecha-generacion">
            <strong>Consulta N°:</strong> ${consultaNumberActual}<br>
            <strong>Fecha de generación:</strong> ${formatDateInforme(new Date().toISOString())}
          </div>
        </div>

        <div class="informe-section informe-datos-personales">
          <h2 class="informe-section-title">
            <span class="section-icon">👤</span>
            Datos del Trabajador
          </h2>
          <div class="informe-grid">

            <!-- Fila 1: Cédula | Nombre Completo | Género -->
            <div class="informe-data-item">
              <span class="data-label">Cédula:</span>
              <span class="data-value">${clienteActual.cedula || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Nombre Completo:</span>
              <span class="data-value">${clienteActual.nombre || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Género:</span>
              <span class="data-value">${clienteActual.sexo || '-'}</span>
            </div>

            <!-- Fila 2: Edad | Dirección | Teléfono -->
            <div class="informe-data-item">
              <span class="data-label">Edad:</span>
              <span class="data-value">${calcularEdadInforme(clienteActual.fecha_nacimiento) !== null ? calcularEdadInforme(clienteActual.fecha_nacimiento) + ' años' : '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Dirección:</span>
              <span class="data-value">${clienteActual.direccion || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Teléfono:</span>
              <span class="data-value">${clienteActual.telefono || '-'}</span>
            </div>

            <!-- Fila 3: Correo Electrónico | Estado Civil | Sede -->
            <div class="informe-data-item">
              <span class="data-label">Correo Electrónico:</span>
              <span class="data-value">${clienteActual.email || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Estado Civil:</span>
              <span class="data-value">${clienteActual.estado_civil || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Sede:</span>
              <span class="data-value">${clienteActual.sede || '-'}</span>
            </div>

            <!-- Fila 4: Vínculo | Cargo | Empresa Usuario / Cliente Final -->
            <div class="informe-data-item">
              <span class="data-label">Vínculo:</span>
              <span class="data-value">${clienteActual.vinculo || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Cargo:</span>
              <span class="data-value">${clienteActual.cargo || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Empresa Usuario </span>
              <span class="data-value">${clienteActual.cliente_final || '-'}</span>
            </div>

            <!-- Fila 5: Entidad Pagadora | Tiempo Laborado | Contacto de Emergencia -->
            <div class="informe-data-item">
              <span class="data-label">Entidad Pagadora:</span>
              <span class="data-value">${clienteActual.tipo_entidad_pagadora ? (clienteActual.entidad_pagadora_especifica ? clienteActual.tipo_entidad_pagadora + ' — ' + clienteActual.entidad_pagadora_especifica : clienteActual.tipo_entidad_pagadora) : '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Tiempo Laborado:</span>
              <span class="data-value">${calcularTiempoLaboradoInforme(clienteActual.fecha_ingreso) || '-'}</span>
            </div>
            <div class="informe-data-item">
              <span class="data-label">Contacto de Emergencia:</span>
              <span class="data-value">${clienteActual.contacto_emergencia_nombre
                ? `${clienteActual.contacto_emergencia_nombre} (${clienteActual.contacto_emergencia_parentesco}) — ${clienteActual.contacto_emergencia_telefono}`
                : '-'}</span>
            </div>

          </div>
        </div>

        <div class="informe-section informe-estadisticas">
          <h2 class="informe-section-title">
            <span class="section-icon">📊</span>
            Resumen del Proceso — Consulta ${consultaNumberActual}
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

        <div class="informe-section informe-motivo">
          <h2 class="informe-section-title">
            <span class="section-icon">📋</span>
            Motivo de Consulta
          </h2>
          <div class="motivo-principal">
            ${sesionesConsulta[0].motivo_consulta || 'No especificado'}
          </div>
        </div>

        <div class="informe-section informe-sesiones">
          <h2 class="informe-section-title">
            <span class="section-icon">📖</span>
            Historial de Sesiones
          </h2>
          ${sesionesConsulta.map((consulta, index) => `
            <div class="sesion-detalle">
              <div class="sesion-header">
                <span class="sesion-numero">Sesión ${index + 1}</span>
                <span class="sesion-fecha">📅 ${formatDateInforme(consulta.fecha)}</span>
                <span class="sesion-modalidad badge-modalidad-informe">${consulta.modalidad}</span>
              </div>
              ${consulta.columna1 && !consulta.observaciones_confidenciales ? `
                <div class="sesion-observaciones">
                  <strong>Observaciones:</strong>
                  <p>${escapeHtmlInforme(consulta.columna1)}</p>
                </div>
              ` : consulta.observaciones_confidenciales ? `
                <div class="sesion-observaciones-confidencial">
                  <p>🔒 Información confidencial reservada por el profesional</p>
                </div>
              ` : `
                <div class="sesion-sin-observaciones">
                  Sin observaciones registradas
                </div>
              `}
            </div>
          `).join('')}
        </div>

        <div class="informe-bloque-final">
          ${recomendacionesConsulta ? `
          <div class="informe-section informe-recomendaciones">
            <h2 class="informe-section-title">
              <span class="section-icon">📝</span>
              Recomendaciones Finales
            </h2>
            <div class="recomendaciones-contenido">
              <p>${escapeHtmlInforme(recomendacionesConsulta).replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          ` : ''}

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

      </div>
    </body>
    </html>
  `;

  const ventanaImpresion = window.open('', '_blank');
  ventanaImpresion.document.write(informeHTML);
  ventanaImpresion.document.close();
  ventanaImpresion.focus();

  setTimeout(() => {
    ventanaImpresion.print();
  }, 500);
};