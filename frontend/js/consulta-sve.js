// frontend/js/consulta-sve.js
// MÓDULO 5: Sistema de Vigilancia Epidemiológica (SVE)
// Depende de: consulta-api.js, consulta-cliente.js

// ============================================
// URLs Y VARIABLES GLOBALES SVE
// ============================================

const MESA_TRABAJO_SVE_API_URL = window.API_CONFIG.ENDPOINTS.MESA_TRABAJO_SVE;
const CONSULTAS_SVE_API_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

let mesaTrabajoRegistrada = false;
let mesaTrabajoData = null;
let consultasSVE = [];
let editandoMesaTrabajo = false;
let editandoConsultaSVE = null;
let casoSVECerrado = false;

// ============================================
// INICIALIZACIÓN SVE
// ============================================

function inicializarSVE() {
  const modalidad = localStorage.getItem('modalidadSeleccionada');

  if (modalidad !== 'Sistema de Vigilancia Epidemiológica') return;

  console.log('✅ Inicializando Sistema de Vigilancia Epidemiológica');

  // Eliminar completamente la sección de historial de consultas normales
  const historialSection = document.querySelector('.historial-section');
  if (historialSection) {
    historialSection.remove();
  }

  // Cargar datos desde el backend
  cargarDatosSVE();

  // Eventos Formulario 1: Mesa de Trabajo
  const formMesaTrabajo = document.getElementById('formMesaTrabajo');
  if (formMesaTrabajo) {
    formMesaTrabajo.addEventListener('submit', registrarMesaTrabajo);
  }

  // Eventos Formulario 2: Consulta SVE
  const formConsultaSVE = document.getElementById('formConsultaVigilancia');
  if (formConsultaSVE) {
    formConsultaSVE.addEventListener('submit', registrarConsultaSVE);
  }

  // Botón editar mesa de trabajo
  const btnEditarMesa = document.getElementById('btnEditarMesaTrabajo');
  if (btnEditarMesa) {
    btnEditarMesa.addEventListener('click', habilitarEdicionMesaTrabajo);
  }

  // Botón refrescar historial SVE
  const btnRefreshSVE = document.getElementById('btnRefreshSVE');
  if (btnRefreshSVE) {
    btnRefreshSVE.addEventListener('click', () => cargarDatosSVE());
  }

  // Listener para toggle fecha de cierre SVE
  const estadoSVE = document.getElementById('estado_sve');
  if (estadoSVE) {
    estadoSVE.addEventListener('change', toggleFechaCierreSVE);
  }

  // Fecha por defecto en consulta
  const fechaConsultaSVE = document.getElementById('fecha_consulta_sve');
  if (fechaConsultaSVE) {
    fechaConsultaSVE.value = getFechaLocalHoy();
  }
}

// ============================================
// CARGAR DATOS SVE DESDE BACKEND
// ============================================

