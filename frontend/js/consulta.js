// frontend/js/consulta.js

const API_URL = "http://localhost:5000/api/clients";
const CONSULTAS_API_URL = "http://localhost:5000/api/consultas";

let clienteActual = null;
let editandoConsultaId = null;
let consultasDelCliente = []; // Para almacenar todas las consultas

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
    window.clienteActual = cliente; // Exponer para informe.js

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

  // ============================================
  // MOSTRAR ENTIDAD PAGADORA
  // ============================================
  const entidadPagadoraElement = document.getElementById("clientEntidadPagadora");
  
  if (cliente.tipo_entidad_pagadora) {
    let textoEntidad = '';
    
    if (cliente.tipo_entidad_pagadora === 'Particular') {
      // Si es Particular, mostrar solo "Particular"
      textoEntidad = '<span class="badge-entidad-pagadora badge-particular">Particular</span>';
    } else {
      // Si es ARL o CCF, mostrar: "ARL → Positiva" o "CCF → Compensar"
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

  // Actualizar badge con nombre del cliente
  const badge = document.getElementById("clientBadge");
  const primerNombre = cliente.nombre ? cliente.nombre.split(" ")[0] : "Cliente";
  badge.textContent = primerNombre;
}

// ============================================
// FUNCIONALIDAD CONTACTO DE EMERGENCIA
// ============================================

// Abrir modal de contacto de emergencia desde el formulario
document.getElementById("btnContactoEmergencia")?.addEventListener("click", () => {
  if (!clienteActual) {
    alert("⚠️ No hay datos del cliente cargados");
    return;
  }

  // Si ya tiene contacto, mostrar para ver
  if (clienteActual.contacto_emergencia_nombre) {
    document.getElementById("contactoNombreVer").textContent = 
      clienteActual.contacto_emergencia_nombre;
    document.getElementById("contactoParentescoVer").textContent = 
      clienteActual.contacto_emergencia_parentesco;
    document.getElementById("contactoTelefonoVer").textContent = 
      clienteActual.contacto_emergencia_telefono;
    document.getElementById("modalVerContacto").classList.add("show");
  } else {
    // Si no tiene, abrir modal para crear
    abrirModalCrearContacto();
  }
});

// Función para abrir modal de crear/editar contacto
function abrirModalCrearContacto() {
  // Limpiar formulario
  document.getElementById("editContactoNombre").value = clienteActual.contacto_emergencia_nombre || "";
  document.getElementById("editContactoParentesco").value = clienteActual.contacto_emergencia_parentesco || "";
  document.getElementById("editContactoTelefono").value = clienteActual.contacto_emergencia_telefono || "";
  
  document.getElementById("modalEditarContacto").classList.add("show");
}

// Cerrar modal de visualización
window.cerrarModalContacto = function() {
  document.getElementById("modalVerContacto").classList.remove("show");
};

// Cerrar modal de edición
window.cerrarModalEditarContacto = function() {
  document.getElementById("modalEditarContacto").classList.remove("show");
};

// Cerrar modales al hacer clic fuera
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

// Guardar contacto de emergencia
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
    
    // Actualizar cliente con contacto de emergencia
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
    
    // Actualizar datos del cliente actual
    clienteActual.contacto_emergencia_nombre = nombre;
    clienteActual.contacto_emergencia_parentesco = parentesco;
    clienteActual.contacto_emergencia_telefono = telefono;
    window.clienteActual = clienteActual; // Actualizar referencia global
    
    cerrarModalEditarContacto();
    
  } catch (err) {
    console.error("Error guardando contacto:", err);
    alert("❌ Error al guardar contacto de emergencia");
  }
});

// Ver contacto desde historial
window.verContactoDesdeHistorial = async function() {
  if (!clienteActual) {
    alert("⚠️ No hay datos del cliente");
    return;
  }

  if (!clienteActual.contacto_emergencia_nombre) {
    // Si no tiene contacto, abrir para crear
    abrirModalCrearContacto();
  } else {
    // Si tiene contacto, mostrar
    document.getElementById("contactoNombreVer").textContent = 
      clienteActual.contacto_emergencia_nombre;
    document.getElementById("contactoParentescoVer").textContent = 
      clienteActual.contacto_emergencia_parentesco;
    document.getElementById("contactoTelefonoVer").textContent = 
      clienteActual.contacto_emergencia_telefono;
    document.getElementById("modalVerContacto").classList.add("show");
  }
};

