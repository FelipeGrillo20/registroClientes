// frontend/js/consulta.js - PARTE 1: ORIENTACIÓN PSICOSOCIAL

const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;
const CONSULTAS_API_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS;

let clienteActual = null;
let editandoConsultaId = null;
let consultasDelCliente = [];

// Exponer variables globalmente para informe.js
window.clienteActual = null;
window.consultasDelCliente = [];

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Función para obtener headers con autenticación
function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getAuthToken()}`
  };
}

// Obtener ID del cliente desde la URL
function getClienteIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("cliente");
}

// ⭐ ACTUALIZADO: Mostrar/Ocultar campo de fecha de cierre y recomendaciones según el estado
function toggleFechaCierreField() {
  const estadoSelect = document.getElementById("estado");
  const fechaCierreContainer = document.getElementById("fechaCierreContainer");
  const fechaCierreInput = document.getElementById("fecha_cierre");
  const recomendacionesInput = document.getElementById("recomendaciones_finales");
  
  if (estadoSelect.value === "Cerrado") {
    fechaCierreContainer.classList.add("show");
    fechaCierreInput.required = true;
    recomendacionesInput.required = true;
    
    // ⭐ Resetear el flag de modificación manual al abrir el campo
    fechaCierreModificadaManualmente = false;
    
    // ⭐ Sincronizar con la fecha del formulario si está disponible, sino usar hoy
    const fechaFormulario = document.getElementById("fecha")?.value;
    if (!fechaCierreInput.value) {
      if (fechaFormulario) {
        fechaCierreInput.value = fechaFormulario;
      } else {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        fechaCierreInput.value = `${year}-${month}-${day}`;
      }
    }
    
    // ⭐ NUEVO: Cargar recomendaciones existentes si las hay
    if (clienteActual && clienteActual.recomendaciones_finales && !recomendacionesInput.value) {
      recomendacionesInput.value = clienteActual.recomendaciones_finales;
    }
  } else {
    fechaCierreContainer.classList.remove("show");
    fechaCierreInput.required = false;
    recomendacionesInput.required = false;
    fechaCierreInput.value = "";
    // ⭐ Resetear el flag al cerrar el campo
    fechaCierreModificadaManualmente = false;
  }
}

// Agregar listener al campo de estado
document.getElementById("estado")?.addEventListener("change", toggleFechaCierreField);

// ⭐ NUEVO: Sincronizar fecha de cierre cuando cambia la fecha del formulario
// Flag para saber si el usuario modificó manualmente la fecha de cierre
let fechaCierreModificadaManualmente = false;

document.getElementById("fecha_cierre")?.addEventListener("change", function() {
  // El usuario cambió manualmente la fecha de cierre → marcar como modificada
  fechaCierreModificadaManualmente = true;
});

document.getElementById("fecha")?.addEventListener("change", function() {
  const estadoSelect = document.getElementById("estado");
  const fechaCierreInput = document.getElementById("fecha_cierre");
  
  // Solo sincronizar si el estado es "Cerrado" y el usuario NO modificó la fecha de cierre manualmente
  if (estadoSelect?.value === "Cerrado" && fechaCierreInput && !fechaCierreModificadaManualmente) {
    fechaCierreInput.value = this.value;
  }
});

// ⭐ NUEVO: Función para toggle de confidencialidad
window.toggleConfidencialidad = function() {
  const btnCandado = document.getElementById("btnCandado");
  const candadoIcon = document.getElementById("candadoIcon");
  const candadoTexto = document.getElementById("candadoTexto");
  const observacionesInfo = document.getElementById("observacionesInfo");
  const hiddenInput = document.getElementById("observaciones_confidenciales");
  
  const esConfidencial = hiddenInput.value === "true";
  
  if (esConfidencial) {
    // Cambiar a NO confidencial (visible en informe)
    hiddenInput.value = "false";
    btnCandado.classList.remove("confidencial");
    candadoIcon.textContent = "🔓";
    candadoTexto.textContent = "Visible en informe";
    observacionesInfo.innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
    observacionesInfo.classList.remove("confidencial");
  } else {
    // Cambiar a confidencial (NO visible en informe)
    hiddenInput.value = "true";
    btnCandado.classList.add("confidencial");
    candadoIcon.textContent = "🔒";
    candadoTexto.textContent = "Confidencial (No visible)";
    observacionesInfo.innerHTML = '🔒 Estas observaciones <strong>NO se mostrarán</strong> en el informe del trabajador';
    observacionesInfo.classList.add("confidencial");
  }
};

// Cargar datos del cliente
async function loadClientData() {
  const clienteId = getClienteIdFromURL();

  if (!clienteId) {
    alert("⚠️ No se especificó un cliente");
    window.location.href = "clientes.html";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Cliente no encontrado");
    }

    const cliente = await res.json();
    clienteActual = cliente;
    window.clienteActual = cliente;

    // Mostrar datos en la tarjeta
    displayClientData(cliente);
    
    // ⭐ MODIFICADO: Solo cargar historial si estamos en modalidad Orientación Psicosocial
    const modalidad = localStorage.getItem('modalidadSeleccionada');
    if (modalidad !== 'Sistema de Vigilancia Epidemiológica') {
      // Solo cargar historial de consultas en modalidad Orientación Psicosocial
      loadHistorialConsultas(clienteId);
    }
    // Si es SVE, el historial se carga en cargarDatosSVE()

  } catch (err) {
    console.error("Error cargando cliente:", err);
    alert("❌ Error al cargar datos del cliente");
    window.location.href = "clientes.html";
  }
}

// Mostrar datos del cliente en la tarjeta
function displayClientData(cliente) {
  document.getElementById("clientCedula").textContent = cliente.cedula || "-";
  document.getElementById("clientNombre").textContent = cliente.nombre || "-";
  document.getElementById("clientSede").textContent = cliente.sede || "-";
  document.getElementById("clientEmail").textContent = cliente.email || "-";
  document.getElementById("clientTelefono").textContent = cliente.telefono || "-";

  // Mostrar Vínculo con badge
  const vinculoElement = document.getElementById("clientVinculo");
  if (cliente.vinculo === 'Trabajador') {
    vinculoElement.innerHTML = '<span class="badge-vinculo-consulta badge-trabajador-consulta">Trabajador</span>';
  } else if (cliente.vinculo === 'Familiar Trabajador') {
    vinculoElement.innerHTML = '<span class="badge-vinculo-consulta badge-familiar-consulta">Familiar Trabajador</span>';
  } else {
    vinculoElement.textContent = "-";
  }

  // Mostrar Empresa Usuario con badge
  const empresaElement = document.getElementById("clientEmpresa");
  if (cliente.cliente_final) {
    empresaElement.innerHTML = `<span class="badge-empresa-consulta">${escapeHtml(cliente.cliente_final)}</span>`;
  } else {
    empresaElement.textContent = "-";
  }

  // ⭐ NUEVO: Mostrar Subcontratista si existe
  const subcontratistaElement = document.getElementById("clientSubcontratista");
  const labelSubcontratista = document.getElementById("labelSubcontratista");
  const nombreSubcontratista = cliente.subcontratista_definitivo || cliente.subcontratista_nombre;
  
  if (nombreSubcontratista) {
    labelSubcontratista.style.display = "inline";
    subcontratistaElement.style.display = "block";
    subcontratistaElement.innerHTML = `<span class="badge-subcontratista-consulta">${escapeHtml(nombreSubcontratista)}</span>`;
  } else {
    labelSubcontratista.style.display = "none";
    subcontratistaElement.style.display = "none";
  }

  // Mostrar Entidad Pagadora
  const entidadPagadoraElement = document.getElementById("clientEntidadPagadora");
  
  if (cliente.tipo_entidad_pagadora) {
    let textoEntidad = '';
    
    if (cliente.tipo_entidad_pagadora === 'Particular') {
      textoEntidad = '<span class="badge-entidad-pagadora badge-particular">Particular</span>';
    } else {
      const entidadEspecifica = cliente.entidad_pagadora_especifica || '';
      textoEntidad = `
        <span class="badge-entidad-pagadora badge-${cliente.tipo_entidad_pagadora.toLowerCase()}">
          ${escapeHtml(cliente.tipo_entidad_pagadora)}
        </span>
        <span class="entidad-arrow">→</span>
        <span class="badge-entidad-especifica">
          ${escapeHtml(entidadEspecifica)}
        </span>
      `;
    }
    
    entidadPagadoraElement.innerHTML = textoEntidad;
  } else {
    entidadPagadoraElement.textContent = "-";
  }

  // ⭐ Mostrar consultas sugeridas si existe
  const consultasSugeridasInfo = document.getElementById("consultasSugeridasInfo");
  const consultasSugeridasValue = document.getElementById("clientConsultasSugeridas");
  
  if (cliente.consultas_sugeridas) {
    consultasSugeridasValue.textContent = `${cliente.consultas_sugeridas} sesiones`;
    consultasSugeridasInfo.style.display = "flex";
  } else {
    consultasSugeridasInfo.style.display = "none";
  }

  // Actualizar badge con nombre del cliente
  const badge = document.getElementById("clientBadge");
  const primerNombre = cliente.nombre ? cliente.nombre.split(" ")[0] : "Cliente";
  badge.textContent = primerNombre;
}

// ============================================
// FUNCIONALIDAD CONTACTO DE EMERGENCIA
// ============================================

document.getElementById("btnContactoEmergencia")?.addEventListener("click", () => {
  if (!clienteActual) {
    alert("⚠️ No hay datos del cliente cargados");
    return;
  }

  if (clienteActual.contacto_emergencia_nombre) {
    document.getElementById("contactoNombreVer").textContent = 
      clienteActual.contacto_emergencia_nombre;
    document.getElementById("contactoParentescoVer").textContent = 
      clienteActual.contacto_emergencia_parentesco;
    document.getElementById("contactoTelefonoVer").textContent = 
      clienteActual.contacto_emergencia_telefono;
    document.getElementById("modalVerContacto").classList.add("show");
  } else {
    abrirModalCrearContacto();
  }
});

function abrirModalCrearContacto() {
  document.getElementById("editContactoNombre").value = clienteActual.contacto_emergencia_nombre || "";
  document.getElementById("editContactoParentesco").value = clienteActual.contacto_emergencia_parentesco || "";
  document.getElementById("editContactoTelefono").value = clienteActual.contacto_emergencia_telefono || "";
  
  document.getElementById("modalEditarContacto").classList.add("show");
}

window.cerrarModalContacto = function() {
  document.getElementById("modalVerContacto").classList.remove("show");
};

window.cerrarModalEditarContacto = function() {
  document.getElementById("modalEditarContacto").classList.remove("show");
};

document.getElementById("modalVerContacto")?.addEventListener("click", (e) => {
  if (e.target.id === "modalVerContacto") {
    cerrarModalContacto();
  }
});

document.getElementById("modalEditarContacto")?.addEventListener("click", (e) => {
  if (e.target.id === "modalEditarContacto") {
    cerrarModalEditarContacto();
  }
});

document.getElementById("formEditarContacto")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const nombre = document.getElementById("editContactoNombre").value.trim();
  const parentesco = document.getElementById("editContactoParentesco").value;
  const telefono = document.getElementById("editContactoTelefono").value.trim();

  if (!nombre || !parentesco || !telefono) {
    alert("⚠️ Por favor completa todos los campos");
    return;
  }

  try {
    const clienteId = getClienteIdFromURL();
    
    const datosActualizados = {
      ...clienteActual,
      contacto_emergencia_nombre: nombre,
      contacto_emergencia_parentesco: parentesco,
      contacto_emergencia_telefono: telefono
    };

    const res = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(datosActualizados)
    });

    if (!res.ok) {
      throw new Error("Error al guardar contacto de emergencia");
    }

    alert("✅ Contacto de emergencia guardado correctamente");
    
    clienteActual.contacto_emergencia_nombre = nombre;
    clienteActual.contacto_emergencia_parentesco = parentesco;
    clienteActual.contacto_emergencia_telefono = telefono;
    window.clienteActual = clienteActual;
    
    cerrarModalEditarContacto();
    
  } catch (err) {
    console.error("Error guardando contacto:", err);
    alert("❌ Error al guardar contacto de emergencia");
  }
});

window.verContactoDesdeHistorial = async function() {
  if (!clienteActual) {
    alert("⚠️ No hay datos del cliente");
    return;
  }

  if (!clienteActual.contacto_emergencia_nombre) {
    abrirModalCrearContacto();
  } else {
    document.getElementById("contactoNombreVer").textContent = 
      clienteActual.contacto_emergencia_nombre;
    document.getElementById("contactoParentescoVer").textContent = 
      clienteActual.contacto_emergencia_parentesco;
    document.getElementById("contactoTelefonoVer").textContent = 
      clienteActual.contacto_emergencia_telefono;
    document.getElementById("modalVerContacto").classList.add("show");
  }
};

window.editarContactoDesdeModal = function() {
  cerrarModalContacto();
  abrirModalCrearContacto();
};

// ============================================
// FUNCIONES PARA SISTEMA DE SESIONES
// ============================================

function hayCasoCerrado() {
  return consultasDelCliente.some(c => c.estado === 'Cerrado');
}

function getMotivoSesion1() {
  if (consultasDelCliente.length > 0) {
    const ordenadas = [...consultasDelCliente].sort((a, b) => 
      new Date(a.fecha) - new Date(b.fecha)
    );
    return ordenadas[0].motivo_consulta;
  }
  return null;
}

function configurarCampoMotivo() {
  const select = $('#motivo_consulta');
  const numSesiones = consultasDelCliente.length;
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
    select.prop('disabled', false);
    select.val(null).trigger('change');
  } else {
    const motivoSesion1 = getMotivoSesion1();
    select.val(motivoSesion1).trigger('change');
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
    
    if (clienteActual && clienteActual.consultas_sugeridas) {
      consultasSugeridasInput.value = clienteActual.consultas_sugeridas;
    }
  } else {
    consultasSugeridasGroup.style.display = "none";
    consultasSugeridasInput.required = false;
    consultasSugeridasInput.value = "";
  }
}

async function cerrarTodasLasConsultas(clienteId, fechaCierre, recomendacionesFinales) {
  try {
    const promises = consultasDelCliente.map(consulta => {
      if (consulta.estado !== 'Cerrado') {
        return fetch(`${CONSULTAS_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            motivo_consulta: consulta.motivo_consulta,
            actividad: consulta.actividad,
            modalidad: consulta.modalidad,
            fecha: consulta.fecha.split('T')[0],
            columna1: consulta.columna1,
            estado: 'Cerrado',
            cliente_id: parseInt(clienteId),
            observaciones_confidenciales: consulta.observaciones_confidenciales || false
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);

    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    
    if (!resCliente.ok) throw new Error("Error al obtener datos del cliente");
    
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
      fecha_cierre: fechaCierre,
      recomendaciones_finales: recomendacionesFinales,
      consultas_sugeridas: clienteData.consultas_sugeridas,
      // ✅ FIX: campos requeridos por el backend para Familiar Trabajador / SVE
      cedula_trabajador: clienteData.cedula_trabajador || null,
      nombre_trabajador: clienteData.nombre_trabajador || null,
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

    return true;
  } catch (err) {
    console.error("Error cerrando caso:", err);
    alert("Error al cerrar el caso: " + err.message);
    return false;
  }
}

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
    
    consultasDelCliente = consultas ? JSON.parse(JSON.stringify(consultas)) : [];
    window.consultasDelCliente = consultasDelCliente;

    consultasDelCliente
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach((consulta, index) => {
        consulta.numeroSesion = index + 1;
      });

    if (!consultas || consultas.length === 0) {
      container.innerHTML = `
        <div class="no-historial">
          <div class="no-historial-icon">🔭</div>
          <p>No hay consultas registradas para este cliente</p>
        </div>
      `;
      
      configurarCampoMotivo();
      
      // ⭐ NO MOSTRAR la sección si no hay consultas
      return;
    }

    // ⭐ MOSTRAR la sección solo si HAY consultas
    const historialSection = document.querySelector('.historial-section');
    if (historialSection) {
      historialSection.style.display = 'block';
    }

    const consultasOrdenadas = JSON.parse(JSON.stringify(consultas)).sort((a, b) => {
      const diffFecha = new Date(a.fecha) - new Date(b.fecha);
      if (diffFecha !== 0) return diffFecha;
      return a.id - b.id;
    });
    
    consultasOrdenadas.forEach((consulta, index) => {
      consulta.numeroSesion = index + 1;
    });

    renderHistorial(consultasOrdenadas);
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

