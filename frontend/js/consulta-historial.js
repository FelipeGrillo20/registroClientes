// frontend/js/consulta-historial.js
// MÓDULO 3: Lógica del historial de consultas (Orientación Psicosocial)
// Depende de: consulta-api.js, consulta-cliente.js

// ============================================
// CACHÉ DE DATOS DE CIERRE POR CONSULTA
// Guarda fecha_cierre y recomendaciones_finales
// de cada consulta antes de que el backend las
// limpie al reabrir. Se indexa por consulta_number.
// ============================================
const cacheDatosCierre = {};

window.getCacheDatosCierre = function(consultaNumber) {
  return cacheDatosCierre[consultaNumber] || null;
};

window.setCacheDatosCierre = function(consultaNumber, fechaCierre, recomendaciones) {
  cacheDatosCierre[consultaNumber] = {
    fecha_cierre: fechaCierre,
    recomendaciones_finales: recomendaciones
  };
};

// Devuelve true si la consulta activa (consultaNumberActual) tiene
// alguna sesión cerrada — no mezcla con otras consultas del trabajador
function hayCasoCerrado() {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
  if (numActual === null) return false;
  return consultasDelCliente.some(
    c => c.consulta_number === numActual && c.estado === 'Cerrado'
  );
}

// Devuelve el motivo de la primera sesión de la consulta activa
function getMotivoSesionActual() {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
  const sesiones = consultasDelCliente
    .filter(c => c.consulta_number === numActual)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  return sesiones.length > 0 ? sesiones[0].motivo_consulta : null;
}

// Configura el campo motivo según el estado de la consulta activa
function configurarCampoMotivo() {
  const select = $('#motivo_consulta');
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
  const sesionesActuales = consultasDelCliente.filter(
    c => c.consulta_number === numActual
  );
  const numSesiones = sesionesActuales.length;
  const casoCerrado = hayCasoCerrado();

  if (editandoConsultaId) {
    select.prop('disabled', false);
    return;
  }

  if (casoCerrado) {
    select.prop('disabled', true);
    return;
  }

  if (numSesiones === 0) {
    // Primera sesión de esta consulta: motivo libre
    select.prop('disabled', false);
    select.val(null).trigger('change');
  } else {
    // Sesiones siguientes: motivo bloqueado al de la primera sesión
    const motivoActual = getMotivoSesionActual();
    select.val(motivoActual).trigger('change');
    select.prop('disabled', true);
  }

  mostrarCampoConsultasSugeridas(numSesiones, casoCerrado);
}

function mostrarCampoConsultasSugeridas(numSesiones, casoCerrado) {
  const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
  const consultasSugeridasInput = document.getElementById("consultas_sugeridas");

  if (numSesiones === 0 && !casoCerrado && !editandoConsultaId) {
    consultasSugeridasGroup.style.display = "block";
    consultasSugeridasInput.required = true;

    // Solo precargar el valor si es una sesión adicional de una consulta
    // YA EXISTENTE (consultaNumberActual tiene valor).
    // Si es null significa que es una consulta NUEVA → campo vacío obligatorio.
    const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
    const esConsultaNueva = numActual === null;

    if (!esConsultaNueva && clienteActual && clienteActual.consultas_sugeridas) {
      consultasSugeridasInput.value = clienteActual.consultas_sugeridas;
    } else {
      consultasSugeridasInput.value = "";
    }
  } else {
    consultasSugeridasGroup.style.display = "none";
    consultasSugeridasInput.required = false;
    consultasSugeridasInput.value = "";
  }
}

// ============================================
// CERRAR CASO — usa el nuevo endpoint dedicado
// que escribe fecha_cierre y recomendaciones
// directamente en la tabla consultas
// ============================================

async function cerrarTodasLasConsultas(clienteId, fechaCierre, recomendacionesFinales) {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;

  try {
    const res = await fetch(`${CONSULTAS_API_URL}/cerrar`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        cliente_id: parseInt(clienteId),
        consulta_number: numActual,
        fecha_cierre: fechaCierre,
        recomendaciones_finales: recomendacionesFinales || null
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Error al cerrar el caso");
    }

    return true;
  } catch (err) {
    console.error("Error cerrando caso:", err);
    alert("Error al cerrar el caso: " + err.message);
    return false;
  }
}