// Editar contacto desde modal de visualización
window.editarContactoDesdeModal = function() {
  cerrarModalContacto();
  abrirModalCrearContacto();
};

// ============================================
// FUNCIONES PARA SISTEMA DE SESIONES
// ============================================

// Verificar si hay consultas con estado cerrado
function hayCasoCerrado() {
  return consultasDelCliente.some(c => c.estado === 'Cerrado');
}

// Obtener el motivo de la primera sesión
function getMotivoSesion1() {
  if (consultasDelCliente.length > 0) {
    // Ordenar por fecha para obtener la primera
    const ordenadas = [...consultasDelCliente].sort((a, b) => 
      new Date(a.fecha) - new Date(b.fecha)
    );
    return ordenadas[0].motivo_consulta;
  }
  return null;
}

// Configurar el campo motivo_consulta según el número de sesiones
function configurarCampoMotivo() {
  const select = $('#motivo_consulta');
  const numSesiones = consultasDelCliente.length;
  const casoCerrado = hayCasoCerrado();

  if (editandoConsultaId) {
    // Si estamos editando, mantener el campo habilitado
    select.prop('disabled', false);
    return;
  }

  if (casoCerrado) {
    // Si hay caso cerrado, deshabilitar el campo
    select.prop('disabled', true);
    return;
  }

  if (numSesiones === 0) {
    // Primera sesión: campo habilitado
    select.prop('disabled', false);
    select.val(null).trigger('change');
  } else {
    // Sesión 2 o más: campo deshabilitado con el motivo de la sesión 1
    const motivoSesion1 = getMotivoSesion1();
    select.val(motivoSesion1).trigger('change');
    select.prop('disabled', true);
  }
}

