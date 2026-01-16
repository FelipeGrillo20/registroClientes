// js/clientes.js
const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;
const EMPRESAS_URL = window.API_CONFIG.ENDPOINTS.EMPRESAS;
const USERS_URL = window.API_CONFIG.ENDPOINTS.AUTH.USERS;
const CONSULTAS_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS;
const CONSULTAS_SVE_URL = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

const tbody = document.getElementById("clientList");
const filterCedula = document.getElementById("filterCedula");
const filterSede = document.getElementById("filterSede");
const filterVinculo = document.getElementById("filterVinculo");
const filterEmpresa = document.getElementById("filterEmpresa");
const filterProfesionalSelect = document.getElementById("filterProfesionalSelect");

let allClients = [];
let allEmpresas = [];
let allProfesionales = [];
let currentUserRole = null;
let consultasDisponibles = {};
let filtrosActivos = { // ✅ NUEVO: Objeto para mantener filtros activos
  profesional: null,
  año: null,
  mes: null
};

// ============================================
// NUEVA FUNCIÓN: Actualizar contador de trabajadores
// ============================================
function actualizarContadorTrabajadores(cantidad) {
  const contadorNumero = document.getElementById('cantidadTrabajadores');
  
  if (!contadorNumero) return;
  
  // Agregar animación de actualización
  contadorNumero.classList.add('updated');
  
  // Actualizar el número
  contadorNumero.textContent = cantidad;
  
  // Remover la animación después de que termine
  setTimeout(() => {
    contadorNumero.classList.remove('updated');
  }, 500);
  
  console.log(`📊 Contador actualizado: ${cantidad} trabajadores`);
}

// Función para obtener token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Función para obtener datos del usuario actual
function getCurrentUserData() {
  const userData = localStorage.getItem("userData");
  return userData ? JSON.parse(userData) : null;
}

