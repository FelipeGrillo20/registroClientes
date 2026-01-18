// frontend/js/informeSVE.js - Sistema de Generación de Informes SVE

const MESA_TRABAJO_API = window.API_CONFIG.ENDPOINTS.MESA_TRABAJO_SVE;
const CONSULTAS_SVE_API = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Formatear fecha para el informe
function formatDateInformeSVE(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Escape HTML para seguridad
function escapeHtmlSVE(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// GENERAR INFORME SVE COMPLETO
// ============================================
window.generarInformeSVE = async function(clienteId) {
  // ✅ Si no se pasa clienteId, intentar obtenerlo del contexto
  if (!clienteId) {
    // Intentar desde la URL (cuando se llama desde consulta.html)
    if (typeof getClienteIdFromURL === 'function') {
      clienteId = getClienteIdFromURL();
    }
    // Intentar desde el contexto (cuando se llama desde clientes.html)
    else if (typeof getClienteIdFromContext === 'function') {
      clienteId = getClienteIdFromContext();
    }
    // Intentar desde window.clienteActual
    else if (window.clienteActual && window.clienteActual.id) {
      clienteId = window.clienteActual.id;
    }
  }
  
  // Validar que tenemos un clienteId
  if (!clienteId) {
    alert('⚠️ No se pudo identificar el cliente');
    console.error('❌ clienteId no disponible');
    return;
  }
  
  console.log('📄 Generando informe para cliente ID:', clienteId);

  // ✅ Validar que tenemos datos del cliente
  if (!window.clienteActual) {
    alert('⚠️ No hay datos del cliente cargados');
    console.error('❌ window.clienteActual no está definido');
    return;
  }

  try {
    // Mostrar indicador de carga
    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 15px;">📄</div>
          <div style="font-size: 18px; font-weight: 600; color: #2c3e50;">Generando Informe SVE...</div>
          <div style="margin-top: 10px; color: #7f8c8d;">Por favor espere</div>
        </div>
      </div>
    `;
    document.body.appendChild(loadingDiv);

    // Cargar Consultas SVE desde el endpoint correcto
    const resConsultas = await fetch(`${CONSULTAS_SVE_API}/cliente/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resConsultas.ok) {
      throw new Error("No se encontraron consultas SVE para este cliente");
    }

    const consultasSVE = await resConsultas.json();

    if (consultasSVE.length === 0) {
      throw new Error("No hay consultas registradas para generar el informe");
    }

    // ✅ Ordenar consultas cronológicamente (más antigua primero)
    const consultasOrdenadas = consultasSVE.sort((a, b) => {
      const diffFecha = new Date(a.fecha) - new Date(b.fecha);
      if (diffFecha !== 0) return diffFecha;
      return a.id - b.id; // Si tienen la misma fecha, ordenar por ID
    });
    
    console.log('📋 Consultas ordenadas cronológicamente:', consultasOrdenadas);

    // Obtener datos del usuario logueado
    const usuarioLogueado = JSON.parse(localStorage.getItem('userData'));

    // Generar el HTML del informe
    const informeHTML = generarHTMLInformeSVE(
      window.clienteActual, 
      consultasOrdenadas,
      usuarioLogueado
    );

    // Abrir en nueva ventana para imprimir
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(informeHTML);
    ventanaImpresion.document.close();

    // Remover indicador de carga
    document.body.removeChild(loadingDiv);

    // Esperar un momento y luego mostrar diálogo de impresión
    setTimeout(() => {
      ventanaImpresion.print();
    }, 500);

  } catch (err) {
    console.error('❌ Error generando informe SVE:', err);
    alert('❌ Error al generar informe SVE: ' + err.message);
    
    // Remover indicador de carga si existe
    const loadingDiv = document.querySelector('div[style*="position: fixed"]');
    if (loadingDiv && loadingDiv.parentElement) {
      document.body.removeChild(loadingDiv.parentElement || loadingDiv);
    }
  }
};

// ============================================
// GENERAR HTML DEL INFORME SVE
// ✅ ACTUALIZADO: Diseño moderno similar a informe.js
// ============================================
function generarHTMLInformeSVE(cliente, todasConsultas, usuario) {
  
  // ✅ La primera consulta (cronológicamente) para obtener datos generales
  const primeraConsulta = todasConsultas[0];
  
  // Deducir sexo del nombre (simplificado)
  const primerNombre = cliente.nombre.split(' ')[0].toLowerCase();
  const nombresFemeninos = ['maria', 'ana', 'carmen', 'laura', 'andrea', 'paula', 'diana', 'claudia', 'luz', 'rosa', 'martha', 'sandra'];
  const esFemenino = nombresFemeninos.some(n => primerNombre.includes(n));
  const sexo = esFemenino ? 'Femenino' : 'Masculino';

  // Formatear fechas
  const mesesES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Nombre de la empresa (Cliente Final)
  const nombreEmpresa = cliente.cliente_final || cliente.subcontratista_definitivo || cliente.subcontratista_nombre || 'No especificado';

  // Obtener usuario logueado
  const profesionalNombre = usuario ? usuario.nombre : 'No especificado';
  const profesionalCedula = usuario ? usuario.cedula : null;
  
  // Construir ruta de la firma según la cédula del profesional
  const rutaFirma = profesionalCedula ? `img/firmas/firma_${profesionalCedula}.png` : null;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe SVE - ${escapeHtmlSVE(cliente.nombre)}</title>
  <link rel="stylesheet" href="css/informeSVE.css">
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
  <div class="informe-container-sve">
    
    <!-- Encabezado del Informe -->
    <div class="informe-header-sve">
      <div class="informe-logo-sve">
        <div class="logo-circle-sve">🏥</div>
        <h1>Sistema de Vigilancia Epidemiológica</h1>
      </div>
      <div class="informe-fecha-generacion-sve">
        <strong>Fecha de generación:</strong> ${formatDateInformeSVE(new Date().toISOString())}
      </div>
    </div>

    <!-- Información de la Empresa -->
    <div class="seccion-empresa-sve">
      <div class="empresa-nombre-sve">
        <strong>Empresa:</strong> ${escapeHtmlSVE(nombreEmpresa)}
      </div>
    </div>

    <!-- Información del Trabajador -->
    <div class="informe-section-sve informe-datos-personales-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">👤</span>
        Datos del Trabajador
      </h2>
      <div class="informe-grid-sve">
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Nombre y Apellidos:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.nombre)}</span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">No. Identificación:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.cedula)}</span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Sexo:</span>
          <span class="data-value-sve">
            Femenino 
            <span class="checkbox-sexo-sve ${sexo === 'Femenino' ? 'checked' : ''}"></span>
            Masculino 
            <span class="checkbox-sexo-sve ${sexo === 'Masculino' ? 'checked' : ''}"></span>
          </span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Vínculo:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.vinculo || '-')}</span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Sede:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.sede || '-')}</span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Email:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.email || '-')}</span>
        </div>
        <div class="informe-data-item-sve">
          <span class="data-label-sve">Teléfono:</span>
          <span class="data-value-sve">${escapeHtmlSVE(cliente.telefono || '-')}</span>
        </div>
        <div class="informe-data-item-sve full-width">
          <span class="data-label-sve">Contacto de Emergencia:</span>
          <span class="data-value-sve">${cliente.contacto_emergencia_nombre ? 
            `${escapeHtmlSVE(cliente.contacto_emergencia_nombre)} (${escapeHtmlSVE(cliente.contacto_emergencia_parentesco)}) - ${escapeHtmlSVE(cliente.contacto_emergencia_telefono)}` 
            : '-'}</span>
        </div>
      </div>
    </div>

    <!-- Motivo de Evaluación (Primera Sesión) -->
    <div class="informe-section-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">📝</span>
        Motivo de Evaluación y Situación Actual
      </h2>
      <div class="texto-completo-sve">
        <div class="texto-contenido-sve">${escapeHtmlSVE(primeraConsulta.motivo_evaluacion)}</div>
      </div>
    </div>

    <!-- Metodología y Técnica -->
    <div class="informe-section-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">🔬</span>
        Metodología y Técnica de Recolección de Información
      </h2>
      <div class="metodologia-box-sve">
        Observación y entrevista semiestructurada. Lo anterior con el objetivo de preservar el estado de salud y funcionalidad, de conformidad con los artículos 2, 4 y 8 de la Ley 776 de 2002. Además de estar soportado como acción preventiva de riesgos; con la Resolución 2646 de 2008 del Ministerio de la Protección Social y Resolución 2764 de 2022 del Ministerio del Trabajo bajo los artículos 6 y 8. Lo anterior soportado de la metodología las guías técnicas y protocolos para la promoción, prevención e intervención de los factores psicosociales, aplicando protocolo de prevención y actuación de depresión.
      </div>
    </div>

    <!-- Historial de Sesiones -->
    <div class="informe-section-sve informe-sesiones-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">📊</span>
        Historial de Sesiones y Recomendaciones
      </h2>
      
      ${todasConsultas.map((consulta, index) => {
        const fechaSesion = new Date(consulta.fecha);
        const fechaFormateada = formatDateInformeSVE(consulta.fecha);
        
        return `
          <div class="sesion-card-sve">
            <div class="sesion-header-sve">
              <span class="sesion-numero-sve">Sesión ${index + 1}</span>
              <span class="sesion-fecha-sve">📅 ${fechaFormateada}</span>
              <span class="sesion-modalidad-sve">${escapeHtmlSVE(consulta.modalidad)}</span>
            </div>

            <div class="sesion-contenido-sve">
              ${consulta.motivo_evaluacion ? `
                <div class="sesion-bloque-sve">
                  <div class="texto-completo-sve">
                    <span class="texto-label-sve">📝 Motivo de Evaluación:</span>
                    <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.motivo_evaluacion)}</div>
                  </div>
                </div>
              ` : ''}

              ${consulta.observaciones ? `
                <div class="sesion-bloque-sve">
                  <div class="texto-completo-sve">
                    <span class="texto-label-sve">📄 Observaciones:</span>
                    <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.observaciones)}</div>
                  </div>
                </div>
              ` : ''}

              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">⚙️ Ajustes a las Funciones:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.ajuste_funciones)}</div>
                </div>
              </div>

              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">💊 Recomendaciones Médicas:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_medicas)}</div>
                </div>
              </div>

              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">🏢 Recomendaciones para la Empresa:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_empresa)}</div>
                </div>
              </div>

              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">👤 Recomendaciones para el Trabajador:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_trabajador)}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Resumen de Consultas (si hay más de una sesión) -->
    ${todasConsultas.length > 1 ? `
      <div class="informe-section-sve">
        <h2 class="informe-section-title-sve">
          <span class="section-icon-sve">📋</span>
          Resumen de Consultas
        </h2>
        <table class="tabla-consultas-sve">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Modalidad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${todasConsultas.map((consulta, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${formatDateInformeSVE(consulta.fecha)}</td>
                <td>${escapeHtmlSVE(consulta.modalidad)}</td>
                <td>${escapeHtmlSVE(consulta.estado || 'Activo')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- Firma -->
    <div class="informe-footer-sve">
      <div class="firma-seccion-sve">
        ${rutaFirma ? `
          <div class="firma-imagen-container-sve">
            <img src="${rutaFirma}" 
                 alt="Firma del Profesional" 
                 class="firma-imagen-sve" 
                 onerror="this.style.display='none'">
          </div>
        ` : ''}
        <div class="firma-linea-sve"></div>
        <p class="firma-texto-sve">Firma del Profesional</p>
        <p class="firma-nombre-sve">${escapeHtmlSVE(profesionalNombre)}</p>
        ${profesionalCedula ? `<p class="firma-datos-sve">C.C. ${profesionalCedula}</p>` : ''}
        <p class="firma-datos-sve">
          Tarjeta Profesional: 142861<br>
          Licencia SST: 19950
        </p>
      </div>
      <div class="informe-nota-sve">
        <strong>Nota:</strong> Este documento es confidencial y de uso exclusivo para fines médicos, terapéuticos y de vigilancia epidemiológica ocupacional.
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

// ============================================
// MOSTRAR BOTÓN DE INFORME SVE
// ============================================
window.mostrarBotonInformeSVE = function() {
  const historialSVE = document.getElementById('historialSVE');
  
  // Verificar si ya existe el botón
  if (document.getElementById('btnGenerarInformeSVE')) {
    return;
  }
  
  // Crear contenedor para el botón
  const contenedorBoton = document.createElement('div');
  contenedorBoton.id = 'contenedorBotonInformeSVE';
  contenedorBoton.style.cssText = `
    margin-top: 30px;
    padding: 25px;
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    border-radius: 14px;
    border: 2px solid #56ab2f;
    text-align: center;
  `;
  
  contenedorBoton.innerHTML = `
    <button id="btnGenerarInformeSVE" class="btn-informe-sve" onclick="generarInformeSVE()">
      📄 Generar Informe SVE Completo
    </button>
    <p style="margin-top: 15px; font-size: 13px; color: #56ab2f; font-weight: 600;">
      💡 Este informe incluye: Información del Trabajador, TODAS las Sesiones y Recomendaciones
    </p>
  `;
  
  // Insertar después del historial
  historialSVE.appendChild(contenedorBoton);
};

console.log('✅ informeSVE.js cargado correctamente');