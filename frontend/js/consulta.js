// frontend/js/consulta.js 

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
    
    // Si no tiene valor, establecer la fecha de hoy por defecto
    if (!fechaCierreInput.value) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      fechaCierreInput.value = `${year}-${month}-${day}`;
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
    // ⭐ MODIFICADO: NO borrar las recomendaciones al cambiar a "Abierto"
    // recomendacionesInput.value = "";
  }
}

// Agregar listener al campo de estado
document.getElementById("estado")?.addEventListener("change", toggleFechaCierreField);

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
    
    // Cargar historial de consultas
    loadHistorialConsultas(clienteId);

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
    // Si hay subcontratista, mostrar el label y el badge
    labelSubcontratista.style.display = "inline";
    subcontratistaElement.style.display = "block";
    subcontratistaElement.innerHTML = `<span class="badge-subcontratista-consulta">${escapeHtml(nombreSubcontratista)}</span>`;
  } else {
    // Si no hay subcontratista, ocultar
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

  // ⭐ Mostrar consultas sugeridas si existe (sin importar si el caso está cerrado)
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
  
  // ⭐ NUEVO: Mostrar/ocultar campo de consultas sugeridas
  mostrarCampoConsultasSugeridas(numSesiones, casoCerrado);
}

// ⭐ NUEVO: Función para mostrar campo de consultas sugeridas solo en primera sesión
function mostrarCampoConsultasSugeridas(numSesiones, casoCerrado) {
  const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
  const consultasSugeridasInput = document.getElementById("consultas_sugeridas");
  
  // Solo mostrar en la primera sesión y si el caso no está cerrado
  if (numSesiones === 0 && !casoCerrado && !editandoConsultaId) {
    consultasSugeridasGroup.style.display = "block";
    consultasSugeridasInput.required = true;
    
    // Pre-cargar valor si ya existe en el cliente
    if (clienteActual && clienteActual.consultas_sugeridas) {
      consultasSugeridasInput.value = clienteActual.consultas_sugeridas;
    }
  } else {
    consultasSugeridasGroup.style.display = "none";
    consultasSugeridasInput.required = false;
    consultasSugeridasInput.value = "";
  }
}

