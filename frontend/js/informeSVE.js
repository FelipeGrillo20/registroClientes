// frontend/js/informeSVE.js - Sistema de Generación de Informes SVE

const MESA_TRABAJO_API = window.API_CONFIG.ENDPOINTS.MESA_TRABAJO_SVE;
const CONSULTAS_SVE_API = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
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
  
  console.log('🔍 Generando informe para cliente ID:', clienteId);

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
      consultasOrdenadas, // ✅ Pasar TODAS las consultas ordenadas
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
// ✅ CORREGIDO: Ahora recibe todasConsultas y las muestra ordenadas
// ============================================
function generarHTMLInformeSVE(cliente, todasConsultas, usuario) {
  
  // ✅ La primera consulta (cronológicamente) para obtener datos generales
  const primeraConsulta = todasConsultas[0];
  
  // Deducir sexo del nombre (simplificado)
  const primerNombre = cliente.nombre.split(' ')[0].toLowerCase();
  const nombresFemeninos = ['maria', 'ana', 'carmen', 'laura', 'andrea', 'paula', 'diana', 'claudia', 'luz', 'rosa', 'martha', 'sandra'];
  const esFemenino = nombresFemeninos.some(n => primerNombre.includes(n));
  const sexo = esFemenino ? 'Femenino' : 'Masculino';

  // Formatear fecha de la primera consulta
  const fechaConsulta = new Date(primeraConsulta.fecha);
  const fechaFormateada = fechaConsulta.toLocaleDateString('es-CO', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Hora actual del sistema
  const horaActual = new Date().toLocaleTimeString('es-CO', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  // Nombre de la empresa (Cliente Final)
  const nombreEmpresa = cliente.cliente_final || cliente.subcontratista_definitivo || cliente.subcontratista_nombre || 'No especificado';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe SVE - ${escapeHtml(cliente.nombre)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      background: white;
      padding: 40px;
      font-size: 12pt;
    }

    .informe-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      padding: 30px;
    }

    /* Header del informe */
    .informe-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #56ab2f;
    }

    .informe-titulo {
      font-size: 16pt;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .informe-subtitulo {
      font-size: 12pt;
      color: #56ab2f;
      font-weight: 600;
      margin-top: 5px;
    }

    /* Sección de empresa */
    .seccion-empresa {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
      border-left: 4px solid #56ab2f;
    }

    .empresa-nombre {
      font-size: 13pt;
      font-weight: bold;
      color: #2c3e50;
    }

    /* Sección de información */
    .seccion {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .seccion-titulo {
      font-size: 13pt;
      font-weight: bold;
      color: white;
      background: linear-gradient(135deg, #56ab2f, #a8e063);
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 15px;
    }

    .info-item {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #56ab2f;
    }

    .info-label {
      font-weight: bold;
      color: #56ab2f;
      font-size: 10pt;
      display: block;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .info-valor {
      color: #2c3e50;
      font-size: 11pt;
      font-weight: 500;
    }

    /* Sección de texto largo */
    .texto-completo {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #56ab2f;
      margin-bottom: 15px;
      text-align: justify;
      line-height: 1.8;
    }

    .texto-label {
      font-weight: bold;
      color: #56ab2f;
      font-size: 11pt;
      display: block;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .texto-contenido {
      color: #2c3e50;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Sección metodología */
    .metodologia-box {
      background: #e8f5e9;
      padding: 15px;
      border-radius: 6px;
      border: 2px solid #56ab2f;
      margin-bottom: 15px;
      text-align: justify;
      line-height: 1.7;
      font-size: 10.5pt;
    }

    /* ✅ NUEVA: Tarjeta de sesión individual */
    .sesion-card {
      background: linear-gradient(135deg, #fff9e6 0%, #ffe8b2 100%);
      padding: 20px;
      border-radius: 8px;
      border: 2px solid #f39c12;
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .sesion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f39c12;
    }

    .sesion-numero {
      font-size: 14pt;
      font-weight: bold;
      color: #e67e22;
    }

    .sesion-fecha {
      font-size: 11pt;
      color: #7f8c8d;
    }

    /* Footer del informe */
    .informe-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
    }

    .firma-psicologo {
      margin-top: 40px;
      text-align: center;
    }

    .firma-linea {
      border-top: 2px solid #2c3e50;
      width: 300px;
      margin: 0 auto 10px;
    }

    .firma-nombre {
      font-weight: bold;
      font-size: 11pt;
      color: #2c3e50;
    }

    .firma-datos {
      font-size: 10pt;
      color: #7f8c8d;
      margin-top: 5px;
    }

    /* Estilo para checkbox de sexo */
    .checkbox-sexo {
      display: inline-block;
      width: 15px;
      height: 15px;
      border: 2px solid #2c3e50;
      margin: 0 5px;
      vertical-align: middle;
      position: relative;
    }

    .checkbox-sexo.checked::after {
      content: 'X';
      position: absolute;
      top: -4px;
      left: 1px;
      font-size: 14pt;
      font-weight: bold;
      color: #2c3e50;
    }

    /* Estilos de impresión */
    @media print {
      body {
        padding: 0;
      }

      .informe-container {
        max-width: 100%;
        padding: 20px;
      }

      .seccion, .sesion-card {
        page-break-inside: avoid;
      }

      @page {
        margin: 2cm;
      }
    }

    /* Tabla de consultas */
    .tabla-consultas {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10pt;
    }

    .tabla-consultas th {
      background: linear-gradient(135deg, #56ab2f, #a8e063);
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #56ab2f;
    }

    .tabla-consultas td {
      padding: 10px;
      border: 1px solid #e9ecef;
      background: #f8f9fa;
    }

    .tabla-consultas tr:nth-child(even) td {
      background: white;
    }
  </style>
</head>
<body>
  <div class="informe-container">
    
    <!-- HEADER DEL INFORME -->
    <div class="informe-header">
      <h1 class="informe-titulo">
        Evaluación Psicológica Ocupacional Integral<br>
        a Condiciones de Salud y Trabajo
      </h1>
      <div class="informe-subtitulo">Sistema de Vigilancia Epidemiológica</div>
    </div>

    <!-- INFORMACIÓN DE LA EMPRESA -->
    <div class="seccion-empresa">
      <div class="empresa-nombre">
        <strong>Nombre de la Empresa:</strong> ${escapeHtml(nombreEmpresa)}
      </div>
    </div>

    <!-- INFORMACIÓN DEL TRABAJADOR -->
    <div class="seccion">
      <div class="seccion-titulo">📋 Información del Trabajador</div>
      
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Nombre y Apellidos</span>
          <span class="info-valor">${escapeHtml(cliente.nombre)}</span>
        </div>
        
        <div class="info-item">
          <span class="info-label">No. Identificación</span>
          <span class="info-valor">${escapeHtml(cliente.cedula)}</span>
        </div>
        
        <div class="info-item" style="grid-column: span 2;">
          <span class="info-label">Sexo</span>
          <span class="info-valor">
            Femenino 
            <span class="checkbox-sexo ${sexo === 'Femenino' ? 'checked' : ''}"></span>
            Masculino 
            <span class="checkbox-sexo ${sexo === 'Masculino' ? 'checked' : ''}"></span>
          </span>
        </div>
      </div>

      <!-- Cargo (Pendiente - se puede agregar al modelo de cliente más adelante) -->
      <div class="info-item">
        <span class="info-label">Cargo que Desempeña Actualmente</span>
        <span class="info-valor">(Pendiente de registro)</span>
      </div>
    </div>

    <!-- MOTIVO DE EVALUACIÓN Y SITUACIÓN ACTUAL (PRIMERA SESIÓN) -->
    <div class="seccion">
      <div class="seccion-titulo">🔍 Motivo de Evaluación y Situación Actual</div>
      <div class="texto-completo">
        <div class="texto-contenido">${escapeHtml(primeraConsulta.motivo_evaluacion)}</div>
      </div>
    </div>

    <!-- METODOLOGÍA Y TÉCNICA -->
    <div class="seccion">
      <div class="seccion-titulo">🔬 Metodología y Técnica de Recolección de Información</div>
      <div class="metodologia-box">
        Observación y entrevista semiestructurada. Lo anterior con el objetivo de preservar el estado de salud y funcionalidad, de conformidad con los artículos 2, 4 y 8 de la Ley 776 de 2002. Además de estar soportado como acción preventiva de riesgos; con la Resolución 2646 de 2008 del Ministerio de la Protección Social y Resolución 2764 de 2022 del Ministerio del Trabajo bajo los artículos 6 y 8. Lo anterior soportado de la metodología las guías técnicas y protocolos para la promoción, prevención e intervención de los factores psicosociales, aplicando protocolo de prevención y actuación de depresión.
      </div>
    </div>

    <!-- ✅ NUEVO: HISTORIAL DE TODAS LAS SESIONES CON RECOMENDACIONES -->
    <div class="seccion">
      <div class="seccion-titulo">📊 Historial de Sesiones y Recomendaciones</div>
      
      ${todasConsultas.map((consulta, index) => {
        const fechaSesion = new Date(consulta.fecha).toLocaleDateString('es-CO', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        return `
          <div class="sesion-card">
            <div class="sesion-header">
              <div class="sesion-numero">📌 Sesión #${index + 1}</div>
              <div class="sesion-fecha">📅 ${fechaSesion} | ${consulta.modalidad}</div>
            </div>

            ${consulta.motivo_evaluacion ? `
              <div class="texto-completo">
                <span class="texto-label">🔍 Motivo de Evaluación:</span>
                <div class="texto-contenido">${escapeHtml(consulta.motivo_evaluacion)}</div>
              </div>
            ` : ''}

            ${consulta.observaciones ? `
              <div class="texto-completo">
                <span class="texto-label">📄 Observaciones:</span>
                <div class="texto-contenido">${escapeHtml(consulta.observaciones)}</div>
              </div>
            ` : ''}

            <div class="texto-completo">
              <span class="texto-label">⚙️ Ajustes a las Funciones:</span>
              <div class="texto-contenido">${escapeHtml(consulta.ajuste_funciones)}</div>
            </div>

            <div class="texto-completo">
              <span class="texto-label">💊 Recomendaciones Médicas:</span>
              <div class="texto-contenido">${escapeHtml(consulta.recomendaciones_medicas)}</div>
            </div>

            <div class="texto-completo">
              <span class="texto-label">🏢 Recomendaciones para la Empresa:</span>
              <div class="texto-contenido">${escapeHtml(consulta.recomendaciones_empresa)}</div>
            </div>

            <div class="texto-completo">
              <span class="texto-label">👤 Recomendaciones para el Trabajador:</span>
              <div class="texto-contenido">${escapeHtml(consulta.recomendaciones_trabajador)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- RESUMEN DE CONSULTAS -->
    ${todasConsultas.length > 1 ? `
      <div class="seccion">
        <div class="seccion-titulo">📋 Resumen de Consultas</div>
        <table class="tabla-consultas">
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
                <td>${new Date(consulta.fecha).toLocaleDateString('es-CO')}</td>
                <td>${consulta.modalidad}</td>
                <td>${consulta.estado}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- FOOTER CON FIRMA -->
    <div class="informe-footer">
      <div class="firma-psicologo">
        <div class="firma-linea"></div>
        <div class="firma-nombre">${escapeHtml(usuario.nombre || 'Psicólogo Ocupacional')}</div>
        <div class="firma-datos">
          Tarjeta Profesional: 142861<br>
          Licencia SST: 19950
        </div>
      </div>
    </div>

  </div>

  <script>
    // Auto-imprimir cuando se carga la página
    window.onload = function() {
      window.print();
    };

    // Cerrar la ventana después de imprimir o cancelar
    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>
  `;
}

// Función auxiliar para escapar HTML (reutilizada)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

// Estilos para el botón (agregar dinámicamente)
const estilosBotonSVE = document.createElement('style');
estilosBotonSVE.textContent = `
  .btn-informe-sve {
    background: linear-gradient(135deg, #56ab2f, #a8e063);
    color: white;
    border: none;
    padding: 16px 40px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 15px rgba(86, 171, 47, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .btn-informe-sve:hover {
    background: linear-gradient(135deg, #a8e063, #56ab2f);
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(86, 171, 47, 0.5);
  }
  
  .btn-informe-sve:active {
    transform: translateY(-1px);
  }
`;

document.head.appendChild(estilosBotonSVE);

console.log('✅ informeSVE.js cargado correctamente');