function renderHistorial(consultas) {
  const container = document.getElementById("historialContainer");
  const casoCerrado = hayCasoCerrado();
  
  const consultasHTML = consultas.map(c => {
    const fecha = formatDate(c.fecha);
    const estadoClass = c.estado.toLowerCase();
    const esCerrado = c.estado === 'Cerrado' || casoCerrado;
    const botonesDeshabilitados = esCerrado ? 'disabled' : '';
    
    return `
      <div class="consulta-card ${esCerrado ? 'consulta-cerrada' : ''}">
        <div class="consulta-card-header">
          <div class="consulta-fecha-wrapper">
            <span class="consulta-sesion-badge">Sesión ${c.numeroSesion}</span>
            <span class="consulta-fecha-label">Fecha de Consulta</span>
            <div class="consulta-fecha">
              📅 ${fecha}
            </div>
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
            <br>
            ${escapeHtml(c.columna1)}
          </div>
        ` : ''}
        
        <div class="consulta-actions">
          <button 
            class="btn-edit-consulta" 
            onclick="editarConsulta(${c.id})"
            ${botonesDeshabilitados}
            ${esCerrado ? 'title="No se puede editar una sesión cerrada"' : ''}
          >
            ✏️ Editar
          </button>
          <button 
            class="btn-delete-consulta" 
            onclick="eliminarConsulta(${c.id})"
            ${botonesDeshabilitados}
            ${esCerrado ? 'title="No se puede eliminar una sesión cerrada"' : ''}
          >
            🗑️ Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  const recomendacionesHTML = (casoCerrado && clienteActual && clienteActual.recomendaciones_finales) ? `
    <div class="recomendaciones-finales-card">
      <div class="recomendaciones-header">
        <span class="recomendaciones-icon">📝</span>
        <h3 class="recomendaciones-titulo">Recomendaciones Finales</h3>
      </div>
      <div class="recomendaciones-contenido-historial">
        ${escapeHtml(clienteActual.recomendaciones_finales).replace(/\n/g, '<br>')}
      </div>
      <div class="recomendaciones-footer">
        <span class="recomendaciones-fecha">
          📅 Fecha de cierre: ${clienteActual.fecha_cierre ? formatDate(clienteActual.fecha_cierre) : '-'}
        </span>
      </div>
    </div>
  ` : '';
  
  const botonesAccionHTML = casoCerrado ? `
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
  ` : '';
  
  container.innerHTML = consultasHTML + recomendacionesHTML + botonesAccionHTML;
}

function formatDate(dateString) {
  // ⭐ CORRECCIÓN ZONA HORARIA: Parsear la fecha como local, no como UTC
  // "2026-02-27" o "2026-02-27T00:00:00.000Z" → extraer partes directamente
  const partes = dateString.substring(0, 10).split('-');
  const year = partes[0];
  const month = partes[1];
  const day = partes[2];
  return `${day}/${month}/${year}`;
}

// ⭐ FUNCIÓN HELPER: Obtener fecha local en formato YYYY-MM-DD (evita bug de zona horaria UTC)
function getFechaLocalHoy() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.getElementById("formConsulta")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motivo_consulta = $('#motivo_consulta').val();
  const modalidad = document.getElementById("modalidad").value;
  const fecha = document.getElementById("fecha").value;
  const columna1 = document.getElementById("columna1").value.trim();
  const estado = document.getElementById("estado").value;
  const fecha_cierre = document.getElementById("fecha_cierre").value;
  const recomendaciones_finales = document.getElementById("recomendaciones_finales").value.trim();
  const observaciones_confidenciales = document.getElementById("observaciones_confidenciales").value === "true";
  const consultas_sugeridas = document.getElementById("consultas_sugeridas").value;

  if (!motivo_consulta || !modalidad || !fecha || !estado) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
    return;
  }
  
  if (consultasDelCliente.length === 0 && !editandoConsultaId && !consultas_sugeridas) {
    alert("⚠️ Por favor indica el número de consultas sugeridas para este trabajador");
    return;
  }

  if (estado === "Cerrado") {
    if (!fecha_cierre) {
      alert("⚠️ Por favor especifica la fecha de cierre del caso");
      return;
    }
    if (!recomendaciones_finales) {
      alert("⚠️ Por favor escribe las recomendaciones finales antes de cerrar el caso");
      return;
    }
  }

  // ✅ VALIDACIÓN 1: La fecha de la sesión no puede ser anterior a las sesiones previas
  if (consultasDelCliente.length > 0) {
    // Ordenar sesiones existentes por fecha para obtener la más reciente (excluyendo la que se edita)
    const sesionesOrdenadas = [...consultasDelCliente]
      .filter(c => !editandoConsultaId || c.id !== editandoConsultaId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (sesionesOrdenadas.length > 0) {
      const ultimaFecha = sesionesOrdenadas[sesionesOrdenadas.length - 1].fecha.substring(0, 10);
      const ultimoNumero = sesionesOrdenadas[sesionesOrdenadas.length - 1].numeroSesion || sesionesOrdenadas.length;

      if (fecha < ultimaFecha) {
        alert(
          `⚠️ La fecha seleccionada (${formatDate(fecha)}) es anterior a la Sesión ${ultimoNumero} (${formatDate(ultimaFecha)}).\n\n` +
          `Debes elegir una fecha igual o posterior a la sesión anterior.`
        );
        return;
      }
    }
  }

  // ✅ VALIDACIÓN 1B: La fecha de cierre debe ser >= a todas las sesiones
  if (estado === "Cerrado" && fecha_cierre && consultasDelCliente.length > 0) {
    const sesionesExistentes = editandoConsultaId
      ? consultasDelCliente.filter(c => c.id !== editandoConsultaId)
      : consultasDelCliente;

    // También incluimos la sesión actual que se está registrando
    const todasFechas = [...sesionesExistentes.map(c => c.fecha.substring(0, 10)), fecha];
    const fechaMaxSesion = todasFechas.sort().pop();

    if (fecha_cierre < fechaMaxSesion) {
      alert(
        `⚠️ La fecha de cierre (${formatDate(fecha_cierre)}) no puede ser anterior a la última sesión registrada (${formatDate(fechaMaxSesion)}).\n\n` +
        `La fecha de cierre debe ser igual o posterior a todas las sesiones.`
      );
      return;
    }
  }

  const clienteId = getClienteIdFromURL();

  const consultaData = {
    cliente_id: parseInt(clienteId),
    motivo_consulta,
    actividad: motivo_consulta,
    modalidad,
    fecha,
    columna1: columna1 || null,
    estado,
    fecha_cierre: estado === "Cerrado" ? fecha_cierre : null,
    observaciones_confidenciales
  };

  try {
    const method = editandoConsultaId ? "PUT" : "POST";
    const url = editandoConsultaId 
      ? `${CONSULTAS_API_URL}/${editandoConsultaId}`
      : CONSULTAS_API_URL;

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(consultaData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Error al guardar consulta");
    }

    const esPrimeraSesionNueva = consultasDelCliente.length === 0 && !editandoConsultaId;
    
    let esPrimeraSesionEditando = false;
    if (editandoConsultaId) {
      const consultaEditada = consultasDelCliente.find(c => c.id === editandoConsultaId);
      esPrimeraSesionEditando = consultaEditada && consultaEditada.numeroSesion === 1;
    }
    
    if ((esPrimeraSesionNueva || esPrimeraSesionEditando) && consultas_sugeridas) {
      await guardarConsultasSugeridas(clienteId, parseInt(consultas_sugeridas));
    }

    if (estado === 'Cerrado') {
      await cerrarTodasLasConsultas(clienteId, fecha_cierre, recomendaciones_finales);
    }

    const mensaje = editandoConsultaId 
      ? "✅ Consulta actualizada correctamente"
      : "✅ Consulta registrada correctamente";
    
    alert(mensaje);

    document.getElementById("formConsulta").reset();
    $('#motivo_consulta').val(null).trigger('change');
    editandoConsultaId = null;
    
    document.getElementById("observaciones_confidenciales").value = "false";
    document.getElementById("btnCandado").classList.remove("confidencial");
    document.getElementById("candadoIcon").textContent = "🔓";
    document.getElementById("candadoTexto").textContent = "Visible en informe";
    document.getElementById("observacionesInfo").innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
    document.getElementById("observacionesInfo").classList.remove("confidencial");
    
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";

    await loadClientData();

  } catch (err) {
    console.error("Error guardando consulta:", err);
    alert("❌ " + err.message);
  }
});