async function cargarDatosSVE() {
  const clienteId = getClienteIdFromURL();
  if (!clienteId) return;

  try {
    // 1. Cargar Mesa de Trabajo
    const resMesa = await fetch(`${MESA_TRABAJO_SVE_API_URL}/cliente/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (resMesa.ok) {
      mesaTrabajoData = await resMesa.json();
      mesaTrabajoRegistrada = true;

      document.getElementById('criterio_inclusion').value = mesaTrabajoData.criterio_inclusion;
      document.getElementById('diagnostico').value = mesaTrabajoData.diagnostico;
      document.getElementById('codigo_diagnostico').value = mesaTrabajoData.codigo_diagnostico;

      mostrarMesaTrabajoRegistrada();
      deshabilitarFormularioMesaTrabajo();
      desbloquearFormularioConsulta();
    } else if (resMesa.status === 404) {
      mesaTrabajoRegistrada = false;
      mesaTrabajoData = null;
      console.log('ℹ️ No hay Mesa de Trabajo registrada para este cliente');
    }

    // 2. Cargar Consultas SVE
    const resConsultas = await fetch(`${CONSULTAS_SVE_API_URL}/cliente/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (resConsultas.ok) {
      let consultasTemp = await resConsultas.json();

      consultasSVE = consultasTemp.sort((a, b) => {
        const diffFecha = new Date(a.fecha) - new Date(b.fecha);
        if (diffFecha !== 0) return diffFecha;
        return a.id - b.id;
      });

      console.log('✅ Consultas SVE cargadas y ordenadas:', consultasSVE);
      mostrarConsultasSVE();
    }

    // 3. Mostrar historial si hay datos
    if (mesaTrabajoRegistrada || consultasSVE.length > 0) {
      document.getElementById('historialSVE').style.display = 'block';

      // Mostrar botón de informe si hay datos completos
      if (mesaTrabajoRegistrada && consultasSVE.length > 0) {
        if (typeof window.mostrarBotonInformeSVE === 'function') {
          window.mostrarBotonInformeSVE();
        } else {
          setTimeout(() => {
            if (typeof window.mostrarBotonInformeSVE === 'function') {
              window.mostrarBotonInformeSVE();
            }
          }, 500);
        }
      }
    }

  } catch (err) {
    console.error('❌ Error cargando datos SVE:', err);
    alert('⚠️ Error al cargar datos del Sistema de Vigilancia Epidemiológica');
  }
}

// ============================================
// FORMULARIO 1: MESA DE TRABAJO
// ============================================

async function registrarMesaTrabajo(e) {
  e.preventDefault();

  const clienteId = getClienteIdFromURL();
  if (!clienteId) {
    alert('⚠️ Error: No se pudo identificar el cliente');
    return;
  }

  const datos = {
    cliente_id: parseInt(clienteId),
    criterio_inclusion: document.getElementById('criterio_inclusion').value,
    diagnostico: document.getElementById('diagnostico').value.trim(),
    codigo_diagnostico: document.getElementById('codigo_diagnostico').value.trim()
  };

  try {
    let response;

    if (editandoMesaTrabajo && mesaTrabajoData) {
      response = await fetch(`${MESA_TRABAJO_SVE_API_URL}/${mesaTrabajoData.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(datos)
      });
    } else {
      response = await fetch(MESA_TRABAJO_SVE_API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(datos)
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Error al guardar Mesa de Trabajo");
    }

    mesaTrabajoData = await response.json();
    mesaTrabajoRegistrada = true;
    editandoMesaTrabajo = false;

    alert('✅ Mesa de Trabajo registrada correctamente');

    deshabilitarFormularioMesaTrabajo();
    mostrarMesaTrabajoRegistrada();
    desbloquearFormularioConsulta();

    document.getElementById('historialSVE').style.display = 'block';
    document.getElementById('contenedorConsulta').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('❌ Error registrando mesa de trabajo:', err);
    alert('❌ ' + err.message);
  }
}

function deshabilitarFormularioMesaTrabajo() {
  const form = document.getElementById('formMesaTrabajo');
  const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="reset"]');

  inputs.forEach(input => { input.disabled = true; });

  const contenedor = document.getElementById('contenedorMesaTrabajo');
  contenedor.style.opacity = '0.8';
  contenedor.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';

  const btnSubmit = document.getElementById('btnRegistrarMesaTrabajo');
  btnSubmit.innerHTML = '✅ Mesa de Trabajo Registrada';
}

function habilitarEdicionMesaTrabajo() {
  if (!confirm('¿Desea editar la Mesa de Trabajo registrada?')) return;

  editandoMesaTrabajo = true;

  const form = document.getElementById('formMesaTrabajo');
  const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="reset"]');

  inputs.forEach(input => { input.disabled = false; });

  const contenedor = document.getElementById('contenedorMesaTrabajo');
  contenedor.style.opacity = '1';
  contenedor.style.background = 'white';

  const btnSubmit = document.getElementById('btnRegistrarMesaTrabajo');
  btnSubmit.innerHTML = '💾 Actualizar Mesa de Trabajo';

  contenedor.scrollIntoView({ behavior: 'smooth' });
}

function mostrarMesaTrabajoRegistrada() {
  if (!mesaTrabajoData) return;

  const contenedor = document.getElementById('mesaTrabajoRegistrada');
  const contenido = document.getElementById('mesaTrabajoContenido');

  contenido.innerHTML = `
    <div class="mesa-trabajo-item">
      <strong>✔ Criterio de Inclusión:</strong>
      <p>${escapeHtml(mesaTrabajoData.criterio_inclusion)}</p>
    </div>
    <div class="mesa-trabajo-item">
      <strong>🩺 Diagnóstico:</strong>
      <p>${escapeHtml(mesaTrabajoData.diagnostico)}</p>
    </div>
    <div class="mesa-trabajo-item">
      <strong>🔢 Código de Diagnóstico:</strong>
      <p>${escapeHtml(mesaTrabajoData.codigo_diagnostico)}</p>
    </div>
  `;

  contenedor.style.display = 'block';
}

function desbloquearFormularioConsulta() {
  const contenedor = document.getElementById('contenedorConsulta');
  const form = document.getElementById('formConsultaVigilancia');
  const inputs = form.querySelectorAll('input, select, textarea, button');
  const bloqueoBadge = document.getElementById('bloqueoConsulta');

  contenedor.classList.remove('bloqueado');
  bloqueoBadge.style.display = 'none';

  inputs.forEach(input => { input.disabled = false; });
}

// ============================================
// CAMPO FECHA DE CIERRE SVE - TOGGLE
// ============================================

function toggleFechaCierreSVE() {
  const estadoSelect = document.getElementById("estado_sve");
  const fechaCierreSVEContainer = document.getElementById("fechaCierreSVEContainer");
  const fechaCierreSVEInput = document.getElementById("fecha_cierre_sve");
  const recomendacionesSVEInput = document.getElementById("recomendaciones_finales_sve");

  if (estadoSelect.value === "Cerrado") {
    fechaCierreSVEContainer.classList.add("show");
    fechaCierreSVEInput.required = true;
    recomendacionesSVEInput.required = true;

    if (!fechaCierreSVEInput.value) {
      fechaCierreSVEInput.value = getFechaLocalHoy();
    }

    if (clienteActual && clienteActual.recomendaciones_finales_sve && !recomendacionesSVEInput.value) {
      recomendacionesSVEInput.value = clienteActual.recomendaciones_finales_sve;
    }
  } else {
    fechaCierreSVEContainer.classList.remove("show");
    fechaCierreSVEInput.required = false;
    recomendacionesSVEInput.required = false;
    fechaCierreSVEInput.value = "";
  }
}

// ============================================
// FORMULARIO 2: REGISTRAR CONSULTA SVE
// ============================================

async function registrarConsultaSVE(e) {
  e.preventDefault();

  if (!mesaTrabajoRegistrada) {
    alert('⚠️ Debe completar primero la Mesa de Trabajo');
    return;
  }

  const clienteId = getClienteIdFromURL();
  if (!clienteId) {
    alert('⚠️ Error: No se pudo identificar el cliente');
    return;
  }

  const estado = document.getElementById('estado_sve').value;
  const fecha_cierre_sve = document.getElementById('fecha_cierre_sve').value;
  const recomendaciones_finales_sve = document.getElementById('recomendaciones_finales_sve').value.trim();

  // Validar campos de cierre
  if (estado === "Cerrado") {
    if (!fecha_cierre_sve) {
      alert("⚠️ Por favor especifica la fecha de cierre del caso SVE");
      return;
    }
    if (!recomendaciones_finales_sve) {
      alert("⚠️ Por favor escribe las recomendaciones finales antes de cerrar el caso SVE");
      return;
    }
  }

  const consulta = {
    cliente_id: parseInt(clienteId),
    fecha: document.getElementById('fecha_consulta_sve').value,
    modalidad: document.getElementById('modalidad_sve').value,
    motivo_evaluacion: document.getElementById('motivo_evaluacion_sve').value.trim(),
    ajuste_funciones: document.getElementById('ajuste_funciones_sve').value.trim(),
    recomendaciones_medicas: document.getElementById('recomendaciones_medicas_sve').value.trim(),
    recomendaciones_trabajador: document.getElementById('recomendaciones_trabajador_sve').value.trim(),
    recomendaciones_empresa: document.getElementById('recomendaciones_empresa_sve').value.trim(),
    observaciones: document.getElementById('observaciones_consulta_sve').value.trim() || null,
    estado: estado
  };

  console.log('📤 Enviando consulta SVE:', consulta);

  try {
    let response;

    if (editandoConsultaSVE) {
      console.log('🔄 Actualizando consulta SVE ID:', editandoConsultaSVE);
      response = await fetch(`${CONSULTAS_SVE_API_URL}/${editandoConsultaSVE}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(consulta)
      });
    } else {
      console.log('➕ Creando nueva consulta SVE');
      response = await fetch(CONSULTAS_SVE_API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(consulta)
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Error al guardar consulta SVE");
    }

    const consultaGuardada = await response.json();
    console.log('✅ Consulta SVE guardada:', consultaGuardada);

    // Si el estado es "Cerrado", actualizar el cliente
    if (estado === 'Cerrado') {
      const exitoCierre = await cerrarCasoSVE(clienteId, fecha_cierre_sve, recomendaciones_finales_sve);

      if (!exitoCierre) {
        alert('⚠️ La consulta se guardó pero hubo un error al cerrar el caso');
        return;
      }

      alert('✅ Consulta SVE registrada y caso cerrado correctamente');
    } else {
      alert(editandoConsultaSVE ? '✅ Consulta SVE actualizada correctamente' : '✅ Consulta SVE registrada correctamente');
    }

    // Limpiar formulario
    document.getElementById('formConsultaVigilancia').reset();
    document.getElementById('fecha_consulta_sve').value = getFechaLocalHoy();

    editandoConsultaSVE = null;
    document.getElementById('btnRegistrarConsultaSVE').innerHTML = '💾 Registrar Consulta';

    await loadClientData();
    await cargarDatosSVE();

  } catch (err) {
    console.error('❌ Error registrando consulta SVE:', err);
    alert('❌ ' + err.message);
  }
}

// ============================================
// CERRAR CASO SVE
// ============================================

async function cerrarCasoSVE(clienteId, fechaCierre, recomendacionesFinales) {
  try {
    console.log('🔒 INICIANDO CIERRE DE CASO SVE');

    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resCliente.ok) {
      throw new Error("Error al obtener datos del cliente");
    }

    const clienteData = await resCliente.json();

    const clienteActualizado = {
      cedula: clienteData.cedula,
      nombre: clienteData.nombre,
      vinculo: clienteData.vinculo,
      sede: clienteData.sede,
      tipo_entidad_pagadora: clienteData.tipo_entidad_pagadora,
      entidad_pagadora_especifica: clienteData.entidad_pagadora_especifica,
      empresa_id: clienteData.empresa_id,
      subcontratista_id: clienteData.subcontratista_id,
      email: clienteData.email,
      telefono: clienteData.telefono,
      contacto_emergencia_nombre: clienteData.contacto_emergencia_nombre,
      contacto_emergencia_parentesco: clienteData.contacto_emergencia_parentesco,
      contacto_emergencia_telefono: clienteData.contacto_emergencia_telefono,
      fecha_cierre: clienteData.fecha_cierre,
      recomendaciones_finales: clienteData.recomendaciones_finales,
      consultas_sugeridas: clienteData.consultas_sugeridas,
      fecha_cierre_sve: fechaCierre,
      recomendaciones_finales_sve: recomendacionesFinales,
      sexo: clienteData.sexo || null,
      cargo: clienteData.cargo || null
    };

    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });

    if (!resUpdate.ok) {
      const errorData = await resUpdate.json();
      throw new Error(errorData.message || "Error al actualizar el cliente");
    }

    // Cerrar todas las consultas SVE abiertas
    const promisesCerrar = consultasSVE.map(consulta => {
      if (consulta.estado !== 'Cerrado') {
        return fetch(`${CONSULTAS_SVE_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...consulta,
            estado: 'Cerrado',
            cliente_id: parseInt(clienteId)
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promisesCerrar);
    console.log('✅ Caso SVE cerrado correctamente');

    return true;
  } catch (err) {
    console.error("❌ ERROR CERRANDO CASO SVE:", err);
    alert("❌ Error al cerrar el caso SVE: " + err.message);
    return false;
  }
}

function hayCasoSVECerrado() {
  return consultasSVE.some(c => c.estado === 'Cerrado');
}

// ============================================
// MOSTRAR CONSULTAS SVE EN EL HISTORIAL
// ============================================

function mostrarConsultasSVE() {
  const contenedor = document.getElementById('consultasSVERegistradas');

  if (consultasSVE.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No hay consultas registradas</p>';
    return;
  }

  const casoCerrado = hayCasoSVECerrado();
  casoSVECerrado = casoCerrado;

  const consultasOrdenadas = [...consultasSVE].sort((a, b) => {
    const diffFecha = new Date(a.fecha) - new Date(b.fecha);
    if (diffFecha !== 0) return diffFecha;
    return a.id - b.id;
  });

  const html = consultasOrdenadas.map((consulta, index) => {
    const esCerrado = consulta.estado === 'Cerrado' || casoCerrado;
    const botonesDeshabilitados = esCerrado ? 'disabled' : '';
    const tituloDeshabilitado = esCerrado ? 'title="No se puede editar/eliminar una consulta cerrada"' : '';

    return `
    <div class="consulta-sve-card ${esCerrado ? 'consulta-cerrada' : ''}">
      <div class="consulta-sve-header">
        <div class="sesion-sve-numero">Sesión #${index + 1}</div>
        <span class="badge badge-modalidad">${consulta.modalidad}</span>
        <span class="badge badge-estado ${consulta.estado.toLowerCase()}">${consulta.estado}</span>
      </div>
      <div class="consulta-sve-body">
        <div class="consulta-sve-item">
          <strong>📅 Fecha:</strong>
          <span>${formatDate(consulta.fecha)}</span>
        </div>
        <div class="consulta-sve-item">
          <strong>📝 Motivo de Evaluación:</strong>
          <p>${escapeHtml(consulta.motivo_evaluacion)}</p>
        </div>
        <div class="consulta-sve-item">
          <strong>⚙️ Ajuste a las Funciones:</strong>
          <p>${escapeHtml(consulta.ajuste_funciones)}</p>
        </div>
        <div class="consulta-sve-item">
          <strong>💊 Recomendaciones Médicas:</strong>
          <p>${escapeHtml(consulta.recomendaciones_medicas)}</p>
        </div>
        <div class="consulta-sve-item">
          <strong>👤 Recomendaciones al Trabajador:</strong>
          <p>${escapeHtml(consulta.recomendaciones_trabajador)}</p>
        </div>
        <div class="consulta-sve-item">
          <strong>🏢 Recomendaciones a la Empresa:</strong>
          <p>${escapeHtml(consulta.recomendaciones_empresa)}</p>
        </div>
        ${consulta.observaciones ? `
          <div class="consulta-sve-item">
            <strong>📄 Observaciones:</strong>
            <p>${escapeHtml(consulta.observaciones)}</p>
          </div>
        ` : ''}
      </div>
      <div class="consulta-sve-actions">
        <button 
          class="btn-edit-consulta-sve" 
          onclick="editarConsultaSVE(${consulta.id})" 
          ${botonesDeshabilitados}
          ${tituloDeshabilitado}
        >
          ✏️ Editar
        </button>
        <button 
          class="btn-delete-consulta-sve" 
          onclick="eliminarConsultaSVE(${consulta.id})"
          ${botonesDeshabilitados}
          ${tituloDeshabilitado}
        >
          🗑️ Eliminar
        </button>
      </div>
    </div>
  `;
  }).join('');

  const recomendacionesHTML = (casoCerrado && clienteActual && clienteActual.recomendaciones_finales_sve) ? `
    <div class="recomendaciones-finales-sve-card">
      <div class="recomendaciones-sve-header">
        <span class="recomendaciones-sve-icon">📋</span>
        <h3 class="recomendaciones-sve-titulo">Recomendaciones Finales SVE</h3>
      </div>
      <div class="recomendaciones-sve-contenido-historial">
        ${escapeHtml(clienteActual.recomendaciones_finales_sve).replace(/\n/g, '<br>')}
      </div>
      <div class="recomendaciones-sve-footer">
        <span class="recomendaciones-sve-fecha">
          📅 Fecha de cierre: ${clienteActual.fecha_cierre_sve ? formatDate(clienteActual.fecha_cierre_sve) : '-'}
        </span>
      </div>
    </div>
  ` : '';

  const botonesAccionHTML = casoCerrado ? `
    <div class="acciones-caso-sve-container">
      <button class="btn-imprimir-informe-sve" onclick="generarInformeSVE()">
        📄 Imprimir Informe SVE
      </button>
      <button class="btn-reabrir-caso-sve" onclick="reabrirCasoSVE()">
        🔓 Reabrir Caso SVE
      </button>
    </div>
    <p class="acciones-caso-sve-info">
      Al reabrir el caso SVE, todas las consultas estarán disponibles para editar o eliminar
    </p>
  ` : '';

  contenedor.innerHTML = html + recomendacionesHTML + botonesAccionHTML;
}

// ============================================
// EDITAR / ELIMINAR CONSULTA SVE
// ============================================

window.editarConsultaSVE = async function(id) {
  if (hayCasoSVECerrado()) {
    alert("⚠️ No se puede editar una consulta cuando el caso SVE está cerrado");
    return;
  }

  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!response.ok) throw new Error("Consulta SVE no encontrada");

    const consulta = await response.json();

    document.getElementById('fecha_consulta_sve').value = consulta.fecha.split('T')[0];
    document.getElementById('modalidad_sve').value = consulta.modalidad;
    document.getElementById('motivo_evaluacion_sve').value = consulta.motivo_evaluacion;
    document.getElementById('ajuste_funciones_sve').value = consulta.ajuste_funciones;
    document.getElementById('recomendaciones_medicas_sve').value = consulta.recomendaciones_medicas;
    document.getElementById('recomendaciones_trabajador_sve').value = consulta.recomendaciones_trabajador;
    document.getElementById('recomendaciones_empresa_sve').value = consulta.recomendaciones_empresa;
    document.getElementById('observaciones_consulta_sve').value = consulta.observaciones || '';
    document.getElementById('estado_sve').value = consulta.estado;

    toggleFechaCierreSVE();
    editandoConsultaSVE = id;
    document.getElementById('btnRegistrarConsultaSVE').innerHTML = '💾 Actualizar Consulta';

    document.getElementById('contenedorConsulta').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('❌ Error cargando consulta SVE:', err);
    alert('❌ Error al cargar consulta para editar');
  }
};

window.eliminarConsultaSVE = async function(id) {
  if (hayCasoSVECerrado()) {
    alert("⚠️ No se puede eliminar una consulta cuando el caso SVE está cerrado");
    return;
  }

  if (!confirm('¿Estás seguro de eliminar esta consulta SVE?')) return;

  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!response.ok) throw new Error("Error al eliminar consulta SVE");

    alert('✅ Consulta SVE eliminada correctamente');
    await cargarDatosSVE();

  } catch (err) {
    console.error('❌ Error eliminando consulta SVE:', err);
    alert('❌ Error al eliminar consulta SVE');
  }
};

// ============================================
// REABRIR CASO SVE
// ============================================

window.reabrirCasoSVE = async function() {
  if (!confirm("¿Estás seguro de reabrir el caso SVE? Todas las consultas volverán a estar disponibles para editar.")) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    const promises = consultasSVE.map(consulta => {
      if (consulta.estado === 'Cerrado') {
        return fetch(`${CONSULTAS_SVE_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...consulta,
            estado: 'Abierto',
            cliente_id: parseInt(clienteId)
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);

    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (resCliente.ok) {
      const clienteData = await resCliente.json();

      const clienteActualizado = {
        cedula: clienteData.cedula,
        nombre: clienteData.nombre,
        vinculo: clienteData.vinculo,
        sede: clienteData.sede,
        tipo_entidad_pagadora: clienteData.tipo_entidad_pagadora,
        entidad_pagadora_especifica: clienteData.entidad_pagadora_especifica,
        empresa_id: clienteData.empresa_id,
        subcontratista_id: clienteData.subcontratista_id,
        email: clienteData.email,
        telefono: clienteData.telefono,
        contacto_emergencia_nombre: clienteData.contacto_emergencia_nombre,
        contacto_emergencia_parentesco: clienteData.contacto_emergencia_parentesco,
        contacto_emergencia_telefono: clienteData.contacto_emergencia_telefono,
        fecha_cierre: clienteData.fecha_cierre,
        recomendaciones_finales: clienteData.recomendaciones_finales,
        consultas_sugeridas: clienteData.consultas_sugeridas,
        fecha_cierre_sve: null,
        recomendaciones_finales_sve: clienteData.recomendaciones_finales_sve,
        sexo: clienteData.sexo || null,
        cargo: clienteData.cargo || null
      };

      await fetch(`${API_URL}/${clienteId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(clienteActualizado)
      });
    }

    alert("✅ Caso SVE reabierto correctamente. Todas las consultas están disponibles nuevamente.\n\n💡 Las recomendaciones finales se han conservado y podrás editarlas al cerrar el caso nuevamente.");

    await loadClientData();
    await cargarDatosSVE();

  } catch (err) {
    console.error("❌ Error reabriendo caso SVE:", err);
    alert("❌ Error al reabrir el caso SVE");
  }
};

console.log('✅ Módulo consulta-sve.js cargado');