// ✅ NUEVA FUNCIÓN: Verificar si un cliente tiene informe disponible
async function verificarInformeDisponible(clienteId, modalidad) {
  try {
    // Verificar en cache primero
    if (consultasDisponibles[clienteId] !== undefined) {
      return consultasDisponibles[clienteId];
    }

    console.log(`🔍 Verificando informe para cliente ${clienteId} en modalidad: ${modalidad}`);

    // Para Orientación Psicosocial: Verificar que el caso esté cerrado
    if (modalidad === 'Orientación Psicosocial') {
      // Obtener datos del cliente para verificar fecha_cierre
      const resCliente = await fetch(`${API_URL}/${clienteId}`, {
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });

      if (!resCliente.ok) {
        console.log(`❌ No se pudo cargar cliente ${clienteId}`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      const cliente = await resCliente.json();
      
      console.log(`📋 Cliente ${clienteId} - fecha_cierre:`, cliente.fecha_cierre);

      // ✅ CRÍTICO: Verificar que tenga fecha_cierre (caso cerrado)
      if (!cliente.fecha_cierre) {
        console.log(`❌ Cliente ${clienteId} NO tiene fecha_cierre (caso NO cerrado)`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      // Verificar que tenga consultas
      const resConsultas = await fetch(`${CONSULTAS_URL}/cliente/${clienteId}`, {
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });

      if (!resConsultas.ok) {
        console.log(`❌ Cliente ${clienteId} NO tiene consultas`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      const consultas = await resConsultas.json();
      const tieneConsultas = Array.isArray(consultas) && consultas.length > 0;

      if (!tieneConsultas) {
        console.log(`❌ Cliente ${clienteId} tiene 0 consultas`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      console.log(`✅ Cliente ${clienteId} TIENE informe disponible (caso cerrado + ${consultas.length} consultas)`);
      consultasDisponibles[clienteId] = true;
      return true;
    }

    // Para SVE: Solo verificar que tenga consultas
    if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
      const resConsultas = await fetch(`${CONSULTAS_SVE_URL}/cliente/${clienteId}`, {
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });

      if (!resConsultas.ok) {
        console.log(`❌ Cliente ${clienteId} NO tiene consultas SVE`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      const consultas = await resConsultas.json();
      const tieneConsultas = Array.isArray(consultas) && consultas.length > 0;

      if (!tieneConsultas) {
        console.log(`❌ Cliente ${clienteId} tiene 0 consultas SVE`);
        consultasDisponibles[clienteId] = false;
        return false;
      }

      console.log(`✅ Cliente ${clienteId} TIENE informe SVE disponible (${consultas.length} consultas)`);
      consultasDisponibles[clienteId] = true;
      return true;
    }

    // Si la modalidad no coincide con ninguna
    consultasDisponibles[clienteId] = false;
    return false;

  } catch (err) {
    console.error(`❌ Error verificando informe para cliente ${clienteId}:`, err);
    consultasDisponibles[clienteId] = false;
    return false;
  }
}

// Verificar y mostrar modalidad seleccionada
function verificarYMostrarModalidad() {
  const modalidadSeleccionada = localStorage.getItem('modalidadSeleccionada');
  
  if (!modalidadSeleccionada) {
    alert('⚠️ Debes seleccionar una modalidad antes de ver trabajadores');
    window.location.href = 'modalidad.html';
    return null;
  }
  
  // Actualizar el título de la página según la modalidad
  const titulo = document.querySelector('.page-header h1');
  if (titulo) {
    if (modalidadSeleccionada === 'Orientación Psicosocial') {
      titulo.innerHTML = '📋 Trabajadores - Orientación Psicosocial';
    } else if (modalidadSeleccionada === 'Sistema de Vigilancia Epidemiológica') {
      titulo.innerHTML = '📋 Trabajadores - Sistema de Vigilancia Epidemiológica';
    }
  }
  
  return modalidadSeleccionada;
}

// Control de menús de filtros
document.addEventListener("DOMContentLoaded", () => {
  // Obtener rol del usuario actual
  const userData = getCurrentUserData();
  currentUserRole = userData?.rol;
  
  console.log("👤 Rol del usuario:", currentUserRole);
  
  // Verificar modalidad al cargar
  const modalidad = verificarYMostrarModalidad();
  if (!modalidad) return;
  
  // Si es admin, cargar profesionales y mostrar filtros
  if (currentUserRole === 'admin') {
    loadProfesionales();
    document.getElementById("profesionalFilterContainer").style.display = "flex";
    
    // ✅ NUEVO: Mostrar y poblar filtros de año y mes
    const yearFilterContainer = document.getElementById("yearFilterContainer");
    const mesFilterContainer = document.getElementById("mesFilterContainer");
    
    if (yearFilterContainer) {
      yearFilterContainer.style.display = "flex";
      populateYearFilter();
    }
    
    if (mesFilterContainer) {
      mesFilterContainer.style.display = "flex";
      populateMesFilter();
    }
    
    // ✅ NUEVO: Mostrar contador de trabajadores
    const contadorTrabajadores = document.getElementById("contadorTrabajadores");
    if (contadorTrabajadores) {
      contadorTrabajadores.style.display = "flex";
    }
  }
  
  loadClients(modalidad);
  loadEmpresas();
  setupFilterEvents();
});

// Cargar lista de profesionales (solo para admin)
async function loadProfesionales() {
  try {
    console.log("📥 Cargando lista de profesionales y administradores...");
    
    const res = await fetch(USERS_URL, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      console.error("❌ Error cargando profesionales - Status:", res.status);
      return;
    }
    
    const data = await res.json();
    
    // ✅ MODIFICADO: Filtrar usuarios activos con rol 'profesional' O 'admin'
    allProfesionales = data.users.filter(user => 
      user.activo && (user.rol === 'profesional' || user.rol === 'admin')
    );
    
    // ✅ Ordenar alfabéticamente por nombre
    allProfesionales.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    console.log("✅ Profesionales y administradores cargados:", allProfesionales.length);
    console.log("📋 Desglose:", {
      profesionales: allProfesionales.filter(u => u.rol === 'profesional').length,
      administradores: allProfesionales.filter(u => u.rol === 'admin').length
    });
    
    populateProfesionalFilter();
  } catch (err) {
    console.error("❌ Error loading profesionales:", err);
  }
}

// Llenar el select de profesionales (con badge de rol)
function populateProfesionalFilter() {
  filterProfesionalSelect.innerHTML = '<option value="">Todos los Profesionales</option>';
  
  allProfesionales.forEach(profesional => {
    const option = document.createElement("option");
    option.value = profesional.id;
    
    // ✅ NUEVO: Agregar indicador de rol
    const rolBadge = profesional.rol === 'admin' ? ' 👑' : '';
    option.textContent = `${profesional.nombre} (${profesional.cedula})${rolBadge}`;
    
    filterProfesionalSelect.appendChild(option);
  });
  
  console.log("✅ Filtro de profesionales poblado");
}

// Cargar empresas para el filtro
async function loadEmpresas() {
  try {
    const res = await fetch(EMPRESAS_URL, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      console.error("Error cargando empresas");
      return;
    }
    
    allEmpresas = await res.json();
    populateEmpresaFilter();
  } catch (err) {
    console.error("Error loading empresas:", err);
  }
}

// Llenar el filtro de empresas
function populateEmpresaFilter() {
  filterEmpresa.innerHTML = '<option value="">Todas las Empresas</option>';
  allEmpresas.forEach(empresa => {
    const option = document.createElement("option");
    option.value = empresa.id;
    option.textContent = empresa.cliente_final;
    filterEmpresa.appendChild(option);
  });
}

// Cargar clientes CON filtro de modalidad y profesional
async function loadClients(modalidad, profesionalId = null, año = null, mes = null) {
  tbody.innerHTML = `<tr><td colspan="8" class="no-data">Cargando clientes...</td></tr>`;
  
  // ✅ Limpiar cache de consultas al recargar
  consultasDisponibles = {};
  
  try {
    // Construir URL con parámetros
    let url = `${API_URL}?modalidad=${encodeURIComponent(modalidad)}`;
    
    // Si hay profesional seleccionado, agregarlo a la URL
    if (profesionalId) {
      url += `&profesional_id=${profesionalId}`;
      console.log("🔍 Filtrando por profesional ID:", profesionalId);
    }
    
    // ✅ NUEVO: Agregar filtros de año y mes si existen
    if (año) {
      url += `&año=${año}`;
      console.log("📅 Filtrando por año:", año);
    }
    
    if (mes) {
      url += `&mes=${mes}`;
      console.log("📆 Filtrando por mes:", mes);
    }
    
    console.log("📡 Petición a:", url);
    
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">Error al cargar clientes</td></tr>`;
      // ✅ Actualizar contador a 0 en caso de error
      actualizarContadorTrabajadores(0);
      return;
    }
    
    const clients = await res.json();
    
    console.log("📦 Clientes recibidos:", clients.length);
    if (clients.length > 0) {
      console.log("📋 Primer cliente de ejemplo:", clients[0]);
    }
    
    // ✅ NUEVO: Actualizar contador con la cantidad de clientes
    actualizarContadorTrabajadores(clients.length);
    
    if (!Array.isArray(clients) || clients.length === 0) {
      let mensaje = "No hay clientes registrados";
      
      // Personalizar mensaje según filtros activos
      if (profesionalId && año && mes) {
        mensaje = `No hay clientes registrados por este profesional en ${getMesNombre(mes)} de ${año}`;
      } else if (profesionalId && año) {
        mensaje = `No hay clientes registrados por este profesional en ${año}`;
      } else if (profesionalId) {
        mensaje = "No hay clientes registrados por este profesional en esta modalidad";
      } else if (año && mes) {
        mensaje = `No hay clientes registrados en ${getMesNombre(mes)} de ${año}`;
      } else if (año) {
        mensaje = `No hay clientes registrados en ${año}`;
      } else {
        mensaje = "No hay clientes registrados en esta modalidad";
      }
      
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">${mensaje}</td></tr>`;
      return;
    }

    // Ordenar clientes por ID descendente (último ingresado primero)
    const sortedClients = clients.sort((a, b) => b.id - a.id);
    
    allClients = sortedClients;
    
    // ✅ Guardar modalidad actual para usar en renderClients
    window.currentModalidad = modalidad;
    
    renderClients(allClients);
    populateFilterOptions(allClients);
  } catch (err) {
    console.error("Error loading clients:", err);
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">Error de conexión al cargar clientes</td></tr>`;
    // ✅ Actualizar contador a 0 en caso de error
    actualizarContadorTrabajadores(0);
  }
}


// ============================================
// NUEVA FUNCIÓN: Obtener nombre del mes
// ============================================
function getMesNombre(mesNumero) {
  const meses = {
    '1': 'Enero',
    '2': 'Febrero',
    '3': 'Marzo',
    '4': 'Abril',
    '5': 'Mayo',
    '6': 'Junio',
    '7': 'Julio',
    '8': 'Agosto',
    '9': 'Septiembre',
    '10': 'Octubre',
    '11': 'Noviembre',
    '12': 'Diciembre'
  };
  return meses[String(mesNumero)] || 'Mes desconocido';
}

// ============================================
// NUEVA FUNCIÓN: Poblar select de años
// ============================================
function populateYearFilter() {
  const filterAño = document.getElementById('filterAño');
  if (!filterAño) return;
  
  filterAño.innerHTML = '<option value="">Todos los Años</option>';
  
  // Generar años desde 2026 hasta 2030
  for (let año = 2026; año <= 2030; año++) {
    const option = document.createElement("option");
    option.value = año;
    option.textContent = año;
    filterAño.appendChild(option);
  }
  
  console.log("✅ Filtro de años poblado (2026-2030)");
}

// ============================================
// NUEVA FUNCIÓN: Poblar select de meses
// ============================================
function populateMesFilter() {
  const filterMes = document.getElementById('filterMes');
  if (!filterMes) return;
  
  const meses = [
    { valor: '', nombre: 'Todos los Meses' },
    { valor: '1', nombre: 'Enero' },
    { valor: '2', nombre: 'Febrero' },
    { valor: '3', nombre: 'Marzo' },
    { valor: '4', nombre: 'Abril' },
    { valor: '5', nombre: 'Mayo' },
    { valor: '6', nombre: 'Junio' },
    { valor: '7', nombre: 'Julio' },
    { valor: '8', nombre: 'Agosto' },
    { valor: '9', nombre: 'Septiembre' },
    { valor: '10', nombre: 'Octubre' },
    { valor: '11', nombre: 'Noviembre' },
    { valor: '12', nombre: 'Diciembre' }
  ];
  
  filterMes.innerHTML = '';
  
  meses.forEach(mes => {
    const option = document.createElement("option");
    option.value = mes.valor;
    option.textContent = mes.nombre;
    filterMes.appendChild(option);
  });
  
  console.log("✅ Filtro de meses poblado");
}



// ✅ ACTUALIZADO: Renderizar clientes con botón de informe
async function renderClients(list) {
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">No se encontraron clientes con esos filtros</td></tr>`;
    return;
  }

  const modalidad = window.currentModalidad || localStorage.getItem('modalidadSeleccionada');
  console.log(`🎨 Renderizando ${list.length} clientes en modalidad: ${modalidad}`);

  for (const c of list) {
    const tr = document.createElement("tr");

    // Determinar badge de vínculos
    let vinculoBadge = '';
    if (c.vinculo === 'Trabajador') {
      vinculoBadge = '<span class="badge-vinculo badge-trabajador">Trabajador</span>';
    } else if (c.vinculo === 'Familiar Trabajador') {
      vinculoBadge = '<span class="badge-vinculo badge-familiar">Familiar</span>';
    } else {
      vinculoBadge = '<span style="color: #95a5a6;">-</span>';
    }

    // Determinar badge de empresa
    let empresaBadge = '';
    if (c.cliente_final) {
      empresaBadge = `<span class="badge-empresa">${escapeHtml(c.cliente_final)}</span>`;
    } else {
      empresaBadge = '<span style="color: #95a5a6;">-</span>';
    }

    // ✅ NUEVO: Verificar si tiene informe disponible
    console.log(`🔍 Verificando informe para cliente ID: ${c.id}, Nombre: ${c.nombre}, Cédula: ${c.cedula}`);
    const tieneInforme = await verificarInformeDisponible(c.id, modalidad);
    console.log(`${tieneInforme ? '✅' : '❌'} Cliente ${c.id} (${c.nombre}): Informe ${tieneInforme ? 'DISPONIBLE' : 'NO DISPONIBLE'}`);
    
    const informeDisabled = tieneInforme ? '' : 'disabled';
    const informeClass = tieneInforme ? 'btn-informe' : 'btn-informe btn-informe-disabled';

    tr.innerHTML = `
      <td>${c.cedula ?? ""}</td>
      <td>${escapeHtml(c.nombre ?? "")}</td>
      <td>${escapeHtml(c.sede ?? "")}</td>
      <td>${escapeHtml(c.email ?? "")}</td>
      <td>${escapeHtml(c.telefono ?? "")}</td>
      <td>${vinculoBadge}</td>
      <td>${empresaBadge}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-edit" data-id="${c.id}" onclick="onEdit(${c.id})">Editar</button>
          <button class="btn-action btn-delete" data-id="${c.id}" onclick="onDelete(${c.id})">Eliminar</button>
          <button class="btn-action btn-consulta" data-id="${c.id}" onclick="onConsulta(${c.id})">Consulta</button>
          <button class="btn-action ${informeClass}" data-id="${c.id}" onclick="onInforme(${c.id}, '${modalidad}')" ${informeDisabled}>Informe</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  
  console.log(`✅ Renderizado completo de ${list.length} clientes`);
}

function populateFilterOptions(clients) {
  const sedes = [...new Set(clients.map(c => c.sede).filter(Boolean))];
  fillSelect(filterSede, sedes, "Sede");
}

function fillSelect(selectElem, items, label) {
  const currentValue = selectElem.value;
  selectElem.innerHTML = `<option value="">Todas las ${label}s</option>`;
  items.forEach(i => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    selectElem.appendChild(opt);
  });
  if (currentValue) {
    selectElem.value = currentValue;
  }
}

function applyFilters() {
  let filtered = [...allClients];
  
  const cedulaVal = filterCedula.value.trim();
  const sedeVal = filterSede.value;
  const vinculoVal = filterVinculo.value;
  const empresaVal = filterEmpresa.value;

  if (cedulaVal) filtered = filtered.filter(c => String(c.cedula).includes(cedulaVal));
  if (sedeVal) filtered = filtered.filter(c => c.sede === sedeVal);
  if (vinculoVal) filtered = filtered.filter(c => c.vinculo === vinculoVal);
  if (empresaVal) filtered = filtered.filter(c => String(c.empresa_id) === empresaVal);

  renderClients(filtered);
}

function setupFilterEvents() {
  document.querySelectorAll(".filter-menu").forEach(menu => {
    menu.classList.remove("show");
    menu.style.display = "none";
  });

  const filterIcons = document.querySelectorAll(".filter-icon");
  const menus = document.querySelectorAll(".filter-menu");

  filterIcons.forEach(icon => {
    icon.addEventListener("click", e => {
      e.stopPropagation();
      const th = icon.closest(".filterable");
      const type = th.dataset.type;
      const menu = document.getElementById(`filterMenu-${type}`);

      menus.forEach(m => {
        if (m !== menu) {
          m.classList.remove("show");
          m.style.display = "none";
        }
      });

      if (menu.classList.contains("show")) {
        menu.classList.remove("show");
        menu.style.display = "none";
      } else {
        menu.classList.add("show");
        menu.style.display = "block";
      }
    });
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".filterable")) {
      menus.forEach(m => {
        m.classList.remove("show");
        m.style.display = "none";
      });
    }
  });

  menus.forEach(menu => {
    menu.addEventListener("click", e => {
      e.stopPropagation();
    });
  });

  filterCedula.addEventListener("input", applyFilters);
  
  [filterSede, filterVinculo, filterEmpresa].forEach(select => {
    select.addEventListener("change", () => {
      applyFilters();
      const filterType = select.id.replace('filter', '').toLowerCase();
      const menu = document.getElementById(`filterMenu-${filterType}`);
      if (menu) {
        menu.classList.remove("show");
        menu.style.display = "none";
      }
    });
  });

  // ✅ Event listener para filtro de profesional
  if (filterProfesionalSelect) {
    filterProfesionalSelect.addEventListener("change", () => {
      const profesionalId = filterProfesionalSelect.value;
      filtrosActivos.profesional = profesionalId || null;
      
      const modalidad = localStorage.getItem('modalidadSeleccionada');
      
      console.log("🔄 Cambiando filtro de profesional:", profesionalId || "Todos");
      
      loadClients(
        modalidad, 
        filtrosActivos.profesional, 
        filtrosActivos.año, 
        filtrosActivos.mes
      );
    });
  }

  // ✅ NUEVO: Event listener para filtro de año
  const filterAño = document.getElementById('filterAño');
  if (filterAño) {
    filterAño.addEventListener("change", () => {
      const año = filterAño.value;
      filtrosActivos.año = año || null;
      
      const modalidad = localStorage.getItem('modalidadSeleccionada');
      
      console.log("📅 Cambiando filtro de año:", año || "Todos");
      
      loadClients(
        modalidad, 
        filtrosActivos.profesional, 
        filtrosActivos.año, 
        filtrosActivos.mes
      );
    });
  }

  // ✅ NUEVO: Event listener para filtro de mes
  const filterMes = document.getElementById('filterMes');
  if (filterMes) {
    filterMes.addEventListener("change", () => {
      const mes = filterMes.value;
      filtrosActivos.mes = mes || null;
      
      const modalidad = localStorage.getItem('modalidadSeleccionada');
      
      console.log("📆 Cambiando filtro de mes:", mes ? getMesNombre(mes) : "Todos");
      
      loadClients(
        modalidad, 
        filtrosActivos.profesional, 
        filtrosActivos.año, 
        filtrosActivos.mes
      );
    });
  }

  // ✅ MODIFICAR: Botón limpiar filtros
  const btnClearFilters = document.getElementById("btnClearFilters");
  if (btnClearFilters) {
    btnClearFilters.addEventListener("click", () => {
      filterCedula.value = "";
      filterSede.value = "";
      filterVinculo.value = "";
      filterEmpresa.value = "";
      
      if (filterProfesionalSelect) {
        filterProfesionalSelect.value = "";
      }
      
      // ✅ NUEVO: Limpiar filtros de año y mes
      if (filterAño) {
        filterAño.value = "";
      }
      
      if (filterMes) {
        filterMes.value = "";
      }
      
      // Resetear filtros activos
      filtrosActivos = {
        profesional: null,
        año: null,
        mes: null
      };

      const modalidad = localStorage.getItem('modalidadSeleccionada');
      loadClients(modalidad, null, null, null);

      menus.forEach(m => {
        m.classList.remove("show");
        m.style.display = "none";
      });
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function onDelete(id) {
  if (!confirm("¿Seguro que quieres eliminar este cliente?")) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, { 
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Error deleting:", errText);
      alert("Error al eliminar cliente");
      return;
    }
    
    const modalidad = localStorage.getItem('modalidadSeleccionada');
    const profesionalId = filterProfesionalSelect?.value || null;
    await loadClients(modalidad, profesionalId);
  } catch (err) {
    console.error("Error deleting client:", err);
    alert("Error de conexión al eliminar");
  }
}

function onEdit(id) {
  window.location.href = `index.html?edit=${id}`;
}

// Función para ir a Consulta/Seguimiento
window.onConsulta = function(id) {
  window.location.href = `consulta.html?cliente=${id}`;
};

// ✅ NUEVA FUNCIÓN: Abrir informe según modalidad (replicando comportamiento de consulta.html)
window.onInforme = async function(clienteId, modalidad) {
  console.log(`📄 Generando informe para cliente ${clienteId} en modalidad: ${modalidad}`);
  
  try {
    // Cargar datos del cliente
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!resCliente.ok) {
      alert("❌ Error al cargar datos del cliente");
      return;
    }
    
    const cliente = await resCliente.json();
    console.log("✅ Cliente cargado:", cliente.nombre);
    
    // Cargar consultas según modalidad
    if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
      // Cargar consultas SVE
      const resConsultas = await fetch(`${CONSULTAS_SVE_URL}/cliente/${clienteId}`, {
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });
      
      if (!resConsultas.ok) {
        alert("❌ No se encontraron consultas SVE");
        return;
      }
      
      const consultas = await resConsultas.json();
      console.log(`✅ Consultas SVE cargadas: ${consultas.length}`);
      
      if (!consultas || consultas.length === 0) {
        alert("ℹ️ No hay consultas SVE registradas para generar el informe");
        return;
      }
      
      // ✅ CRÍTICO: Asignar datos globales para que informeSVE.js pueda accederlos
      window.clienteActual = cliente;
      window.consultasDelCliente = consultas;
      
      // ✅ NUEVO: Crear función auxiliar para obtener clienteId
      window.getClienteIdFromContext = function() {
        return clienteId; // Retornar el ID que ya tenemos
      };
      
      // Cargar script SVE si no está disponible
      if (typeof window.generarInformeSVE !== 'function') {
        const script = document.createElement('script');
        script.src = 'js/informeSVE.js';
        script.onload = () => {
          console.log("✅ Script informeSVE.js cargado");
          // ✅ Pasar clienteId como parámetro
          window.generarInformeSVE(clienteId);
        };
        script.onerror = () => {
          console.error("❌ Error cargando informeSVE.js");
          alert("❌ Error al cargar el generador de informes SVE");
        };
        document.head.appendChild(script);
      } else {
        // ✅ Pasar clienteId como parámetro
        window.generarInformeSVE(clienteId);
      }
    } else {
      // Orientación Psicosocial (código existente sin cambios)
      const resConsultas = await fetch(`${CONSULTAS_URL}/cliente/${clienteId}`, {
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });
      
      if (!resConsultas.ok) {
        alert("❌ No se encontraron consultas");
        return;
      }
      
      const consultas = await resConsultas.json();
      console.log(`✅ Consultas cargadas: ${consultas.length}`);
      
      if (!consultas || consultas.length === 0) {
        alert("ℹ️ No hay consultas registradas para generar el informe");
        return;
      }
      
      // Verificar que el caso esté cerrado
      if (!cliente.fecha_cierre) {
        alert("⚠️ El caso debe estar cerrado para generar el informe.\n\nPor favor, cierra el caso desde el formulario de consulta seleccionando estado 'Cerrado' y estableciendo una fecha de cierre.");
        return;
      }
      
      console.log("✅ Caso cerrado, generando informe...");
      
      // Asignar datos globales (tal como lo hace consulta.html)
      window.clienteActual = cliente;
      window.consultasDelCliente = consultas;
      
      // Cargar script de informe si no está disponible
      if (typeof window.generarInformePaciente !== 'function') {
        const script = document.createElement('script');
        script.src = 'js/informe.js';
        script.onload = () => {
          console.log("✅ Script informe.js cargado");
          window.generarInformePaciente();
        };
        script.onerror = () => {
          console.error("❌ Error cargando informe.js");
          alert("❌ Error al cargar el generador de informes");
        };
        document.head.appendChild(script);
      } else {
        window.generarInformePaciente();
      }
    }
    
  } catch (err) {
    console.error("❌ Error generando informe:", err);
    alert("❌ Error al generar el informe: " + err.message);
  }
};