async function guardarConsultasSugeridas(clienteId, consultas_sugeridas) {
  try {
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    
    if (!resCliente.ok) throw new Error("Error al obtener datos del cliente");
    
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
      consultas_sugeridas: consultas_sugeridas,
      // ✅ FIX: campos requeridos por el backend para Familiar Trabajador / SVE
      cedula_trabajador: clienteData.cedula_trabajador || null,
      nombre_trabajador: clienteData.nombre_trabajador || null,
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
      throw new Error("Error al guardar consultas sugeridas");
    }
  } catch (err) {
    console.error("Error guardando consultas sugeridas:", err);
    alert("⚠️ Error al guardar consultas sugeridas: " + err.message);
  }
}

window.editarConsulta = async function(id) {
  if (hayCasoCerrado()) {
    alert("⚠️ No se puede editar una sesión cuando el caso está cerrado");
    return;
  }

  try {
    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Consulta no encontrada");

    const consulta = await res.json();

    $('#motivo_consulta').val(consulta.motivo_consulta).trigger('change');
    $('#motivo_consulta').prop('disabled', false);
    document.getElementById("modalidad").value = consulta.modalidad;
    document.getElementById("fecha").value = consulta.fecha.split('T')[0];
    document.getElementById("columna1").value = consulta.columna1 || "";
    document.getElementById("estado").value = consulta.estado;

    const esConfidencial = consulta.observaciones_confidenciales || false;
    document.getElementById("observaciones_confidenciales").value = esConfidencial.toString();
    
    const btnCandado = document.getElementById("btnCandado");
    const candadoIcon = document.getElementById("candadoIcon");
    const candadoTexto = document.getElementById("candadoTexto");
    const observacionesInfo = document.getElementById("observacionesInfo");
    
    if (esConfidencial) {
      btnCandado.classList.add("confidencial");
      candadoIcon.textContent = "🔒";
      candadoTexto.textContent = "Confidencial (No visible)";
      observacionesInfo.innerHTML = '🔒 Estas observaciones <strong>NO se mostrarán</strong> en el informe del trabajador';
      observacionesInfo.classList.add("confidencial");
    } else {
      btnCandado.classList.remove("confidencial");
      candadoIcon.textContent = "🔓";
      candadoTexto.textContent = "Visible en informe";
      observacionesInfo.innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
      observacionesInfo.classList.remove("confidencial");
    }

    const consultaEnHistorial = consultasDelCliente.find(c => c.id === id);
    const esPrimeraSesion = consultaEnHistorial && consultaEnHistorial.numeroSesion === 1;
    
    const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
    const consultasSugeridasInput = document.getElementById("consultas_sugeridas");
    
    if (esPrimeraSesion) {
      consultasSugeridasGroup.style.display = "block";
      consultasSugeridasInput.required = true;
      
      if (clienteActual && clienteActual.consultas_sugeridas) {
        consultasSugeridasInput.value = clienteActual.consultas_sugeridas;
      }
    } else {
      consultasSugeridasGroup.style.display = "none";
      consultasSugeridasInput.required = false;
      consultasSugeridasInput.value = "";
    }

    toggleFechaCierreField();
    editandoConsultaId = id;
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Actualizar Consulta";
    document.querySelector(".consulta-section").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error("Error cargando consulta:", err);
    alert("❌ Error al cargar consulta para editar");
  }
};