// ============================================
// REABRIR CASO — usa el nuevo endpoint dedicado
// que limpia fecha_cierre y vuelve estado a Abierto
// solo para el consulta_number activo
// ============================================

window.reabrirCaso = async function() {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;

  // Verificar en el estado local si ya hay otra consulta abierta
  const otraConsultaAbierta = consultasDelCliente.some(
    c => c.consulta_number !== numActual && c.estado === 'Abierto'
  );

  if (otraConsultaAbierta) {
    // Identificar cuál consulta está abierta para dar un mensaje claro
    const numAbierta = consultasDelCliente.find(
      c => c.consulta_number !== numActual && c.estado === 'Abierto'
    )?.consulta_number;

    alert(
      `⚠️ No es posible reabrir la Consulta ${numActual}.\n\n` +
      `La Consulta ${numAbierta} ya está activa. ` +
      `Solo puede haber una consulta abierta a la vez.\n\n` +
      `Cierra la Consulta ${numAbierta} antes de reabrir esta.`
    );
    return;
  }

  if (!confirm(
    `¿Estás seguro de reabrir la Consulta ${numActual}?\n\n` +
    `Las sesiones volverán a estar disponibles para editar.`
  )) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    // Capturar fecha_cierre y recomendaciones ANTES de llamar al backend
    // porque el endpoint /reabrir las limpia (fecha_cierre = NULL).
    // Las guardamos en caché indexadas por consulta_number para que
    // toggleFechaCierreField las encuentre cuando el profesional vuelva
    // a seleccionar estado "Cerrado".
    const sesionesActuales = consultasDelCliente.filter(
      c => c.consulta_number === numActual
    );
    const sesionConCierre = sesionesActuales.find(s => s.fecha_cierre);
    window.setCacheDatosCierre(
      numActual,
      sesionConCierre ? sesionConCierre.fecha_cierre : null,
      sesionConCierre ? sesionConCierre.recomendaciones_finales : null
    );

    const res = await fetch(`${CONSULTAS_API_URL}/reabrir`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        cliente_id: parseInt(clienteId),
        consulta_number: numActual
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Error al reabrir el caso");
    }

    alert("✅ Caso reabierto correctamente. Las sesiones están disponibles nuevamente.\n\n💡 Las recomendaciones finales se han conservado.");
    await loadClientData();

  } catch (err) {
    console.error("Error reabriendo caso:", err);
    alert("❌ Error al reabrir el caso: " + err.message);
  }
};

// ============================================
// CARGAR HISTORIAL — agrupa por consulta_number
// y renderiza pestañas
// ============================================

