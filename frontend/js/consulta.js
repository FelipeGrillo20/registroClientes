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

// ⭐ NUEVO: Mostrar/Ocultar campo de fecha de cierre según el estado
function toggleFechaCierreField() {
  const estadoSelect = document.getElementById("estado");
  const fechaCierreContainer = document.getElementById("fechaCierreContainer");
  const fechaCierreInput = document.getElementById("fecha_cierre");
  
  if (estadoSelect.value === "Cerrado") {
    fechaCierreContainer.classList.add("show");
    fechaCierreInput.required = true;
    
    // Si no tiene valor, establecer la fecha de hoy por defecto
    if (!fechaCierreInput.value) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      fechaCierreInput.value = `${year}-${month}-${day}`;
    }
  } else {
    fechaCierreContainer.classList.remove("show");
    fechaCierreInput.required = false;
    fechaCierreInput.value = "";
  }
}

// ⭐ NUEVO: Agregar listener al campo de estado
document.getElementById("estado")?.addEventListener("change", toggleFechaCierreField);

// Cargar datos del cliente
async function loadClientData() {
  const clienteId = getClienteIdFromURL();

  if (!clienteId) {
    alert("⚠ No se especificó un cliente");
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

  // ⭐ NUEVO: Mostrar fecha de cierre si existe
  const fechaCierreInfo = document.getElementById("fechaCierreInfo");
  const fechaCierreValue = document.getElementById("clientFechaCierre");
  
  if (cliente.fecha_cierre) {
    fechaCierreValue.textContent = formatDate(cliente.fecha_cierre);
    fechaCierreInfo.style.display = "flex";
  } else {
    fechaCierreInfo.style.display = "none";
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
}

// ⭐ MODIFICADO: Cerrar todas las consultas Y actualizar fecha_cierre del cliente
// Reemplaza TODA la función cerrarTodasLasConsultas en tu consulta.js

// ⭐ CORREGIDO: Cerrar todas las consultas Y actualizar fecha_cierre del cliente
async function cerrarTodasLasConsultas(clienteId, fechaCierre) {
  try {
    console.log("🔄 Iniciando cierre de caso...");
    console.log("Cliente ID:", clienteId);
    console.log("Fecha de cierre a guardar:", fechaCierre);
    
    // 1. Cerrar todas las consultas
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
            cliente_id: parseInt(clienteId)
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
    
    // 3. Preparar datos actualizados CON fecha_cierre
    const clienteActualizado = {
      cedula: clienteData.cedula,
      nombre: clienteData.nombre,
      vinculo: clienteData.vinculo,
      sede: clienteData.sede,
      tipo_entidad_pagadora: clienteData.tipo_entidad_pagadora,
      entidad_pagadora_especifica: clienteData.entidad_pagadora_especifica,
      empresa_id: clienteData.empresa_id,
      email: clienteData.email,
      telefono: clienteData.telefono,
      contacto_emergencia_nombre: clienteData.contacto_emergencia_nombre,
      contacto_emergencia_parentesco: clienteData.contacto_emergencia_parentesco,
      contacto_emergencia_telefono: clienteData.contacto_emergencia_telefono,
      fecha_cierre: fechaCierre // ⭐ CRÍTICO: Fecha de cierre
    };
    
    console.log("📝 Datos a enviar:", clienteActualizado);
    
    // 4. Actualizar el cliente con la fecha de cierre
    const resUpdate = await fetch(`${API_URL}/${clienteId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(clienteActualizado)
    });
    
    if (!resUpdate.ok) {
      const errorData = await resUpdate.json();
      console.error("❌ Error actualizando cliente:", errorData);
      throw new Error(errorData.message || "Error al actualizar fecha de cierre del cliente");
    }
    
    const clienteActualizadoRes = await resUpdate.json();
    console.log("✅ Cliente actualizado exitosamente:", clienteActualizadoRes);
    console.log("✅ Fecha de cierre guardada:", clienteActualizadoRes.fecha_cierre);

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
            <strong>📄 Observaciones:</strong><br>
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
  
  container.innerHTML = consultasHTML + botonesAccionHTML;
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

// ⭐ MODIFICADO: Manejar envío del formulario con fecha_cierre
document.getElementById("formConsulta")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motivo_consulta = $('#motivo_consulta').val();
  const modalidad = document.getElementById("modalidad").value;
  const fecha = document.getElementById("fecha").value;
  const columna1 = document.getElementById("columna1").value.trim();
  const estado = document.getElementById("estado").value;
  const fecha_cierre = document.getElementById("fecha_cierre").value;

  // Validaciones
  if (!motivo_consulta || !modalidad || !fecha || !estado) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
    return;
  }

  // Validar que si el estado es "Cerrado", debe haber fecha de cierre
  if (estado === "Cerrado" && !fecha_cierre) {
    alert("⚠️ Por favor especifica la fecha de cierre del caso");
    return;
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
    fecha_cierre: estado === "Cerrado" ? fecha_cierre : null
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

    // Si el estado es "Cerrado", cerrar todas las consultas
    if (estado === 'Cerrado') {
      await cerrarTodasLasConsultas(clienteId, fecha_cierre);
    }

    const mensaje = editandoConsultaId 
      ? "✅ Consulta actualizada correctamente"
      : "✅ Consulta registrada correctamente";
    
    alert(mensaje);

    // Limpiar formulario
    document.getElementById("formConsulta").reset();
    $('#motivo_consulta').val(null).trigger('change');
    editandoConsultaId = null;
    
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";

    // Recargar datos del cliente para actualizar fecha_cierre en la tarjeta
    await loadClientData();

  } catch (err) {
    console.error("Error guardando consulta:", err);
    alert("❌ " + err.message);
  }
});

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
    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Error al eliminar consulta");
    }

    alert("✅ Consulta eliminada correctamente");

    const clienteId = getClienteIdFromURL();
    loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error eliminando consulta:", err);
    alert("❌ Error al eliminar consulta");
  }
};

// ⭐ MODIFICADO: Reabrir caso también limpia la fecha_cierre del cliente
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

    // 2. Limpiar fecha_cierre del cliente (solo campos de la tabla clients)
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (resCliente.ok) {
      const clienteData = await resCliente.json();
      
      // ⭐ Solo campos que existen en la tabla clients
      const clienteActualizado = {
        cedula: clienteData.cedula,
        nombre: clienteData.nombre,
        vinculo: clienteData.vinculo,
        sede: clienteData.sede,
        tipo_entidad_pagadora: clienteData.tipo_entidad_pagadora,
        entidad_pagadora_especifica: clienteData.entidad_pagadora_especifica,
        empresa_id: clienteData.empresa_id,
        email: clienteData.email,
        telefono: clienteData.telefono,
        contacto_emergencia_nombre: clienteData.contacto_emergencia_nombre,
        contacto_emergencia_parentesco: clienteData.contacto_emergencia_parentesco,
        contacto_emergencia_telefono: clienteData.contacto_emergencia_telefono,
        fecha_cierre: null
      };
      
      await fetch(`${API_URL}/${clienteId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(clienteActualizado)
      });
    }

    alert("✅ Caso reabierto correctamente. Todas las sesiones están disponibles nuevamente.");

    // Recargar datos del cliente para actualizar la vista
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
  
  // Ocultar campo de fecha de cierre
  document.getElementById("fechaCierreContainer").classList.remove("show");
  
  setTimeout(() => {
    configurarCampoMotivo();
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