// ⭐ CORREGIDO: Cerrar todas las consultas manteniendo el estado de confidencialidad individual
async function cerrarTodasLasConsultas(clienteId, fechaCierre, recomendacionesFinales) {
  try {
    console.log("🔄 Iniciando cierre de caso...");
    console.log("Cliente ID:", clienteId);
    console.log("Fecha de cierre:", fechaCierre);
    console.log("Recomendaciones:", recomendacionesFinales);
    
    // 1. Cerrar todas las consultas MANTENIENDO su estado individual de confidencialidad
    const promises = consultasDelCliente.map(consulta => {
      if (consulta.estado !== 'Cerrado') {
        console.log(`Cerrando consulta ${consulta.id}...`);
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
            observaciones_confidenciales: consulta.observaciones_confidenciales || false // ⭐ MANTENER el estado individual
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
    console.log("✅ Todas las consultas cerradas");

    // 2. Obtener datos actuales del cliente
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!resCliente.ok) {
      throw new Error("Error al obtener datos del cliente");
    }
    
    const clienteData = await resCliente.json();
    console.log("📋 Cliente actual antes de actualizar:", clienteData);
    
    // 3. Preparar datos actualizados CON fecha_cierre Y recomendaciones_finales
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
      consultas_sugeridas: clienteData.consultas_sugeridas
    };
    
    console.log("📝 Datos a enviar:", clienteActualizado);
    
    // 4. Actualizar el cliente con la fecha de cierre Y recomendaciones
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    if (!resUpdate.ok) {
      const errorData = await resUpdate.json();
      console.error("❌ Error actualizando cliente:", errorData);
      throw new Error(errorData.message || "Error al actualizar el cliente");
    }
    
    const clienteActualizadoRes = await resUpdate.json();
    console.log("✅ Cliente actualizado exitosamente:", clienteActualizadoRes);
    console.log("✅ Fecha de cierre guardada:", clienteActualizadoRes.fecha_cierre);
    console.log("✅ Recomendaciones guardadas:", clienteActualizadoRes.recomendaciones_finales);

    return true;
  } catch (err) {
    console.error("❌ Error cerrando caso:", err);
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
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Error al cargar historial");
    }

    const consultas = await res.json();
    
    consultasDelCliente = consultas ? JSON.parse(JSON.stringify(consultas)) : [];
    window.consultasDelCliente = consultasDelCliente;

    // ⭐ Asignar numeroSesion también al array original usado por editarConsulta()
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
      return;
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
  
  // ⭐ NUEVO: Mostrar recomendaciones finales si el caso está cerrado
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
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ⭐ ACTUALIZADO: Manejar envío del formulario con consultas_sugeridas
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
  const consultas_sugeridas = document.getElementById("consultas_sugeridas").value; // ⭐ NUEVO

  // Validaciones
  if (!motivo_consulta || !modalidad || !fecha || !estado) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
    return;
  }
  
  // ⭐ NUEVO: Validar consultas sugeridas en primera sesión
  if (consultasDelCliente.length === 0 && !editandoConsultaId && !consultas_sugeridas) {
    alert("⚠️ Por favor indica el número de consultas sugeridas para este trabajador");
    return;
  }

  // Validar que si el estado es "Cerrado", debe haber fecha de cierre Y recomendaciones
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

    // ⭐ CORREGIDO: Guardar consultas sugeridas en primera sesión (crear o editar)
    const esPrimeraSesionNueva = consultasDelCliente.length === 0 && !editandoConsultaId;
    
    let esPrimeraSesionEditando = false;
    if (editandoConsultaId) {
      const consultaEditada = consultasDelCliente.find(c => c.id === editandoConsultaId);
      esPrimeraSesionEditando = consultaEditada && consultaEditada.numeroSesion === 1;
    }
    
    console.log("💾 Primera sesión nueva:", esPrimeraSesionNueva);
    console.log("💾 Primera sesión editando:", esPrimeraSesionEditando);
    console.log("💾 Consultas sugeridas valor:", consultas_sugeridas);
    
    if ((esPrimeraSesionNueva || esPrimeraSesionEditando) && consultas_sugeridas) {
      await guardarConsultasSugeridas(clienteId, parseInt(consultas_sugeridas));
    }

    // Si el estado es "Cerrado", cerrar todas las consultas Y guardar recomendaciones
    if (estado === 'Cerrado') {
      await cerrarTodasLasConsultas(clienteId, fecha_cierre, recomendaciones_finales);
    }

    const mensaje = editandoConsultaId 
      ? "✅ Consulta actualizada correctamente"
      : "✅ Consulta registrada correctamente";
    
    alert(mensaje);

    // Limpiar formulario
    document.getElementById("formConsulta").reset();
    $('#motivo_consulta').val(null).trigger('change');
    editandoConsultaId = null;
    
    // Resetear el candado a estado abierto
    document.getElementById("observaciones_confidenciales").value = "false";
    document.getElementById("btnCandado").classList.remove("confidencial");
    document.getElementById("candadoIcon").textContent = "🔓";
    document.getElementById("candadoTexto").textContent = "Visible en informe";
    document.getElementById("observacionesInfo").innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
    document.getElementById("observacionesInfo").classList.remove("confidencial");
    
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";

    // Recargar datos del cliente
    await loadClientData();

  } catch (err) {
    console.error("Error guardando consulta:", err);
    alert("❌ " + err.message);
  }
});