window.eliminarConsulta = async function(id) {
  if (hayCasoCerrado()) {
    alert("⚠️ No se puede eliminar una sesión cuando el caso está cerrado");
    return;
  }

  // ✅ VALIDACIÓN 2: Solo se puede eliminar la última sesión
  const consultasOrdenadas = [...consultasDelCliente].sort((a, b) =>
    new Date(a.fecha) - new Date(b.fecha) || a.id - b.id
  );
  const ultimaSesion = consultasOrdenadas[consultasOrdenadas.length - 1];

  if (ultimaSesion && ultimaSesion.id !== id) {
    const consultaAEliminar = consultasDelCliente.find(c => c.id === id);
    const numSesion = consultaAEliminar ? consultaAEliminar.numeroSesion : '?';
    alert(
      `⚠️ No puedes eliminar la Sesión ${numSesion} porque tiene sesiones posteriores.\n\n` +
      `Para eliminar esta sesión primero debes eliminar desde la última sesión hacia atrás.`
    );
    return;
  }

  if (!confirm("¿Estás seguro de eliminar esta consulta?")) return;

  try {
    const consultaAEliminar = consultasDelCliente.find(c => c.id === id);
    const esPrimeraSesion = consultaAEliminar && consultaAEliminar.numeroSesion === 1;

    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Error al eliminar consulta");

    if (esPrimeraSesion) {
      const clienteId = getClienteIdFromURL();
      await limpiarConsultasSugeridas(clienteId);
    }

    alert("✅ Consulta eliminada correctamente");

    const clienteId = getClienteIdFromURL();
    loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error eliminando consulta:", err);
    alert("❌ Error al eliminar consulta");
  }
};

async function limpiarConsultasSugeridas(clienteId) {
  try {
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    
    if (!resCliente.ok) throw new Error("Error al obtener datos del cliente");
    
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
      consultas_sugeridas: null,
      // ✅ FIX: campos requeridos por el backend para Familiar Trabajador / SVE
      cedula_trabajador: clienteData.cedula_trabajador || null,
      nombre_trabajador: clienteData.nombre_trabajador || null,
      sexo: clienteData.sexo || null,
      cargo: clienteData.cargo || null
    };
    
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    if (!resUpdate.ok) throw new Error("Error al limpiar consultas sugeridas");
    
  } catch (err) {
    console.error("Error limpiando consultas sugeridas:", err);
  }
}

window.reabrirCaso = async function() {
  if (!confirm("¿Estás seguro de reabrir el caso? Todas las sesiones volverán a estar disponibles para editar.")) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    const promises = consultasDelCliente.map(consulta => {
      if (consulta.estado === 'Cerrado') {
        return fetch(`${CONSULTAS_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...consulta,
            estado: 'Abierto',
            cliente_id: clienteId
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
        fecha_cierre: null,
        recomendaciones_finales: clienteData.recomendaciones_finales,
        consultas_sugeridas: clienteData.consultas_sugeridas,
        // ✅ FIX: campos requeridos por el backend para Familiar Trabajador / SVE
        cedula_trabajador: clienteData.cedula_trabajador || null,
        nombre_trabajador: clienteData.nombre_trabajador || null,
        sexo: clienteData.sexo || null,
        cargo: clienteData.cargo || null
      };
      
      await fetch(`${API_URL}/${clienteId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(clienteActualizado)
      });
    }

    alert("✅ Caso reabierto correctamente. Todas las sesiones están disponibles nuevamente.\n\n💡 Las recomendaciones finales se han conservado y podrás editarlas al cerrar el caso nuevamente.");
    await loadClientData();

  } catch (err) {
    console.error("Error reabriendo caso:", err);
    alert("❌ Error al reabrir el caso");
  }
};

document.getElementById("btnBack")?.addEventListener("click", () => {
  window.location.href = "clientes.html";
});

document.getElementById("btnRefreshHistorial")?.addEventListener("click", () => {
  const clienteId = getClienteIdFromURL();
  loadHistorialConsultas(clienteId);
});

document.getElementById("formConsulta")?.addEventListener("reset", () => {
  editandoConsultaId = null;
  document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";
  document.getElementById("fechaCierreContainer").classList.remove("show");
  
  const recomendacionesActuales = document.getElementById("recomendaciones_finales").value;
  
  setTimeout(() => {
    configurarCampoMotivo();
    if (recomendacionesActuales) {
      document.getElementById("recomendaciones_finales").value = recomendacionesActuales;
    }
  }, 100);
});

$(document).ready(function() {
  $('#motivo_consulta').select2({
    theme: 'default',
    language: 'es',
    placeholder: 'Seleccione un motivo de consulta',
    allowClear: true,
    width: '100%'
  });
});

// ⭐ NUEVA FUNCIÓN: Actualizar botón Dashboard en consulta.html según modalidad
function actualizarBotonDashboardConsulta() {
  const modalidad = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';
  
  // Buscar el botón de dashboard en la página
  const btnDashboard = document.querySelector('.btn-dashboard');
  
  if (!btnDashboard) {
    console.warn('⚠️ No se encontró el botón dashboard');
    return;
  }
  
  // Configurar el botón según la modalidad
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    // 🟢 Botón VERDE para SVE
    btnDashboard.innerHTML = '📊 Dashboard SVE';
    btnDashboard.style.background = 'linear-gradient(135deg, #56ab2f, #a8e063)';
    btnDashboard.style.boxShadow = '0 4px 15px rgba(86, 171, 47, 0.3)';
    btnDashboard.title = 'Ver Dashboard del Sistema de Vigilancia Epidemiológica';
    
    // Actualizar el evento onclick
    btnDashboard.onclick = () => {
      window.location.href = 'dashboardSVE.html';
    };
    
    console.log('✅ Botón Dashboard actualizado a SVE (Verde)');
    
  } else {
    // 🟣 Botón MORADO para Orientación Psicosocial
    btnDashboard.innerHTML = '📊 Dashboard';
    btnDashboard.style.background = 'linear-gradient(135deg, #9b59b6, #8e44ad)';
    btnDashboard.style.boxShadow = '0 4px 15px rgba(155, 89, 182, 0.3)';
    btnDashboard.title = 'Ver Dashboard de Orientación Psicosocial';
    
    // Actualizar el evento onclick
    btnDashboard.onclick = () => {
      window.location.href = 'dashboard.html';
    };
    
    console.log('✅ Botón Dashboard actualizado a Orientación Psicosocial (Morado)');
  }
}

