// frontend/js/consulta-cliente.js
// MÓDULO 2: Gestión del cliente (datos principales y contacto de emergencia)
// Depende de: consulta-api.js

// ============================================
// CARGAR DATOS DEL CLIENTE
// ============================================

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

    // Solo cargar historial si estamos en modalidad Orientación Psicosocial
    const modalidad = localStorage.getItem('modalidadSeleccionada');
    if (modalidad !== 'Sistema de Vigilancia Epidemiológica') {
      loadHistorialConsultas(clienteId);
    }
    // Si es SVE, el historial se carga en cargarDatosSVE()

  } catch (err) {
    console.error("Error cargando cliente:", err);
    alert("❌ Error al cargar datos del cliente");
    window.location.href = "clientes.html";
  }
}

// ============================================
// FUNCIONES DE CÁLCULO DE EDAD Y TIEMPO LABORADO
// ============================================

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function calcularTiempoLaborado(fechaIngreso) {
  if (!fechaIngreso) return null;
  const hoy = new Date();
  const ingreso = new Date(fechaIngreso);

  let anios  = hoy.getFullYear() - ingreso.getFullYear();
  let meses  = hoy.getMonth()    - ingreso.getMonth();
  let dias   = hoy.getDate()     - ingreso.getDate();

  if (dias < 0) {
    meses--;
    const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
    dias += ultimoDiaMesAnterior;
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }

  const partes = [];
  if (anios  > 0) partes.push(`${anios}  ${anios  === 1 ? 'año'  : 'años'}`);
  if (meses  > 0) partes.push(`${meses} ${meses  === 1 ? 'mes'  : 'meses'}`);
  if (dias   > 0) partes.push(`${dias}  ${dias   === 1 ? 'día'  : 'días'}`);

  if (partes.length === 0) return 'Recién ingresado';
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}

// ============================================
// MOSTRAR DATOS DEL CLIENTE EN LA TARJETA
// ============================================

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

  // Mostrar solo Cliente Final
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

  // Mostrar consultas sugeridas si existe
  const consultasSugeridasInfo = document.getElementById("consultasSugeridasInfo");
  const consultasSugeridasValue = document.getElementById("clientConsultasSugeridas");

  if (cliente.consultas_sugeridas) {
    consultasSugeridasValue.textContent = `${cliente.consultas_sugeridas} sesiones`;
    consultasSugeridasInfo.style.display = "flex";
  } else {
    consultasSugeridasInfo.style.display = "none";
  }

  // ── Campos nuevos ──────────────────────────────────────────────────────────

  // Edad (calculada desde fecha_nacimiento)
  const edadEl = document.getElementById("clientEdad");
  if (edadEl) {
    const edad = calcularEdad(cliente.fecha_nacimiento);
    edadEl.textContent = edad !== null ? `${edad} años` : "-";
  }

  // Cargo
  const cargoEl = document.getElementById("clientCargo");
  if (cargoEl) cargoEl.textContent = cliente.cargo || "-";

  // Género
  const generoEl = document.getElementById("clientGenero");
  if (generoEl) generoEl.textContent = cliente.sexo || "-";

  // Dirección
  const direccionEl = document.getElementById("clientDireccion");
  if (direccionEl) direccionEl.textContent = cliente.direccion || "-";

  // Estado Civil
  const estadoCivilEl = document.getElementById("clientEstadoCivil");
  if (estadoCivilEl) estadoCivilEl.textContent = cliente.estado_civil || "-";

  // Tiempo laborado (calculado desde fecha_ingreso)
  const tiempoLaboradoEl = document.getElementById("clientTiempoLaborado");
  if (tiempoLaboradoEl) {
    const tiempo = calcularTiempoLaborado(cliente.fecha_ingreso);
    tiempoLaboradoEl.textContent = tiempo || "-";
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
    document.getElementById("contactoCiudadVer").textContent =
      clienteActual.contacto_emergencia_ciudad || "-";
    document.getElementById("modalVerContacto").classList.add("show");
  } else {
    abrirModalCrearContacto();
  }
});

function abrirModalCrearContacto() {
  document.getElementById("editContactoNombre").value = clienteActual.contacto_emergencia_nombre || "";
  document.getElementById("editContactoParentesco").value = clienteActual.contacto_emergencia_parentesco || "";
  document.getElementById("editContactoTelefono").value = clienteActual.contacto_emergencia_telefono || "";
  document.getElementById("editContactoCiudad").value = clienteActual.contacto_emergencia_ciudad || "";

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
  const ciudad = document.getElementById("editContactoCiudad").value.trim();

  if (!nombre || !parentesco || !telefono) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
    return;
  }

  try {
    const clienteId = getClienteIdFromURL();

    const datosActualizados = {
      ...clienteActual,
      contacto_emergencia_nombre: nombre,
      contacto_emergencia_parentesco: parentesco,
      contacto_emergencia_telefono: telefono,
      contacto_emergencia_ciudad: ciudad || null
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
    clienteActual.contacto_emergencia_ciudad = ciudad || null;
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
    document.getElementById("contactoCiudadVer").textContent =
      clienteActual.contacto_emergencia_ciudad || "-";
    document.getElementById("modalVerContacto").classList.add("show");
  }
};

window.editarContactoDesdeModal = function() {
  cerrarModalContacto();
  abrirModalCrearContacto();
};

// ============================================
// BOTÓN DASHBOARD SEGÚN MODALIDAD
// ============================================

function actualizarBotonDashboardConsulta() {
  const modalidad = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';
  const btnDashboard = document.querySelector('.btn-dashboard');

  if (!btnDashboard) {
    console.warn('⚠️ No se encontró el botón dashboard');
    return;
  }

  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    btnDashboard.innerHTML = '📊 Dashboard SVE';
    btnDashboard.style.background = 'linear-gradient(135deg, #56ab2f, #a8e063)';
    btnDashboard.style.boxShadow = '0 4px 15px rgba(86, 171, 47, 0.3)';
    btnDashboard.title = 'Ver Dashboard del Sistema de Vigilancia Epidemiológica';
    btnDashboard.onclick = () => { window.location.href = 'dashboardSVE.html'; };
  } else {
    btnDashboard.innerHTML = '📊 Dashboard';
    btnDashboard.style.background = 'linear-gradient(135deg, #9b59b6, #8e44ad)';
    btnDashboard.style.boxShadow = '0 4px 15px rgba(155, 89, 182, 0.3)';
    btnDashboard.title = 'Ver Dashboard de Orientación Psicosocial';
    btnDashboard.onclick = () => { window.location.href = 'dashboard.html'; };
  }
}

// Actualizar botón si cambia la modalidad en otra pestaña
window.addEventListener('storage', (e) => {
  if (e.key === 'modalidadSeleccionada') {
    actualizarBotonDashboardConsulta();
  }
});

console.log('✅ Módulo consulta-cliente.js cargado');