// ⭐ NUEVO: Función para guardar consultas sugeridas en el cliente
async function guardarConsultasSugeridas(clienteId, consultas_sugeridas) {
  try {
    console.log("💾 Guardando consultas sugeridas:", consultas_sugeridas);
    
    // Obtener datos actuales del cliente
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!resCliente.ok) {
      throw new Error("Error al obtener datos del cliente");
    }
    
    const clienteData = await resCliente.json();
    console.log("📋 Cliente actual:", clienteData);
    
    // Actualizar solo las consultas sugeridas
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
      consultas_sugeridas: consultas_sugeridas
    };
    
    console.log("📤 Datos a enviar:", clienteActualizado);
    
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    if (!resUpdate.ok) {
      const errorData = await resUpdate.json();
      console.error("❌ Error del servidor:", errorData);
      throw new Error("Error al guardar consultas sugeridas");
    }
    
    const resultado = await resUpdate.json();
    console.log("✅ Consultas sugeridas guardadas:", resultado);
  } catch (err) {
    console.error("❌ Error guardando consultas sugeridas:", err);
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
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Consulta no encontrada");
    }

    const consulta = await res.json();

    $('#motivo_consulta').val(consulta.motivo_consulta).trigger('change');
    $('#motivo_consulta').prop('disabled', false);
    document.getElementById("modalidad").value = consulta.modalidad;
    document.getElementById("fecha").value = consulta.fecha.split('T')[0];
    document.getElementById("columna1").value = consulta.columna1 || "";
    document.getElementById("estado").value = consulta.estado;

    // Cargar estado de confidencialidad
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

    // ⭐ DEBUGGING: Ver todo el array de consultas
    console.log("📋 TODAS las consultas del cliente:", consultasDelCliente);
    console.log("🔍 Editando consulta ID:", id);
    
    // ⭐ CORREGIDO: Determinar si es la primera sesión buscando en consultasDelCliente
    const consultaEnHistorial = consultasDelCliente.find(c => c.id === id);
    console.log("🔍 Consulta encontrada en historial:", consultaEnHistorial);
    
    const esPrimeraSesion = consultaEnHistorial && consultaEnHistorial.numeroSesion === 1;
    console.log("🔍 Es primera sesión:", esPrimeraSesion);
    console.log("🔍 Número de sesión:", consultaEnHistorial?.numeroSesion);
    
    const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
    const consultasSugeridasInput = document.getElementById("consultas_sugeridas");
    
    if (esPrimeraSesion) {
      console.log("✅ Mostrando campo de consultas sugeridas");
      consultasSugeridasGroup.style.display = "block";
      consultasSugeridasInput.required = true;
      
      // Cargar el valor guardado en el cliente
      if (clienteActual && clienteActual.consultas_sugeridas) {
        consultasSugeridasInput.value = clienteActual.consultas_sugeridas;
        console.log("✅ Cargando consultas sugeridas:", clienteActual.consultas_sugeridas);
      } else {
        console.log("⚠️ No hay consultas sugeridas guardadas");
      }
    } else {
      console.log("❌ NO es primera sesión, ocultando campo");
      consultasSugeridasGroup.style.display = "none";
      consultasSugeridasInput.required = false;
      consultasSugeridasInput.value = "";
    }

    // Actualizar campo de fecha de cierre
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

  if (!confirm("¿Estás seguro de eliminar esta consulta?")) {
    return;
  }

  try {
    // ⭐ NUEVO: Verificar si es la primera sesión antes de eliminar
    const consultaAEliminar = consultasDelCliente.find(c => c.id === id);
    const esPrimeraSesion = consultaAEliminar && consultaAEliminar.numeroSesion === 1;
    
    console.log("🗑️ Eliminando consulta ID:", id);
    console.log("🗑️ Es primera sesión:", esPrimeraSesion);

    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Error al eliminar consulta");
    }

    // ⭐ NUEVO: Si se eliminó la primera sesión, limpiar consultas_sugeridas
    if (esPrimeraSesion) {
      const clienteId = getClienteIdFromURL();
      await limpiarConsultasSugeridas(clienteId);
      console.log("✅ Consultas sugeridas limpiadas");
    }

    alert("✅ Consulta eliminada correctamente");

    const clienteId = getClienteIdFromURL();
    loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error eliminando consulta:", err);
    alert("❌ Error al eliminar consulta");
  }
};

// ⭐ NUEVO: Función para limpiar consultas sugeridas
async function limpiarConsultasSugeridas(clienteId) {
  try {
    // Obtener datos actuales del cliente
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!resCliente.ok) {
      throw new Error("Error al obtener datos del cliente");
    }
    
    const clienteData = await resCliente.json();
    
    // Actualizar con consultas_sugeridas en null
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
      consultas_sugeridas: null // ⭐ Limpiar
    };
    
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    if (!resUpdate.ok) {
      throw new Error("Error al limpiar consultas sugeridas");
    }
    
    console.log("✅ Consultas sugeridas limpiadas correctamente");
  } catch (err) {
    console.error("❌ Error limpiando consultas sugeridas:", err);
  }
}