// ============================================
// MODIFICAR EL DOMContentLoaded EXISTENTE
// Buscar tu DOMContentLoaded en consulta.js y agregar la llamada
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadClientData();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const fechaHoy = `${year}-${month}-${day}`;
  
  document.getElementById("fecha").value = fechaHoy;
  
  // ⭐ Inicializar SVE
  inicializarSVE();
  
  // ⭐ NUEVO: Actualizar botón de Dashboard según modalidad
  actualizarBotonDashboardConsulta();
  
  // ⭐ NUEVO: Mostrar/ocultar secciones según modalidad
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  const historialSection = document.querySelector('.historial-section');
  
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    // Ocultar completamente el historial de consultas en SVE
    if (historialSection) {
      historialSection.remove(); // ⭐ ELIMINAR del DOM, no solo ocultar
    }
  }
});

// ============================================
// TAMBIÉN puedes actualizar el botón cuando cambie la modalidad
// Si tienes alguna función que detecte cambios de modalidad
// ============================================

// Ejemplo: Si detectas cambio de modalidad desde localStorage
window.addEventListener('storage', (e) => {
  if (e.key === 'modalidadSeleccionada') {
    actualizarBotonDashboardConsulta();
  }
});


document.addEventListener("DOMContentLoaded", () => {
  loadClientData();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const fechaHoy = `${year}-${month}-${day}`;
  
  document.getElementById("fecha").value = fechaHoy;
  
  // ⭐ Inicializar SVE
  inicializarSVE();
  
  // ⭐ NUEVO: Mostrar/ocultar secciones según modalidad
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  const historialSection = document.querySelector('.historial-section');
  
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    // Ocultar completamente el historial de consultas en SVE
    if (historialSection) {
      historialSection.remove(); // ⭐ ELIMINAR del DOM, no solo ocultar
    }
  }
});


// ============================================
// FIN DE LA PARTE 1: ORIENTACIÓN PSICOSOCIAL
// ============================================

// ============================================
// PARTE 2: SISTEMA DE VIGILANCIA EPIDEMIOLÓGICA (SVE)
// Integrado completamente con el BACKEND
// ============================================

// URLs de la API para SVE
const MESA_TRABAJO_SVE_API_URL = window.API_CONFIG.ENDPOINTS.MESA_TRABAJO_SVE;
const CONSULTAS_SVE_API_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

// Variables globales para SVE
let mesaTrabajoRegistrada = false;
let mesaTrabajoData = null;
let consultasSVE = [];
let editandoMesaTrabajo = false;
let editandoConsultaSVE = null;

