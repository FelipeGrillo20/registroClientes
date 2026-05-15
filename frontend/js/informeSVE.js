// frontend/js/informeSVE.js - Sistema de Generación de Informes SVE

const MESA_TRABAJO_API = window.API_CONFIG.ENDPOINTS.MESA_TRABAJO_SVE;
const CONSULTAS_SVE_API = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Formatear fecha para el informe
function formatDateInformeSVE(dateString) {
  // Parseo manual para evitar desfase UTC vs Colombia (UTC-5):
  // new Date('2026-05-14') interpreta como UTC medianoche y al
  // convertir a hora local en Hostinger (UTC) baja un día.
  // Tomamos los componentes directamente del string sin conversión.
  if (!dateString) return '';
  const str = String(dateString).substring(0, 10); // 'YYYY-MM-DD'
  const [year, month, day] = str.split('-');
  if (!year || !month || !day) {
    // Fallback: si el formato no es ISO fecha pura, usar Date local
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }
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

    // Cargar Mesa de Trabajo del cliente
    let mesaTrabajo = null;
    try {
      const resMesa = await fetch(`${MESA_TRABAJO_API}/cliente/${clienteId}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      });
      if (resMesa.ok) {
        mesaTrabajo = await resMesa.json();
      }
    } catch (e) {
      console.warn('⚠️ No se pudo cargar la Mesa de Trabajo:', e.message);
    }

    // ✅ Ordenar consultas cronológicamente (más antigua primero)
    const consultasOrdenadas = consultasSVE.sort((a, b) => {
      const diffFecha = new Date(a.fecha) - new Date(b.fecha);
      if (diffFecha !== 0) return diffFecha;
      return a.id - b.id;
    });
    
    console.log('📋 Consultas ordenadas cronológicamente:', consultasOrdenadas);

    // ─────────────────────────────────────────────────────────────────
    // FIRMA: leer directamente desde las consultas SVE del trabajador.
    // El endpoint SVE incluye profesional_cedula y profesional_nombre
    // via JOIN con clients y users, por lo que el dato llega aquí sin
    // importar quién esté logueado.
    // Fallback al usuario logueado solo si los campos no vienen en BD.
    // ─────────────────────────────────────────────────────────────────
    const usuarioLogueado = JSON.parse(localStorage.getItem('userData'));
    const sesionRefSVE      = consultasOrdenadas[0];
    const nivelComplejidad  = sesionRefSVE?.nivel_complejidad || null;
    const estadoCaso        = window.clienteActual?.fecha_cierre_sve ? 'Cerrado' : 'Abierto';

    const profesionalDatos = {
      nombre : sesionRefSVE?.profesional_nombre || (usuarioLogueado ? usuarioLogueado.nombre : null),
      cedula : sesionRefSVE?.profesional_cedula || (usuarioLogueado ? usuarioLogueado.cedula : null)
    };

    // Generar el HTML del informe
    const informeHTML = generarHTMLInformeSVE(
      window.clienteActual, 
      consultasOrdenadas,
      profesionalDatos,
      mesaTrabajo,
      nivelComplejidad,
      estadoCaso
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
function generarHTMLInformeSVE(cliente, todasConsultas, usuario, mesaTrabajo, nivelComplejidad, estadoCaso) {
  
  const primeraConsulta = todasConsultas[0];
  const ultimaConsulta  = todasConsultas[todasConsultas.length - 1];
  const sexo = cliente.sexo || '';

  const mesesES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const nombreEmpresa = cliente.cliente_final || cliente.subcontratista_definitivo
                      || cliente.subcontratista_nombre || 'No especificado';

  // ── Firma ──────────────────────────────────────────────────────
  const profesionalNombre = usuario ? usuario.nombre : 'No especificado';
  const profesionalCedula = usuario ? usuario.cedula : null;
  const rutaFirma = profesionalCedula
    ? `img/firmas/firma_${profesionalCedula}.png`
    : null;

  // ── Resumen del proceso ────────────────────────────────────────
  const numeroSesiones = todasConsultas.length;
  const numeroHoras    = todasConsultas.reduce(
    (t, s) => t + (parseInt(s.horas_sesion) || 1), 0
  );

  // Parseo seguro de fecha ISO 'YYYY-MM-DD' sin conversión de zona horaria
  function parseFechaLocal(str) {
    const s = String(str).substring(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // fecha en hora local, sin UTC
  }

  const fechaInicio = parseFechaLocal(primeraConsulta.fecha);
  // ── Recomendaciones Finales SVE ────────────────────────────────
  // Se guardan en la tabla clients (campo recomendaciones_finales_sve),
  // NO en consultas_sve. Se leen desde window.clienteActual que ya
  // viene cargado con todos los campos del cliente.
  const recomendacionesFinales = window.clienteActual?.recomendaciones_finales_sve || null;

  // ── Fecha de cierre SVE — también viene de clients ─────────────
  const fechaCierreClienteRaw = window.clienteActual?.fecha_cierre_sve || null;
  const fechaCierreRaw = fechaCierreClienteRaw || ultimaConsulta.fecha;
  const fechaCierre    = parseFechaLocal(fechaCierreRaw);

  const diasEnProceso = Math.max(1,
    Math.floor((fechaCierre - fechaInicio) / (1000 * 60 * 60 * 24))
  );
  const mesCierre  = mesesES[fechaCierre.getMonth()];
  const anioCierre = fechaCierre.getFullYear();

  const fechaInicioFmt = formatDateInformeSVE(primeraConsulta.fecha);
  const fechaCierreFmt = formatDateInformeSVE(fechaCierreRaw);

  // ── Helper para campos opcionales ─────────────────────────────
  const campo = (label, valor) => valor
    ? `<div class="informe-data-item-sve">
         <span class="data-label-sve">${label}</span>
         <span class="data-value-sve">${escapeHtmlSVE(valor)}</span>
       </div>`
    : '';
  const campoFull = (label, valor) => valor
    ? `<div class="informe-data-item-sve full-width">
         <span class="data-label-sve">${label}</span>
         <span class="data-value-sve">${escapeHtmlSVE(valor)}</span>
       </div>`
    : '';

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

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- PÁGINA 1: Header + Datos trabajador + Resumen + Mesa      -->
    <!-- ══════════════════════════════════════════════════════════ -->

    <!-- Encabezado -->
    <div class="informe-header-sve">
      <div class="informe-logo-sve">
        <div class="logo-circle-sve">🏥</div>
        <h1>Sistema de Vigilancia Epidemiológica</h1>
      </div>
      <div class="informe-fecha-generacion-sve">
        <strong>Fecha de generación:</strong> ${formatDateInformeSVE(new Date().toISOString())}
      </div>
    </div>

    <!-- Empresa -->
    <div class="seccion-empresa-sve">
      <div class="empresa-nombre-sve">
        <strong>Empresa:</strong> ${escapeHtmlSVE(nombreEmpresa)}
      </div>
    </div>

    <!-- Datos del Trabajador -->
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

        ${campo('Cargo:', cliente.cargo)}
        ${campo('Vínculo:', cliente.vinculo)}
        ${campo('Sede:', cliente.sede)}
        ${campo('Email:', cliente.email)}
        ${campo('Teléfono:', cliente.telefono)}

        ${cliente.contacto_emergencia_nombre ? `
        <div class="informe-data-item-sve full-width">
          <span class="data-label-sve">Contacto de Emergencia:</span>
          <span class="data-value-sve">
            ${escapeHtmlSVE(cliente.contacto_emergencia_nombre)}
            (${escapeHtmlSVE(cliente.contacto_emergencia_parentesco)})
            — ${escapeHtmlSVE(cliente.contacto_emergencia_telefono)}
          </span>
        </div>` : ''}

      </div>
    </div>

    <!-- Resumen del Proceso -->
    <div class="informe-section-sve informe-estadisticas-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">📊</span>
        Resumen del Proceso
        ${nivelComplejidad ? `<span class="badge-nivel-informe badge-nivel-informe-${nivelComplejidad.toLowerCase()}">Nivel de complejidad: ${nivelComplejidad}</span>` : ''}
      </h2>
      <div class="estadisticas-grid-sve">
        <div class="estadistica-card-sve">
          <div class="estadistica-icon-sve">📅</div>
          <div class="estadistica-valor-sve">${numeroSesiones}</div>
          <div class="estadistica-label-sve">Sesiones Recibidas</div>
        </div>
        <div class="estadistica-card-sve">
          <div class="estadistica-icon-sve">⏱️</div>
          <div class="estadistica-valor-sve">${numeroHoras}h</div>
          <div class="estadistica-label-sve">Horas de Atención</div>
        </div>
        <div class="estadistica-card-sve">
          <div class="estadistica-icon-sve">📆</div>
          <div class="estadistica-valor-sve">${diasEnProceso}</div>
          <div class="estadistica-label-sve">Días en Proceso</div>
        </div>
       <div class="estadistica-card-sve">
  <div class="estadistica-icon-sve">${estadoCaso === 'Cerrado' ? '✅' : '📌'}</div>
  <div class="estadistica-valor-sve">${mesCierre}</div>
  <div class="mes-cierre-footer-sve">
    <span class="estadistica-label-sve">${estadoCaso === 'Cerrado' ? 'Mes de Cierre' : 'Mes Última Sesión'}</span>
    ${estadoCaso ? `<span class="badge-estado-caso badge-estado-caso-${estadoCaso.toLowerCase()}">Caso: ${estadoCaso}</span>` : ''}
  </div>
</div>
      </div>
      <div class="informe-cierre-info-sve">
        <div class="cierre-item-sve">
          <strong>📅 Fecha de Inicio:</strong> ${fechaInicioFmt}
        </div>
        <div class="cierre-item-sve">
          <strong>📅 Fecha de Cierre:</strong> ${fechaCierreFmt}
        </div>
        <div class="cierre-item-sve">
          <strong>📆 Año de Cierre:</strong> ${anioCierre}
        </div>
      </div>
    </div>

    <!-- Metodología — va en página 1, justo antes del salto -->
    <div class="informe-section-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">🔬</span>
        Metodología y Técnica de Recolección de Información
      </h2>
      <div class="metodologia-box-sve">
        Observación y entrevista semiestructurada. Lo anterior con el objetivo de preservar el estado de salud y funcionalidad, de conformidad con los artículos 2, 4 y 8 de la Ley 776 de 2002. Además de estar soportado como acción preventiva de riesgos; con la Resolución 2646 de 2008 del Ministerio de la Protección Social y Resolución 2764 de 2022 del Ministerio del Trabajo bajo los artículos 6 y 8. Lo anterior soportado de la metodología las guías técnicas y protocolos para la promoción, prevención e intervención de los factores psicosociales, aplicando protocolo de prevención y actuación de depresión.
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- PÁGINA 2+: Mesa de Trabajo + Historial + Recomendaciones  -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div class="page-break-before-sve"></div>

    <!-- Mesa de Trabajo — inicia página 2 -->
    ${mesaTrabajo ? `
    <div class="informe-section-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">📋</span>
        Mesa de Trabajo
      </h2>
      <div class="informe-grid-mesa-sve">
        ${campo('Criterio de Inclusión al SVE:', mesaTrabajo.criterio_inclusion)}
        ${campo('Diagnóstico:', mesaTrabajo.diagnostico)}
        ${campo('Código de Diagnóstico:', mesaTrabajo.codigo_diagnostico)}
        ${campoFull('Motivo de Evaluación y Situación Actual:', mesaTrabajo.motivo_evaluacion)}
      </div>
    </div>
    ` : ''}

    <!-- Historial de Sesiones -->
    <div class="informe-section-sve informe-sesiones-sve">
      <h2 class="informe-section-title-sve">
        <span class="section-icon-sve">📊</span>
        Historial de Sesiones y Recomendaciones
      </h2>

      ${todasConsultas.map((consulta, index) => `
        <div class="sesion-card-sve">
          <div class="sesion-header-sve">
            <span class="sesion-numero-sve">Sesión ${index + 1}</span>
            <span class="sesion-fecha-sve">📅 ${formatDateInformeSVE(consulta.fecha)}</span>
            <span class="sesion-modalidad-sve">${escapeHtmlSVE(consulta.modalidad)}</span>
          </div>
          <div class="sesion-contenido-sve">
            <div class="sesion-grid-sve">

              ${consulta.observaciones ? `
              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">📄 Observaciones:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.observaciones)}</div>
                </div>
              </div>` : ''}

              ${consulta.ajuste_funciones ? `
              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">⚙️ Ajustes a las Funciones:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.ajuste_funciones)}</div>
                </div>
              </div>` : ''}

              ${consulta.recomendaciones_medicas ? `
              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">💊 Recomendaciones Médicas:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_medicas)}</div>
                </div>
              </div>` : ''}

              ${consulta.recomendaciones_empresa ? `
              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">🏢 Recomendaciones para la Empresa:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_empresa)}</div>
                </div>
              </div>` : ''}

              ${consulta.recomendaciones_trabajador ? `
              <div class="sesion-bloque-sve">
                <div class="texto-completo-sve">
                  <span class="texto-label-sve">👤 Recomendaciones para el Trabajador:</span>
                  <div class="texto-contenido-sve">${escapeHtmlSVE(consulta.recomendaciones_trabajador)}</div>
                </div>
              </div>` : ''}

            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Recomendaciones Finales + Firma: agrupadas para evitar corte entre páginas -->
    <div class="bloque-cierre-sve">

      ${recomendacionesFinales ? `
      <div class="informe-section-sve informe-recomendaciones-finales-sve">
        <h2 class="informe-section-title-sve">
          <span class="section-icon-sve">📝</span>
          Recomendaciones Finales
        </h2>
        <div class="recomendaciones-finales-contenido-sve">
          <p>${escapeHtmlSVE(recomendacionesFinales).replace(/\n/g, '<br>')}</p>
        </div>
      </div>
      ` : ''}

      <!-- Firma -->
      <div class="informe-footer-sve">
        <div class="firma-y-nota-sve">
          <div class="firma-seccion-sve">
            ${rutaFirma ? `
            <div class="firma-imagen-container-sve">
              <img src="${rutaFirma}"
                   alt="Firma del Profesional"
                   class="firma-imagen-sve"
                   onerror="this.style.display='none'">
            </div>` : ''}
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