// Cerrar todas las consultas de un cliente
async function cerrarTodasLasConsultas(clienteId) {
  try {
    const promises = consultasDelCliente.map(consulta => {
      if (consulta.estado !== 'Cerrado') {
        return fetch(`${CONSULTAS_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...consulta,
            estado: 'Cerrado'
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error("Error cerrando consultas:", err);
    return false;
  }
}

// Cargar historial de consultas
async function loadHistorialConsultas(clienteId) {
  const container = document.getElementById("historialContainer");
  
  // Mostrar loading
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
    
    // Guardar consultas en variable global (copia profunda)
    consultasDelCliente = consultas ? JSON.parse(JSON.stringify(consultas)) : [];
    window.consultasDelCliente = consultasDelCliente; // Exponer para informe.js

    if (!consultas || consultas.length === 0) {
      container.innerHTML = `
        <div class="no-historial">
          <div class="no-historial-icon">🔭</div>
          <p>No hay consultas registradas para este cliente</p>
        </div>
      `;
      
      // Configurar campo motivo para nueva consulta
      configurarCampoMotivo();
      return;
    }

    // Ordenar consultas por fecha y por ID para evitar inversión de sesiones
    const consultasOrdenadas = JSON.parse(JSON.stringify(consultas)).sort((a, b) => {
      const diffFecha = new Date(a.fecha) - new Date(b.fecha);
      if (diffFecha !== 0) return diffFecha;
      return a.id - b.id;
    });
    
    // Asignar número de sesión a cada consulta
    consultasOrdenadas.forEach((consulta, index) => {
      consulta.numeroSesion = index + 1;
    });

    // Renderizar consultas en orden cronológico
    renderHistorial(consultasOrdenadas);

    // Configurar campo motivo
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

// Renderizar historial de consultas
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
  
  // Agregar botón de reabrir caso si hay casos cerrados
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

// Formatear fecha
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Escape HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Manejar envío del formulario
document.getElementById("formConsulta")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motivo_consulta = $('#motivo_consulta').val();
  const modalidad = document.getElementById("modalidad").value;
  const fecha = document.getElementById("fecha").value;
  const columna1 = document.getElementById("columna1").value.trim();
  const estado = document.getElementById("estado").value;

  // Validaciones
  if (!motivo_consulta || !modalidad || !fecha || !estado) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
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
    estado
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
    if (estado === 'Cerrado' && !editandoConsultaId) {
      await cerrarTodasLasConsultas(clienteId);
    }

    // Si estamos editando una consulta y la cambiamos a "Cerrado"
    if (estado === 'Cerrado' && editandoConsultaId) {
      await cerrarTodasLasConsultas(clienteId);
    }

    const mensaje = editandoConsultaId 
      ? "✅ Consulta actualizada correctamente"
      : "✅ Consulta registrada correctamente";
    
    alert(mensaje);

    // Limpiar formulario
    document.getElementById("formConsulta").reset();
    $('#motivo_consulta').val(null).trigger('change');
    editandoConsultaId = null;
    
    // Cambiar texto del botón
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";

    // Recargar historial
    await loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error guardando consulta:", err);
    alert("❌ " + err.message);
  }
});

// Editar consulta
window.editarConsulta = async function(id) {
  // Verificar si hay caso cerrado
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

    // Llenar formulario
    $('#motivo_consulta').val(consulta.motivo_consulta).trigger('change');
    $('#motivo_consulta').prop('disabled', false);
    document.getElementById("modalidad").value = consulta.modalidad;
    document.getElementById("fecha").value = consulta.fecha.split('T')[0];
    document.getElementById("columna1").value = consulta.columna1 || "";
    document.getElementById("estado").value = consulta.estado;

    editandoConsultaId = id;

    // Cambiar texto del botón
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Actualizar Consulta";

    // Scroll al formulario
    document.querySelector(".consulta-section").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error("Error cargando consulta:", err);
    alert("❌ Error al cargar consulta para editar");
  }
};

// Eliminar consulta
window.eliminarConsulta = async function(id) {
  // Verificar si hay caso cerrado
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

    // Recargar historial
    const clienteId = getClienteIdFromURL();
    loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error eliminando consulta:", err);
    alert("❌ Error al eliminar consulta");
  }
};

// Reabrir caso - Cambiar todas las consultas a "Abierto"
window.reabrirCaso = async function() {
  if (!confirm("¿Estás seguro de reabrir el caso? Todas las sesiones volverán a estar disponibles para editar.")) {
    return;
  }

  const clienteId = getClienteIdFromURL();

  try {
    // Actualizar todas las consultas a estado "Abierto"
    const promises = consultasDelCliente.map(consulta => {
      if (consulta.estado === 'Cerrado') {
        return fetch(`${CONSULTAS_API_URL}/${consulta.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...consulta,
            estado: 'Abierto'
          })
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);

    alert("✅ Caso reabierto correctamente. Todas las sesiones están disponibles nuevamente.");

    // Recargar historial
    await loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error reabriendo caso:", err);
    alert("❌ Error al reabrir el caso");
  }
};

// Botón volver
document.getElementById("btnBack")?.addEventListener("click", () => {
  window.location.href = "clientes.html";
});

// Botón refresh historial
document.getElementById("btnRefreshHistorial")?.addEventListener("click", () => {
  const clienteId = getClienteIdFromURL();
  loadHistorialConsultas(clienteId);
});

// Manejar reset del formulario
document.getElementById("formConsulta")?.addEventListener("reset", () => {
  editandoConsultaId = null;
  document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";
  
  // Reconfigurar el campo motivo después de limpiar
  setTimeout(() => {
    configurarCampoMotivo();
  }, 100);
});

// Inicializar Select2 cuando el DOM esté listo
$(document).ready(function() {
  // Inicializar Select2 para motivo de consulta
  $('#motivo_consulta').select2({
    theme: 'default',
    language: 'es',
    placeholder: 'Seleccione un motivo de consulta',
    allowClear: true,
    width: '100%'
  });
});

// Cargar datos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  loadClientData();
  
  // Establecer fecha de hoy por defecto
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const fechaHoy = `${year}-${month}-${day}`;
  
  document.getElementById("fecha").value = fechaHoy;
});