// ============================================
// INICIALIZACIÓN SVE
// ============================================
function inicializarSVE() {
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    console.log('✅ Inicializando Sistema de Vigilancia Epidemiológica');
    
    // ⭐ NUEVO: Eliminar completamente la sección de historial de consultas normales
    const historialSection = document.querySelector('.historial-section');
    if (historialSection) {
      historialSection.remove(); // Eliminar del DOM
    }
    
    // Cargar datos desde el backend
    cargarDatosSVE();
    
    // Eventos del Formulario 1: Mesa de Trabajo
    const formMesaTrabajo = document.getElementById('formMesaTrabajo');
    if (formMesaTrabajo) {
      formMesaTrabajo.addEventListener('submit', registrarMesaTrabajo);
    }
    
    // Eventos del Formulario 2: Consulta SVE
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
    
    // Fecha por defecto en consulta
    const fechaConsultaSVE = document.getElementById('fecha_consulta_sve');
    if (fechaConsultaSVE) {
      fechaConsultaSVE.value = getFechaLocalHoy(); // ⭐ Usa hora local, no UTC
    }
  }
}
// ============================================
// CARGAR DATOS SVE DESDE BACKEND
// ============================================
async function cargarDatosSVE() {
  const clienteId = getClienteIdFromURL();
  if (!clienteId) return;
  
  try {
    // 1. Cargar Mesa de Trabajo desde el backend
    const resMesa = await fetch(`${MESA_TRABAJO_SVE_API_URL}/cliente/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (resMesa.ok) {
      mesaTrabajoData = await resMesa.json();
      mesaTrabajoRegistrada = true;
      
      // Cargar datos en el formulario
      document.getElementById('criterio_inclusion').value = mesaTrabajoData.criterio_inclusion;
      document.getElementById('diagnostico').value = mesaTrabajoData.diagnostico;
      document.getElementById('codigo_diagnostico').value = mesaTrabajoData.codigo_diagnostico;
      
      mostrarMesaTrabajoRegistrada();
      deshabilitarFormularioMesaTrabajo();
      desbloquearFormularioConsulta();
    } else if (resMesa.status === 404) {
      // No hay mesa de trabajo registrada
      mesaTrabajoRegistrada = false;
      mesaTrabajoData = null;
      console.log('ℹ️ No hay Mesa de Trabajo registrada para este cliente');
    }
    
    // 2. Cargar Consultas SVE desde el backend
    const resConsultas = await fetch(`${CONSULTAS_SVE_API_URL}/cliente/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (resConsultas.ok) {
      let consultasTemp = await resConsultas.json();
      
      // ⭐ IMPORTANTE: Ordenar las consultas por fecha (más antigua primero) y luego por ID
      consultasSVE = consultasTemp.sort((a, b) => {
        const diffFecha = new Date(a.fecha) - new Date(b.fecha);
        if (diffFecha !== 0) return diffFecha;
        return a.id - b.id; // Si tienen la misma fecha, ordenar por ID
      });
      
      console.log('✅ Consultas SVE cargadas y ordenadas:', consultasSVE);
      mostrarConsultasSVE();
    }
    
    // 3. Mostrar historial si hay datos
    if (mesaTrabajoRegistrada || consultasSVE.length > 0) {
      document.getElementById('historialSVE').style.display = 'block';
      
      // ⭐ NUEVO: Mostrar botón de informe si hay datos completos
      if (mesaTrabajoRegistrada && consultasSVE.length > 0) {
        // Esperar a que se cargue informeSVE.js
        if (typeof window.mostrarBotonInformeSVE === 'function') {
          window.mostrarBotonInformeSVE();
        } else {
          // Si no está cargado, intentar de nuevo después de un momento
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

// ⭐ TAMBIÉN MOSTRAR EL BOTÓN DESPUÉS DE REGISTRAR UNA CONSULTA
// Agregar al final de la función registrarConsultaSVE():

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
  
  // ... (código existente de registro) ...
  
  try {
    // ... (código de registro existente) ...
    
    // ⭐ NUEVO: Al finalizar exitosamente, recargar datos y mostrar botón
    await cargarDatosSVE();
    
    // Mostrar botón de informe si ahora hay datos completos
    if (mesaTrabajoRegistrada && consultasSVE.length > 0) {
      if (typeof window.mostrarBotonInformeSVE === 'function') {
        window.mostrarBotonInformeSVE();
      }
    }
    
  } catch (err) {
    console.error('❌ Error registrando consulta SVE:', err);
    alert('❌ ' + err.message);
  }
}

// ============================================
// REGISTRAR MESA DE TRABAJO (Formulario 1)
// ============================================
async function registrarMesaTrabajo(e) {
  e.preventDefault();
  
  const clienteId = getClienteIdFromURL();
  if (!clienteId) {
    alert('⚠️ Error: No se pudo identificar el cliente');
    return;
  }
  
  // Capturar datos del formulario
  const datos = {
    cliente_id: parseInt(clienteId),
    criterio_inclusion: document.getElementById('criterio_inclusion').value,
    diagnostico: document.getElementById('diagnostico').value.trim(),
    codigo_diagnostico: document.getElementById('codigo_diagnostico').value.trim()
  };
  
  try {
    let response;
    
    if (editandoMesaTrabajo && mesaTrabajoData) {
      // Actualizar mesa de trabajo existente
      response = await fetch(`${MESA_TRABAJO_SVE_API_URL}/${mesaTrabajoData.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(datos)
      });
    } else {
      // Crear nueva mesa de trabajo
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
    
    alert(editandoMesaTrabajo ? '✅ Mesa de Trabajo actualizada correctamente' : '✅ Mesa de Trabajo registrada correctamente');
    
    // Deshabilitar formulario 1
    deshabilitarFormularioMesaTrabajo();
    
    // Mostrar en historial
    mostrarMesaTrabajoRegistrada();
    
    // Desbloquear formulario 2
    desbloquearFormularioConsulta();
    
    // Mostrar historial
    document.getElementById('historialSVE').style.display = 'block';
    
    // Scroll al formulario de consulta
    document.getElementById('contenedorConsulta').scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    console.error('❌ Error registrando mesa de trabajo:', err);
    alert('❌ ' + err.message);
  }
}

// ============================================
// DESHABILITAR FORMULARIO MESA DE TRABAJO
// ============================================
function deshabilitarFormularioMesaTrabajo() {
  const form = document.getElementById('formMesaTrabajo');
  const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="reset"]');
  
  inputs.forEach(input => {
    input.disabled = true;
  });
  
  // Cambiar apariencia del contenedor
  const contenedor = document.getElementById('contenedorMesaTrabajo');
  contenedor.style.opacity = '0.8';
  contenedor.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
  
  // Cambiar texto del botón
  const btnSubmit = document.getElementById('btnRegistrarMesaTrabajo');
  btnSubmit.innerHTML = '✅ Mesa de Trabajo Registrada';
}

// ============================================
// HABILITAR EDICIÓN MESA DE TRABAJO
// ============================================
function habilitarEdicionMesaTrabajo() {
  if (!confirm('¿Desea editar la Mesa de Trabajo registrada?')) {
    return;
  }
  
  editandoMesaTrabajo = true;
  
  const form = document.getElementById('formMesaTrabajo');
  const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="reset"]');
  
  inputs.forEach(input => {
    input.disabled = false;
  });
  
  // Restaurar apariencia del contenedor
  const contenedor = document.getElementById('contenedorMesaTrabajo');
  contenedor.style.opacity = '1';
  contenedor.style.background = 'white';
  
  // Cambiar texto del botón
  const btnSubmit = document.getElementById('btnRegistrarMesaTrabajo');
  btnSubmit.innerHTML = '💾 Actualizar Mesa de Trabajo';
  
  // Scroll al formulario
  contenedor.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// MOSTRAR MESA DE TRABAJO EN HISTORIAL
// ============================================
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

// ============================================
// DESBLOQUEAR FORMULARIO DE CONSULTA
// ============================================
function desbloquearFormularioConsulta() {
  const contenedor = document.getElementById('contenedorConsulta');
  const form = document.getElementById('formConsultaVigilancia');
  const inputs = form.querySelectorAll('input, select, textarea, button');
  const bloqueoBadge = document.getElementById('bloqueoConsulta');
  
  contenedor.classList.remove('bloqueado');
  bloqueoBadge.style.display = 'none';
  
  inputs.forEach(input => {
    input.disabled = false;
  });
}

// ============================================
// REGISTRAR CONSULTA SVE (Formulario 2)
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
  
  // Capturar datos de la consulta
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
    estado: document.getElementById('estado_sve').value
  };
  
  console.log('📤 Enviando consulta SVE:', consulta);
  
  try {
    let response;
    
    if (editandoConsultaSVE) {
      // Actualizar consulta existente
      console.log('🔄 Actualizando consulta SVE ID:', editandoConsultaSVE);
      response = await fetch(`${CONSULTAS_SVE_API_URL}/${editandoConsultaSVE}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(consulta)
      });
    } else {
      // Crear nueva consulta
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
    
    alert(editandoConsultaSVE ? '✅ Consulta SVE actualizada correctamente' : '✅ Consulta SVE registrada correctamente');
    
    // Limpiar formulario
    document.getElementById('formConsultaVigilancia').reset();
    const today = getFechaLocalHoy(); // ⭐ Usa hora local, no UTC
    document.getElementById('fecha_consulta_sve').value = today;
    
    editandoConsultaSVE = null;
    document.getElementById('btnRegistrarConsultaSVE').innerHTML = '💾 Registrar Consulta';
    
    // ⭐ CRÍTICO: Recargar TODOS los datos del backend para asegurar sincronización
    console.log('🔄 Recargando datos del backend...');
    await cargarDatosSVE();
    console.log('✅ Datos recargados correctamente');
    
  } catch (err) {
    console.error('❌ Error registrando consulta SVE:', err);
    alert('❌ ' + err.message);
  }
}

// ============================================
// MOSTRAR CONSULTAS SVE EN HISTORIAL
// ============================================
function mostrarConsultasSVE() {
  const contenedor = document.getElementById('consultasSVERegistradas');
  
  if (consultasSVE.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No hay consultas registradas</p>';
    return;
  }
  
  // ⭐ ASEGURAR que las consultas estén ordenadas correctamente antes de mostrar
  const consultasOrdenadas = [...consultasSVE].sort((a, b) => {
    const diffFecha = new Date(a.fecha) - new Date(b.fecha);
    if (diffFecha !== 0) return diffFecha;
    return a.id - b.id;
  });
  
  console.log('📋 Mostrando consultas ordenadas:', consultasOrdenadas);
  
  const html = consultasOrdenadas.map((consulta, index) => `
    <div class="consulta-sve-card">
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
        <button class="btn-edit-consulta-sve" onclick="editarConsultaSVE(${consulta.id})">
          ✏️ Editar
        </button>
        <button class="btn-delete-consulta-sve" onclick="eliminarConsultaSVE(${consulta.id})">
          🗑️ Eliminar
        </button>
      </div>
    </div>
  `).join('');
  
  contenedor.innerHTML = html;
}

// ============================================
// EDITAR CONSULTA SVE
// ============================================
window.editarConsultaSVE = async function(id) {
  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error("Consulta SVE no encontrada");
    }
    
    const consulta = await response.json();
    
    // Cargar datos en el formulario
    document.getElementById('fecha_consulta_sve').value = consulta.fecha.split('T')[0];
    document.getElementById('modalidad_sve').value = consulta.modalidad;
    document.getElementById('motivo_evaluacion_sve').value = consulta.motivo_evaluacion;
    document.getElementById('ajuste_funciones_sve').value = consulta.ajuste_funciones;
    document.getElementById('recomendaciones_medicas_sve').value = consulta.recomendaciones_medicas;
    document.getElementById('recomendaciones_trabajador_sve').value = consulta.recomendaciones_trabajador;
    document.getElementById('recomendaciones_empresa_sve').value = consulta.recomendaciones_empresa;
    document.getElementById('observaciones_consulta_sve').value = consulta.observaciones || '';
    document.getElementById('estado_sve').value = consulta.estado;
    
    editandoConsultaSVE = id;
    document.getElementById('btnRegistrarConsultaSVE').innerHTML = '💾 Actualizar Consulta';
    
    // Scroll al formulario
    document.getElementById('contenedorConsulta').scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    console.error('❌ Error cargando consulta SVE:', err);
    alert('❌ Error al cargar consulta para editar');
  }
};

// ============================================
// ELIMINAR CONSULTA SVE
// ============================================
window.eliminarConsultaSVE = async function(id) {
  if (!confirm('¿Estás seguro de eliminar esta consulta SVE?')) {
    return;
  }
  
  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error("Error al eliminar consulta SVE");
    }
    
    alert('✅ Consulta SVE eliminada correctamente');
    
    // Recargar historial
    await cargarDatosSVE();
    
  } catch (err) {
    console.error('❌ Error eliminando consulta SVE:', err);
    alert('❌ Error al eliminar consulta SVE');
  }
};

// FUNCIONALIDAD DE CIERRE Y REAPERTURA SVE
// ============================================

// Variable global para controlar si hay caso SVE cerrado
let casoSVECerrado = false;

// ⭐ Listener para el cambio de estado en formulario SVE
document.addEventListener('DOMContentLoaded', () => {
  const estadoSVE = document.getElementById('estado_sve');
  if (estadoSVE) {
    estadoSVE.addEventListener('change', toggleFechaCierreSVE);
  }
});

// ⭐ Mostrar/Ocultar campo de fecha de cierre SVE según el estado
function toggleFechaCierreSVE() {
  const estadoSelect = document.getElementById("estado_sve");
  const fechaCierreSVEContainer = document.getElementById("fechaCierreSVEContainer");
  const fechaCierreSVEInput = document.getElementById("fecha_cierre_sve");
  const recomendacionesSVEInput = document.getElementById("recomendaciones_finales_sve");
  
  if (estadoSelect.value === "Cerrado") {
    fechaCierreSVEContainer.classList.add("show");
    fechaCierreSVEInput.required = true;
    recomendacionesSVEInput.required = true;
    
    // Si no tiene valor, establecer la fecha de hoy por defecto
    if (!fechaCierreSVEInput.value) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      fechaCierreSVEInput.value = `${year}-${month}-${day}`;
    }
    
    // Cargar recomendaciones existentes si las hay
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

// ⭐ MODIFICAR la función registrarConsultaSVE para incluir el cierre de caso
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
  
  // Capturar datos de la consulta
  const estado = document.getElementById('estado_sve').value;
  const fecha_cierre_sve = document.getElementById('fecha_cierre_sve').value;
  const recomendaciones_finales_sve = document.getElementById('recomendaciones_finales_sve').value.trim();
  
  // 🔍 DEBUG
  console.log('🔍 DEBUG - Estado:', estado);
  console.log('🔍 DEBUG - Fecha cierre SVE:', fecha_cierre_sve);
  console.log('🔍 DEBUG - Recomendaciones:', recomendaciones_finales_sve);
  
  // ✅ VALIDAR campos de cierre si el estado es "Cerrado"
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
    
    // ✅ CRÍTICO: Si el estado es "Cerrado", ACTUALIZAR el cliente
    if (estado === 'Cerrado') {
      console.log('🔒 ENTRANDO A CIERRE DE CASO...');
      console.log('🔍 Cliente ID:', clienteId);
      console.log('🔍 Fecha cierre:', fecha_cierre_sve);
      console.log('🔍 Recomendaciones:', recomendaciones_finales_sve);
      
      const exitoCierre = await cerrarCasoSVE(clienteId, fecha_cierre_sve, recomendaciones_finales_sve);
      
      if (!exitoCierre) {
        alert('⚠️ La consulta se guardó pero hubo un error al cerrar el caso');
        return;
      }
      
      alert('✅ Consulta SVE registrada y caso cerrado correctamente');
    } else {
      console.log('ℹ️ Estado no es Cerrado, no se ejecuta cierre');
      alert(editandoConsultaSVE ? '✅ Consulta SVE actualizada correctamente' : '✅ Consulta SVE registrada correctamente');
    }
    
    // Limpiar formulario
    document.getElementById('formConsultaVigilancia').reset();
    const today = getFechaLocalHoy(); // ⭐ Usa hora local, no UTC
    document.getElementById('fecha_consulta_sve').value = today;
    
    editandoConsultaSVE = null;
    document.getElementById('btnRegistrarConsultaSVE').innerHTML = '💾 Registrar Consulta';
    
    // Recargar datos
    console.log('🔄 Recargando datos del backend...');
    await loadClientData();
    await cargarDatosSVE();
    console.log('✅ Datos recargados correctamente');
    
  } catch (err) {
    console.error('❌ Error registrando consulta SVE:', err);
    alert('❌ ' + err.message);
  }
}