// ⭐ ACTUALIZADO: Reabrir caso SIN borrar las recomendaciones_finales del cliente
window.reabrirCaso = async function() {
  if (!confirm("¿Estás seguro de reabrir el caso? Todas las sesiones volverán a estar disponibles para editar.")) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    // 1. Actualizar todas las consultas a estado "Abierto"
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

    // 2. Limpiar SOLO fecha_cierre del cliente (MANTENER recomendaciones_finales)
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (resCliente.ok) {
      const clienteData = await resCliente.json();
      
      // MODIFICADO: Mantener las recomendaciones_finales y consultas_sugeridas
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
        recomendaciones_finales: clienteData.recomendaciones_finales, // ⭐ MANTENER las recomendaciones
        consultas_sugeridas: clienteData.consultas_sugeridas // ⭐ MANTENER las consultas sugeridas
      };
      
      await fetch(`${API_URL}/${clienteId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(clienteActualizado)
      });
    }

    alert("✅ Caso reabierto correctamente. Todas las sesiones están disponibles nuevamente.\n\n💡 Las recomendaciones finales se han conservado y podrás editarlas al cerrar el caso nuevamente.");

    // Recargar datos del cliente
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
  
  // Ocultar campo de fecha de cierre y recomendaciones
  document.getElementById("fechaCierreContainer").classList.remove("show");
  
  // ⭐ NUEVO: Guardar las recomendaciones antes de resetear
  const recomendacionesActuales = document.getElementById("recomendaciones_finales").value;
  
  setTimeout(() => {
    configurarCampoMotivo();
    // ⭐ NUEVO: Restaurar las recomendaciones después del reset
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

document.addEventListener("DOMContentLoaded", () => {
  loadClientData();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const fechaHoy = `${year}-${month}-${day}`;
  
  document.getElementById("fecha").value = fechaHoy;
});

// ============================================
// SISTEMA DE VIGILANCIA EPIDEMIOLÓGICA (SVE)
// Agregar al final de consulta.js
// ============================================

// Variables globales para SVE
let mesaTrabajoRegistrada = false;
let mesaTrabajoData = null;
let consultasSVE = [];
let editandoMesaTrabajo = false;

// ============================================
// INICIALIZACIÓN SVE
// ============================================
function inicializarSVE() {
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    console.log('✅ Inicializando Sistema de Vigilancia Epidemiológica');
    
    // Cargar datos guardados si existen
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
    
    // Fecha por defecto en consulta
    const fechaConsultaSVE = document.getElementById('fecha_consulta_sve');
    if (fechaConsultaSVE) {
      const today = new Date().toISOString().split('T')[0];
      fechaConsultaSVE.value = today;
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
    // Aquí deberás crear un endpoint en el backend para SVE
    // Por ahora usamos localStorage como demo
    const datosSVE = localStorage.getItem(`sve_${clienteId}`);
    
    if (datosSVE) {
      const datos = JSON.parse(datosSVE);
      
      if (datos.mesaTrabajo) {
        mesaTrabajoData = datos.mesaTrabajo;
        mesaTrabajoRegistrada = true;
        mostrarMesaTrabajoRegistrada();
        desbloquearFormularioConsulta();
      }
      
      if (datos.consultas && datos.consultas.length > 0) {
        consultasSVE = datos.consultas;
        mostrarConsultasSVE();
      }
      
      // Mostrar historial si hay datos
      if (mesaTrabajoRegistrada || consultasSVE.length > 0) {
        document.getElementById('historialSVE').style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Error cargando datos SVE:', err);
  }
}

// ============================================
// REGISTRAR MESA DE TRABAJO (Formulario 1) - SOLO 3 CAMPOS
// ============================================
async function registrarMesaTrabajo(e) {
  e.preventDefault();
  
  const clienteId = getClienteIdFromURL();
  if (!clienteId) {
    alert('⚠️ Error: No se pudo identificar el cliente');
    return;
  }
  
  // Capturar datos del formulario (SOLO 3 campos)
  const datos = {
    criterio_inclusion: document.getElementById('criterio_inclusion').value,
    diagnostico: document.getElementById('diagnostico').value.trim(),
    codigo_diagnostico: document.getElementById('codigo_diagnostico').value.trim(),
    fecha_registro: new Date().toISOString(),
    cliente_id: clienteId
  };
  
  try {
    // Guardar en localStorage (temporal - luego implementar backend)
    const datosSVE = JSON.parse(localStorage.getItem(`sve_${clienteId}`) || '{}');
    datosSVE.mesaTrabajo = datos;
    localStorage.setItem(`sve_${clienteId}`, JSON.stringify(datosSVE));
    
    mesaTrabajoData = datos;
    mesaTrabajoRegistrada = true;
    editandoMesaTrabajo = false;
    
    alert('✅ Mesa de Trabajo registrada correctamente');
    
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
    console.error('Error registrando mesa de trabajo:', err);
    alert('❌ Error al registrar mesa de trabajo');
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
// MOSTRAR MESA DE TRABAJO EN HISTORIAL (SOLO 3 CAMPOS)
// ============================================
function mostrarMesaTrabajoRegistrada() {
  if (!mesaTrabajoData) return;
  
  const contenedor = document.getElementById('mesaTrabajoRegistrada');
  const contenido = document.getElementById('mesaTrabajoContenido');
  
  contenido.innerHTML = `
    <div class="mesa-trabajo-item">
      <strong>✓ Criterio de Inclusión:</strong>
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
// REGISTRAR CONSULTA SVE (Formulario 2) - CON TODOS LOS CAMPOS
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
  
  // Capturar datos de la consulta (TODOS LOS CAMPOS DEL FORM 2)
  const consulta = {
    fecha: document.getElementById('fecha_consulta_sve').value,
    modalidad: document.getElementById('modalidad_sve').value,
    motivo_evaluacion: document.getElementById('motivo_evaluacion_sve').value.trim(),
    ajuste_funciones: document.getElementById('ajuste_funciones_sve').value.trim(),
    recomendaciones_medicas: document.getElementById('recomendaciones_medicas_sve').value.trim(),
    recomendaciones_trabajador: document.getElementById('recomendaciones_trabajador_sve').value.trim(),
    recomendaciones_empresa: document.getElementById('recomendaciones_empresa_sve').value.trim(),
    observaciones: document.getElementById('observaciones_consulta_sve').value.trim(),
    estado: document.getElementById('estado_sve').value,
    fecha_registro: new Date().toISOString(),
    cliente_id: clienteId
  };
  
  try {
    // Guardar en localStorage (temporal)
    const datosSVE = JSON.parse(localStorage.getItem(`sve_${clienteId}`) || '{}');
    if (!datosSVE.consultas) {
      datosSVE.consultas = [];
    }
    datosSVE.consultas.push(consulta);
    localStorage.setItem(`sve_${clienteId}`, JSON.stringify(datosSVE));
    
    consultasSVE.push(consulta);
    
    alert('✅ Consulta SVE registrada correctamente');
    
    // Limpiar formulario
    document.getElementById('formConsultaVigilancia').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha_consulta_sve').value = today;
    
    // Actualizar historial
    mostrarConsultasSVE();
    
  } catch (err) {
    console.error('Error registrando consulta SVE:', err);
    alert('❌ Error al registrar consulta');
  }
}

// ============================================
// MOSTRAR CONSULTAS SVE EN HISTORIAL (CON TODOS LOS CAMPOS)
// ============================================
function mostrarConsultasSVE() {
  const contenedor = document.getElementById('consultasSVERegistradas');
  
  if (consultasSVE.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No hay consultas registradas</p>';
    return;
  }
  
  const html = consultasSVE.map((consulta, index) => `
    <div class="consulta-sve-card">
      <div class="consulta-sve-header">
        <div class="consulta-sve-numero">Consulta #${index + 1}</div>
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
    </div>
  `).join('');
  
  contenedor.innerHTML = html;
}

// ============================================
// LLAMAR A INICIALIZACIÓN EN DOMContentLoaded
// ============================================
// Agregar al final del evento DOMContentLoaded existente:
document.addEventListener('DOMContentLoaded', () => {
  // ... código existente ...
  
  // Inicializar SVE si corresponde
  inicializarSVE();
});