async function loadHistorialConsultas(clienteId) {
  const container = document.getElementById("historialContainer");

  container.innerHTML = `
    <div class="loading-historial">
      <span class="spinner"></span>
      <p>Cargando historial...</p>
    </div>
  `;

  try {
    const res = await fetch(`${CONSULTAS_API_URL}/cliente/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Error al cargar historial");

    const consultas = await res.json();

    // Guardar copia global ordenada por consulta_number + fecha
    consultasDelCliente = consultas
      ? JSON.parse(JSON.stringify(consultas)).sort((a, b) =>
          a.consulta_number - b.consulta_number ||
          new Date(a.fecha) - new Date(b.fecha) ||
          a.id - b.id
        )
      : [];
    window.consultasDelCliente = consultasDelCliente;

    if (!consultas || consultas.length === 0) {
      // Sin historial: consulta nueva, consultaNumberActual = null
      window.setConsultaNumberActual(null);

      container.innerHTML = `
        <div class="no-historial">
          <div class="no-historial-icon">🔭</div>
          <p>No hay consultas registradas para este cliente</p>
        </div>
      `;
      renderBotonesNuevaConsulta(null);
      configurarCampoMotivo();
      return;
    }

    // Mostrar sección historial
    const historialSection = document.querySelector('.historial-section');
    if (historialSection) historialSection.style.display = 'block';

    // Obtener lista de consulta_numbers únicos ordenados
    const numerosConsulta = [...new Set(
      consultasDelCliente.map(c => c.consulta_number)
    )].sort((a, b) => a - b);

    // Determinar cuál es la pestaña a mostrar respetando este orden de prioridad:
    //
    //   1. Si el profesional ya tenía una pestaña seleccionada (consultaNumberActual)
    //      Y ese número sigue existiendo → mantener esa pestaña.
    //      Esto cubre el caso de editar/cerrar/reabrir una consulta y que el
    //      historial no salte a otra pestaña al recargar.
    //
    //   2. Si hay alguna consulta con estado Abierto → activar esa.
    //
    //   3. Si todas están cerradas → activar la última (número más alto).

    const numPrevio = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
    const numPrevioSigueExistiendo = numPrevio !== null && numerosConsulta.includes(numPrevio);

    const consultaAbierta = consultasDelCliente
      .filter(c => c.estado === 'Abierto')
      .sort((a, b) => b.consulta_number - a.consulta_number)[0];

    const maxConsultaNumber = numerosConsulta[numerosConsulta.length - 1];

    const consultaActivaNum = numPrevioSigueExistiendo
      ? numPrevio
      : consultaAbierta
        ? consultaAbierta.consulta_number
        : maxConsultaNumber;

    // Sincronizar consultaNumberActual con la pestaña activa al cargar
    window.setConsultaNumberActual(consultaActivaNum);

    // Asignar numeroSesion dentro de cada consulta de forma independiente
    // y poblar el caché de datos de cierre para todas las consultas
    numerosConsulta.forEach(num => {
      const sesionesDeEstaConsulta = consultasDelCliente
        .filter(c => c.consulta_number === num)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);
      sesionesDeEstaConsulta.forEach((s, i) => { s.numeroSesion = i + 1; });

      // Guardar en caché fecha_cierre y recomendaciones de cada consulta
      // para que toggleFechaCierreField las encuentre incluso tras reabrir
      const sesionConCierre = sesionesDeEstaConsulta.find(s => s.fecha_cierre);
      if (sesionConCierre) {
        window.setCacheDatosCierre(
          num,
          sesionConCierre.fecha_cierre,
          sesionConCierre.recomendaciones_finales
        );
      }
    });

    // Renderizar pestañas y contenido
    renderPestanas(numerosConsulta, consultaActivaNum);
    renderBotonesNuevaConsulta(consultaActivaNum);
    configurarCampoMotivo();

  } catch (err) {
    console.error("Error cargando historial:", err);
    container.innerHTML = `
      <div class="no-historial">
        <div class="no-historial-icon">⚠️</div>
        <p>Error al cargar el historial de consultas</p>
      </div>
    `;
  }
}

// ============================================
// RENDERIZAR PESTAÑAS DE CONSULTAS
// ============================================

function renderPestanas(numerosConsulta, consultaActivaNum) {
  const container = document.getElementById("historialContainer");

  // Construir cabecera de pestañas
  const tabsHTML = numerosConsulta.map(num => {
    const sesiones = consultasDelCliente.filter(c => c.consulta_number === num);
    const tieneCerrado = sesiones.some(c => c.estado === 'Cerrado');
    const tieneAbierto = sesiones.some(c => c.estado === 'Abierto');
    const estadoLabel = tieneCerrado && !tieneAbierto ? 'Cerrada' : 'Activa';
    const estadoClass = tieneCerrado && !tieneAbierto ? 'badge-consulta-cerrada' : 'badge-consulta-activa';
    const isActive = num === consultaActivaNum ? 'consulta-tab-active' : '';

    return `
      <button
        class="consulta-tab ${isActive}"
        onclick="cambiarPestanaConsulta(${num})"
        data-consulta-num="${num}"
      >
        Consulta ${num}
        <span class="badge-consulta-estado ${estadoClass}">${estadoLabel}</span>
      </button>
    `;
  }).join('');

  // Construir contenido de cada pestaña
  const panelesHTML = numerosConsulta.map(num => {
    const sesiones = consultasDelCliente
      .filter(c => c.consulta_number === num)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);

    const isActive = num === consultaActivaNum ? 'consulta-pane-active' : '';
    return `
      <div class="consulta-pane ${isActive}" data-pane-num="${num}">
        ${renderSesiones(sesiones, num)}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="consultas-tabs-header">
      ${tabsHTML}
    </div>
    <div class="consultas-tabs-content">
      ${panelesHTML}
    </div>
  `;
}

// ============================================
// CAMBIAR PESTAÑA ACTIVA
// ============================================

window.cambiarPestanaConsulta = function(num) {
  // Actualizar estado de pestañas
  document.querySelectorAll('.consulta-tab').forEach(tab => {
    tab.classList.toggle('consulta-tab-active', parseInt(tab.dataset.consultaNum) === num);
  });

  // Mostrar/ocultar paneles
  document.querySelectorAll('.consulta-pane').forEach(pane => {
    pane.classList.toggle('consulta-pane-active', parseInt(pane.dataset.paneNum) === num);
  });

  // Sincronizar consultaNumberActual
  window.setConsultaNumberActual(num);

  // Reconfigurar el formulario para esta consulta
  configurarCampoMotivo();

  // Actualizar estado del botón Nueva Consulta
  renderBotonesNuevaConsulta(num);
};

// ============================================
// RENDERIZAR SESIONES DE UNA CONSULTA
// ============================================

function renderSesiones(sesiones, consultaNum) {
  const tieneCerrado = sesiones.some(c => c.estado === 'Cerrado');
  const tieneAbierto = sesiones.some(c => c.estado === 'Abierto');
  const consultaCerrada = tieneCerrado && !tieneAbierto;

  const sesionesHTML = sesiones.map(c => {
    const fecha = formatDate(c.fecha);
    const estadoClass = c.estado.toLowerCase();
    const esCerrado = consultaCerrada;
    const botonesDeshabilitados = esCerrado ? 'disabled' : '';

    return `
      <div class="consulta-card ${esCerrado ? 'consulta-cerrada' : ''}">
        <div class="consulta-card-header">
          <div class="consulta-fecha-wrapper">
            <span class="consulta-sesion-badge">Sesión ${c.numeroSesion}</span>
            <span class="consulta-fecha-label">Fecha de Consulta</span>
            <div class="consulta-fecha">📅 ${fecha}</div>
          </div>
          <div class="consulta-badges">
            <span class="badge badge-modalidad">${c.modalidad}</span>
            <span class="badge badge-estado ${estadoClass}">${c.estado}</span>
          </div>
        </div>

        <div class="consulta-motivo-section">
          <h4 class="consulta-motivo-titulo">📋 Motivo de Consulta</h4>
          <div class="consulta-motivo">
            ${c.motivo_consulta ? escapeHtml(c.motivo_consulta) : 'No especificado'}
          </div>
        </div>

        ${c.columna1 ? `
          <div class="consulta-observaciones">
            <strong>📄 Observaciones:</strong>
            ${c.observaciones_confidenciales ? '<span class="badge-confidencial">🔒 Confidencial</span>' : ''}
            <br>${escapeHtml(c.columna1)}
          </div>
        ` : ''}

        <div class="consulta-actions">
          <button
            class="btn-edit-consulta"
            onclick="editarConsulta(${c.id})"
            ${botonesDeshabilitados}
            ${esCerrado ? 'title="No se puede editar una sesión cerrada"' : ''}
          >✏️ Editar</button>
          <button
            class="btn-delete-consulta"
            onclick="eliminarConsulta(${c.id})"
            ${botonesDeshabilitados}
            ${esCerrado ? 'title="No se puede eliminar una sesión cerrada"' : ''}
          >🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  // Recomendaciones y botones solo si la consulta está cerrada
  // Los datos de cierre vienen de las sesiones (campo fecha_cierre en consultas)
  let recomendacionesHTML = '';
  let botonesAccionHTML = '';

  if (consultaCerrada) {
    // Buscar fecha_cierre y recomendaciones en las sesiones de esta consulta
    const sesionConCierre = sesiones.find(s => s.fecha_cierre);
    const fechaCierreConsulta = sesionConCierre ? sesionConCierre.fecha_cierre : null;
    const recomendacionesConsulta = sesionConCierre ? sesionConCierre.recomendaciones_finales : null;

    if (recomendacionesConsulta) {
      recomendacionesHTML = `
        <div class="recomendaciones-finales-card">
          <div class="recomendaciones-header">
            <span class="recomendaciones-icon">📝</span>
            <h3 class="recomendaciones-titulo">Recomendaciones Finales</h3>
          </div>
          <div class="recomendaciones-contenido-historial">
            ${escapeHtml(recomendacionesConsulta).replace(/\n/g, '<br>')}
          </div>
          <div class="recomendaciones-footer">
            <span class="recomendaciones-fecha">
              📅 Fecha de cierre: ${fechaCierreConsulta ? formatDate(fechaCierreConsulta) : '-'}
            </span>
          </div>
        </div>
      `;
    }

    botonesAccionHTML = `
      <div class="acciones-caso-container">
        <button class="btn-informe-paciente" onclick="generarInformePaciente()">
          📄 Informe Trabajador
        </button>
        <button class="btn-reabrir-caso" onclick="reabrirCaso()">
          🔓 Reabrir Caso
        </button>
      </div>
      <p class="acciones-caso-info">
        Al reabrir el caso, todas las sesiones estarán disponibles para editar o eliminar
      </p>
    `;
  }

  return sesionesHTML + recomendacionesHTML + botonesAccionHTML;
}

// ============================================
// BOTÓN "NUEVA CONSULTA"
// Reglas:
//   - Inhabilitado si la consulta activa está Abierta
//   - Habilitado solo si la consulta activa está Cerrada
//   - Al pulsarlo: resetea consultaNumberActual a null,
//     limpia el formulario y prepara una nueva pestaña
// ============================================

function renderBotonesNuevaConsulta(consultaActivaNum) {
  const btnNueva = document.getElementById("btnNuevaConsulta");
  if (!btnNueva) return;

  if (consultaActivaNum === null) {
    // Sin historial: no aplica, ocultar
    btnNueva.style.display = 'none';
    return;
  }

  btnNueva.style.display = 'inline-flex';

  const sesionesActivas = consultasDelCliente.filter(
    c => c.consulta_number === consultaActivaNum && c.estado === 'Abierto'
  );
  const consultaEstaAbierta = sesionesActivas.length > 0;

  btnNueva.disabled = consultaEstaAbierta;
  btnNueva.title = consultaEstaAbierta
    ? 'Debe cerrar la consulta activa antes de abrir una nueva'
    : 'Abrir una nueva consulta independiente para este trabajador';
}

window.abrirNuevaConsulta = function() {
  const btnNueva = document.getElementById("btnNuevaConsulta");
  if (btnNueva && btnNueva.disabled) return;

  if (!confirm("¿Deseas abrir una nueva consulta para este trabajador?\n\nSe creará una consulta independiente con su propio historial de sesiones.")) {
    return;
  }

  // Resetear consultaNumberActual → el backend calculará MAX+1 en el próximo POST
  window.setConsultaNumberActual(null);

  // Limpiar en memoria los datos de cierre de la consulta anterior
  // para que ningún campo del formulario los precargue
  if (clienteActual) {
    clienteActual.consultas_sugeridas    = null;
    clienteActual.recomendaciones_finales = null;
    clienteActual.fecha_cierre           = null;
  }
  if (window.clienteActual) {
    window.clienteActual.consultas_sugeridas    = null;
    window.clienteActual.recomendaciones_finales = null;
    window.clienteActual.fecha_cierre           = null;
  }

  // Limpiar y habilitar el formulario para la nueva consulta
  const formConsulta = document.getElementById("formConsulta");
  if (formConsulta) formConsulta.reset();

  $('#motivo_consulta').val(null).trigger('change');
  $('#motivo_consulta').prop('disabled', false);

  // Mostrar campo de consultas sugeridas vacío para la nueva consulta
  const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
  const consultasSugeridasInput = document.getElementById("consultas_sugeridas");
  if (consultasSugeridasGroup) {
    consultasSugeridasGroup.style.display = "block";
    consultasSugeridasInput.required = true;
    consultasSugeridasInput.value = "";
  }

  // Limpiar también el campo de recomendaciones finales por si quedó visible
  const recomendacionesInput = document.getElementById("recomendaciones_finales");
  if (recomendacionesInput) recomendacionesInput.value = "";

  // Ocultar el contenedor de fecha de cierre si estuviera visible
  const fechaCierreContainer = document.getElementById("fechaCierreContainer");
  if (fechaCierreContainer) fechaCierreContainer.classList.remove("show");

  // Deshabilitar el botón hasta que se registre la primera sesión
  if (btnNueva) btnNueva.disabled = true;

  // Scroll al formulario
  const consultaSection = document.querySelector(".consulta-section");
  if (consultaSection) consultaSection.scrollIntoView({ behavior: "smooth" });
};

console.log('✅ Módulo consulta-historial.js cargado');