// ✅ FUNCIÓN: Cerrar caso SVE
async function cerrarCasoSVE(clienteId, fechaCierre, recomendacionesFinales) {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🔒 INICIANDO CIERRE DE CASO SVE');
    console.log('═══════════════════════════════════════');
    console.log('📋 Cliente ID:', clienteId);
    console.log('📅 Fecha cierre:', fechaCierre);
    console.log('📝 Recomendaciones:', recomendacionesFinales);
    
    // 1. Obtener datos actuales del cliente
    console.log('🔍 Obteniendo datos del cliente...');
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    
    if (!resCliente.ok) {
      throw new Error("Error al obtener datos del cliente");
    }
    
    const clienteData = await resCliente.json();
    console.log('✅ Datos del cliente obtenidos:', clienteData);
    
    // 2. Preparar objeto actualizado
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
      // ✅ FIX: incluir sexo y cargo para que el backend no los rechace en modalidad SVE
      sexo: clienteData.sexo || null,
      cargo: clienteData.cargo || null
    };
    
    console.log('📤 Objeto a enviar:', JSON.stringify(clienteActualizado, null, 2));
    
    // 3. Actualizar cliente
    console.log('💾 Guardando actualización del cliente...');
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    console.log('📡 Response status:', resUpdate.status);
    
    if (!resUpdate.ok) {
      const errorData = await resUpdate.json();
      console.error('❌ Error del servidor:', errorData);
      throw new Error(errorData.message || "Error al actualizar el cliente");
    }
    
    const clienteActualizadoResponse = await resUpdate.json();
    console.log('✅ Cliente actualizado - Respuesta del servidor:', clienteActualizadoResponse);
    console.log('🔍 fecha_cierre_sve en respuesta:', clienteActualizadoResponse.fecha_cierre_sve);

    // 4. Cerrar todas las consultas SVE abiertas
    console.log('🔄 Cerrando todas las consultas SVE abiertas...');
    const promisesCerrar = consultasSVE.map(consulta => {
      if (consulta.estado !== 'Cerrado') {
        console.log('  → Cerrando consulta ID:', consulta.id);
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
    console.log('✅ Todas las consultas cerradas');
    console.log('═══════════════════════════════════════');

    return true;
  } catch (err) {
    console.error("═══════════════════════════════════════");
    console.error("❌ ERROR CERRANDO CASO SVE");
    console.error("═══════════════════════════════════════");
    console.error(err);
    console.error("═══════════════════════════════════════");
    alert("❌ Error al cerrar el caso SVE: " + err.message);
    return false;
  }
}

// ⭐ FUNCIÓN: Verificar si hay caso SVE cerrado
function hayCasoSVECerrado() {
  return consultasSVE.some(c => c.estado === 'Cerrado');
}

// ⭐ MODIFICAR la función mostrarConsultasSVE para deshabilitar edición/eliminación si está cerrado
function mostrarConsultasSVE() {
  const contenedor = document.getElementById('consultasSVERegistradas');
  
  if (consultasSVE.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No hay consultas registradas</p>';
    return;
  }
  
  // Verificar si hay caso cerrado
  const casoCerrado = hayCasoSVECerrado();
  casoSVECerrado = casoCerrado;
  
  // Asegurar que las consultas estén ordenadas correctamente
  const consultasOrdenadas = [...consultasSVE].sort((a, b) => {
    const diffFecha = new Date(a.fecha) - new Date(b.fecha);
    if (diffFecha !== 0) return diffFecha;
    return a.id - b.id;
  });
  
  console.log('📋 Mostrando consultas ordenadas:', consultasOrdenadas);
  
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
  
  // Agregar recomendaciones finales y botones si el caso está cerrado
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

// ⭐ NUEVA FUNCIÓN: Reabrir caso SVE
window.reabrirCasoSVE = async function() {
  if (!confirm("¿Estás seguro de reabrir el caso SVE? Todas las consultas volverán a estar disponibles para editar.")) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    // 1. Reabrir todas las consultas SVE
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

    // 2. Actualizar el cliente (limpiar fecha de cierre SVE, mantener recomendaciones)
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
        // ✅ FIX: incluir sexo y cargo para que el backend no los rechace en modalidad SVE
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
    
    // Recargar datos
    await loadClientData();
    await cargarDatosSVE();

  } catch (err) {
    console.error("❌ Error reabriendo caso SVE:", err);
    alert("❌ Error al reabrir el caso SVE");
  }
};

// ⭐ MODIFICAR editarConsultaSVE para prevenir edición si está cerrado
window.editarConsultaSVE = async function(id) {
  if (hayCasoSVECerrado()) {
    alert("⚠️ No se puede editar una consulta cuando el caso SVE está cerrado");
    return;
  }

  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error("Consulta SVE no encontrada");
    }
    
    const consulta = await response.json();
    
    // Cargar datos en el formulario
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
    
    // Scroll al formulario
    document.getElementById('contenedorConsulta').scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    console.error('❌ Error cargando consulta SVE:', err);
    alert('❌ Error al cargar consulta para editar');
  }
};

// ⭐ MODIFICAR eliminarConsultaSVE para prevenir eliminación si está cerrado
window.eliminarConsultaSVE = async function(id) {
  if (hayCasoSVECerrado()) {
    alert("⚠️ No se puede eliminar una consulta cuando el caso SVE está cerrado");
    return;
  }

  if (!confirm('¿Estás seguro de eliminar esta consulta SVE?')) {
    return;
  }
  
  try {
    const response = await fetch(`${CONSULTAS_SVE_API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error("Error al eliminar consulta SVE");
    }
    
    alert('✅ Consulta SVE eliminada correctamente');
    
    // Recargar historial
    await cargarDatosSVE();
    
  } catch (err) {
    console.error('❌ Error eliminando consulta SVE:', err);
    alert('❌ Error al eliminar consulta SVE');
  }
};

console.log('✅ Lógica de cierre y reapertura SVE cargada');

// ============================================
// FIN DE LA PARTE 2: SVE CON BACKEND INTEGRADO
// ============================================

// ============================================
// FUNCIONALIDAD DE ADJUNTAR DOCUMENTOS
// ============================================

// Variables globales para control de documentos
let documentosCliente = {
  consentimiento_informado: null,
  historia_clinica: null,
  documentos_adicionales: null
};

// Función para mostrar/ocultar la sección de documentos según modalidad
function toggleDocumentosSection() {
  const modalidad = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';
  const documentosSection = document.getElementById('documentosSection');
  
  if (modalidad === 'Orientación Psicosocial' && documentosSection) {
    documentosSection.style.display = 'block';
  } else if (documentosSection) {
    documentosSection.style.display = 'none';
  }
}

// Llamar la función cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  toggleDocumentosSection();
  cargarDocumentosExistentes();
});

// Función para manejar la selección de archivos
window.handleFileSelect = async function(tipo, input) {
  const file = input.files[0];
  
  if (!file) {
    return;
  }
  
  // Validar tipo de archivo
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    alert('⚠️ Solo se permiten archivos PDF o Word (.pdf, .doc, .docx)');
    input.value = '';
    return;
  }
  
  // Validar tamaño (10MB máximo)
  const maxSize = 10 * 1024 * 1024; // 10MB en bytes
  if (file.size > maxSize) {
    alert('⚠️ El archivo es demasiado grande. Tamaño máximo: 10MB');
    input.value = '';
    return;
  }
  
  // Confirmar antes de subir
  const confirmar = confirm(`¿Desea adjuntar el archivo "${file.name}"?`);
  if (!confirmar) {
    input.value = '';
    return;
  }
  
  // Mostrar indicador de carga
  const btn = document.querySelector(`button[onclick="document.getElementById('${tipo}File').click()"]`);
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Subiendo...';
  btn.disabled = true;
  
  try {
    await subirDocumento(tipo, file);
    mostrarDocumentoAdjuntado(tipo, file.name);
    alert(`✅ Documento "${file.name}" adjuntado correctamente`);
  } catch (err) {
    console.error('Error subiendo documento:', err);
    alert('❌ Error al adjuntar el documento. Por favor intente nuevamente.');
    input.value = '';
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// Función para subir documento al servidor
async function subirDocumento(tipo, file) {
  const clienteId = getClienteIdFromURL();
  
  if (!clienteId) {
    throw new Error('No se encontró el ID del cliente');
  }
  
  const formData = new FormData();
  formData.append('documento', file);
  formData.append('tipo', tipo);
  formData.append('cliente_id', clienteId);
  
  const response = await fetch(`${API_URL}/${clienteId}/documentos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Error al subir documento');
  }
  
  const result = await response.json();
  
  // Actualizar la variable global con la ruta del documento
  const campoDocumento = getCampoDocumento(tipo);
  documentosCliente[campoDocumento] = result[campoDocumento];
  
  return result;
}

// Función para obtener el nombre del campo según el tipo
function getCampoDocumento(tipo) {
  const campos = {
    'consentimiento': 'consentimiento_informado',
    'historia': 'historia_clinica',
    'adicionales': 'documentos_adicionales'
  };
  return campos[tipo];
}

// Función para mostrar documento adjuntado en la interfaz
function mostrarDocumentoAdjuntado(tipo, nombreArchivo) {
  // Mostrar info del documento
  const infoDiv = document.getElementById(`${tipo}Info`);
  const nombreSpan = document.getElementById(`${tipo}Nombre`);
  
  if (infoDiv && nombreSpan) {
    nombreSpan.textContent = nombreArchivo;
    infoDiv.style.display = 'flex';
  }
  
  // Mostrar botones de ver y eliminar
  const btnVer = document.getElementById(`btnVer${capitalizar(tipo)}`);
  const btnEliminar = document.getElementById(`btnEliminar${capitalizar(tipo)}`);
  
  if (btnVer) btnVer.style.display = 'flex';
  if (btnEliminar) btnEliminar.style.display = 'flex';
  
  // Cambiar la card para indicar que hay documento
  const card = document.querySelector(`#${tipo}File`).closest('.documento-card');
  if (card) {
    card.classList.add(tipo);
  }
}

// Función para ver documento
window.verDocumento = async function(tipo) {
  const campoDocumento = getCampoDocumento(tipo);
  const rutaDocumento = documentosCliente[campoDocumento];
  
  if (!rutaDocumento) {
    alert('⚠️ No se encontró el documento');
    return;
  }
  
  // ⭐ CORRECCIÓN: Construir URL sin el /api
  // La ruta ya viene como "uploads/consultas/archivo.pdf"
  // Solo necesitamos el dominio base sin /api
  const baseUrl = window.API_CONFIG.BASE_URL.replace('/api', '');
  const urlDocumento = `${baseUrl}/${rutaDocumento}`;
  
  console.log('📄 Abriendo documento:', urlDocumento);
  
  // Abrir en nueva pestaña
  window.open(urlDocumento, '_blank');
};

// Función para eliminar documento
window.eliminarDocumento = async function(tipo) {
  const confirmar = confirm('¿Está seguro de eliminar este documento?');
  
  if (!confirmar) {
    return;
  }
  
  const clienteId = getClienteIdFromURL();
  const campoDocumento = getCampoDocumento(tipo);
  
  if (!clienteId) {
    alert('⚠️ No se encontró el ID del cliente');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/${clienteId}/documentos/${tipo}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Error al eliminar documento');
    }
    
    // Limpiar la interfaz
    const infoDiv = document.getElementById(`${tipo}Info`);
    const btnVer = document.getElementById(`btnVer${capitalizar(tipo)}`);
    const btnEliminar = document.getElementById(`btnEliminar${capitalizar(tipo)}`);
    const fileInput = document.getElementById(`${tipo}File`);
    
    if (infoDiv) infoDiv.style.display = 'none';
    if (btnVer) btnVer.style.display = 'none';
    if (btnEliminar) btnEliminar.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    // Actualizar variable global
    documentosCliente[campoDocumento] = null;
    
    alert('✅ Documento eliminado correctamente');
    
  } catch (err) {
    console.error('Error eliminando documento:', err);
    alert('❌ Error al eliminar el documento');
  }
};

// Función para cargar documentos existentes
async function cargarDocumentosExistentes() {
  const clienteId = getClienteIdFromURL();
  
  if (!clienteId) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/${clienteId}/documentos`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Error al cargar documentos');
    }
    
    const data = await response.json();
    
    // Actualizar variables globales
    documentosCliente.consentimiento_informado = data.consentimiento_informado;
    documentosCliente.historia_clinica = data.historia_clinica;
    documentosCliente.documentos_adicionales = data.documentos_adicionales;
    
    // Mostrar documentos en la interfaz
    if (data.consentimiento_informado) {
      const nombreArchivo = extraerNombreArchivo(data.consentimiento_informado);
      mostrarDocumentoAdjuntado('consentimiento', nombreArchivo);
    }
    
    if (data.historia_clinica) {
      const nombreArchivo = extraerNombreArchivo(data.historia_clinica);
      mostrarDocumentoAdjuntado('historia', nombreArchivo);
    }
    
    if (data.documentos_adicionales) {
      const nombreArchivo = extraerNombreArchivo(data.documentos_adicionales);
      mostrarDocumentoAdjuntado('adicionales', nombreArchivo);
    }
    
  } catch (err) {
    console.error('Error cargando documentos existentes:', err);
  }
}

// Función para extraer nombre de archivo de la ruta
function extraerNombreArchivo(ruta) {
  if (!ruta) return '';
  const partes = ruta.split('/');
  return partes[partes.length - 1];
}

// Función auxiliar para capitalizar
function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

console.log('✅ Funcionalidad de documentos adjuntos cargada');