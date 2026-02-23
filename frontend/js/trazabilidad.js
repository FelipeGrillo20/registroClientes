// js/trazabilidad.js

const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;
const API_USERS = window.API_CONFIG.ENDPOINTS.AUTH.USERS;
const API_CONSULTAS = window.API_CONFIG.ENDPOINTS.CONSULTAS;

const tbody = document.getElementById("trazabilidadList");
const filterTipoCliente = document.getElementById("filterTipoCliente");
const filterNombreCliente = document.getElementById("filterNombreCliente");
const filterNombreClienteContainer = document.getElementById("filterNombreClienteContainer");
const labelNombreCliente = document.getElementById("labelNombreCliente");
const filterVinculo = document.getElementById("filterVinculo");
const filterSede = document.getElementById("filterSede");
const filterEmpresa = document.getElementById("filterEmpresa");
const filterSubcontratista = document.getElementById("filterSubcontratista");
const btnClearFilters = document.getElementById("btnClearFilters");
const noDataMessage = document.getElementById("noDataMessage");
const tableContainer = document.querySelector(".table-container");

// ⭐ NUEVOS: Elementos de filtros avanzados
const adminFiltersContainer = document.getElementById("adminFiltersContainer");
const filterProfesional = document.getElementById("filterProfesional");
const filterMes = document.getElementById("filterMes");
const filterFechaInicio = document.getElementById("filterFechaInicio");
const filterFechaFin = document.getElementById("filterFechaFin");
const btnApplyAdvancedFilters = document.getElementById("btnApplyAdvancedFilters");
const btnClearAdvancedFilters = document.getElementById("btnClearAdvancedFilters");

// ⭐ NUEVO: Elementos de estadísticas del profesional
// ⭐ COMENTADO TEMPORALMENTE - Estadísticas del Profesional
// const statsProfesionalContainer = document.getElementById("statsProfesionalContainer");
// const statsProfesionalNombre = document.getElementById("statsProfesionalNombre");
// const statPacientesAtendidos = document.getElementById("statPacientesAtendidos");
// const statSesionesRealizadas = document.getElementById("statSesionesRealizadas");
// const statHorasAtendidas = document.getElementById("statHorasAtendidas");
// const statCasosCerrados = document.getElementById("statCasosCerrados");

let allClients = [];
let currentFilteredClients = []; // ✅ Rastrea los datos visibles para exportar
let currentUserRole = null;

// Catálogo de entidades según tipo
const ENTIDADES = {
  ARL: ['Sura', 'Positiva', 'Colpatria', 'Bolívar', 'Colmena'],
  CCF: ['Colsubsidio', 'Compensar', 'CAFAM', 'Comfama']
};

// Función para obtener token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Función para obtener datos del usuario
function getUserData() {
  const userData = localStorage.getItem("userData");
  return userData ? JSON.parse(userData) : null;
}

// Cargar clientes al iniciar
document.addEventListener("DOMContentLoaded", async () => {
  // Verificar rol del usuario
  const userData = getUserData();
  currentUserRole = userData?.rol;
  
  // Si es admin, mostrar filtros avanzados
  if (currentUserRole === 'admin') {
    adminFiltersContainer.style.display = "block";
    await loadProfesionales();
  }
  
  await loadClients();
  setupFilterEvents();
});

// ⭐ NUEVO: Cargar lista de profesionales (solo para admin)
async function loadProfesionales() {
  try {
    const res = await fetch(API_USERS, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error("Error al cargar profesionales");
    }
    
    const data = await res.json();
    
    // El backend devuelve { success: true, users: [...] }
    const users = data.users || data;
    
    // Filtrar solo profesionales
    const profesionales = users.filter(u => u.rol === 'profesional');
    
    // Llenar el select
    filterProfesional.innerHTML = '<option value="">Todos los Profesionales</option>';
    profesionales.forEach(prof => {
      const option = document.createElement("option");
      option.value = prof.id;
      option.textContent = prof.nombre;
      filterProfesional.appendChild(option);
    });
    
  } catch (err) {
    console.error("Error cargando profesionales:", err);
  }
}

// Cargar todos los clientes
async function loadClients() {
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">Cargando datos...</td></tr>`;
  console.log("🔄 Cargando clientes para trazabilidad...");
  
  try {
    const res = await fetch(API_URL, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error("Error al cargar clientes");
    }
    
    const clients = await res.json();
    
    if (!Array.isArray(clients) || clients.length === 0) {
      showNoData();
      updateStats(0, 0, 0, 0);
      return;
    }

    // Ordenar por ID descendente
    allClients = clients.sort((a, b) => b.id - a.id);
    
    // Poblar filtros dinámicos
    populateFilterOptions();
    
    // Renderizar todos los clientes inicialmente
    renderClients(allClients);
    
    // Actualizar estadísticas
    updateStatistics(allClients);
    
  } catch (err) {
    console.error("Error loading clients:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">Error al cargar datos</td></tr>`;
  }
}

// ⭐ NUEVO: Aplicar filtros avanzados (profesional y fechas)
async function applyAdvancedFilters() {
  const profesionalId = filterProfesional.value;
  const mesSeleccionado = filterMes.value;
  let fechaInicio = filterFechaInicio.value;
  let fechaFin = filterFechaFin.value;
  
  // Si se seleccionó un mes predefinido, calcular las fechas
  if (mesSeleccionado) {
    const fechas = calcularRangoFechas(mesSeleccionado);
    fechaInicio = fechas.inicio;
    fechaFin = fechas.fin;
    
    // Actualizar los inputs de fecha
    filterFechaInicio.value = fechaInicio;
    filterFechaFin.value = fechaFin;
  }
  
  // Construir query string
  const params = new URLSearchParams();
  if (profesionalId) params.append('profesional_id', profesionalId);
  if (fechaInicio) params.append('fecha_inicio', fechaInicio);
  if (fechaFin) params.append('fecha_fin', fechaFin);
  
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">Filtrando datos...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/filters?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error("Error al filtrar clientes");
    }
    
    const clients = await res.json();
    
    if (!Array.isArray(clients) || clients.length === 0) {
      showNoData();
      updateStats(0, 0, 0, 0);
      // hideStatsProfesional(); // ⭐ COMENTADO TEMPORALMENTE
      return;
    }
    
    // Ordenar por ID descendente
    allClients = clients.sort((a, b) => b.id - a.id);
    
    // Poblar filtros dinámicos
    populateFilterOptions();
    
    // Renderizar clientes filtrados
    renderClients(allClients);
    
    // Actualizar estadísticas
    updateStatistics(allClients);
    
    // ⭐ COMENTADO TEMPORALMENTE - Estadísticas del Profesional
    // if (profesionalId) {
    //   await loadStatsProfesional(profesionalId);
    // } else {
    //   hideStatsProfesional();
    // }
    
  } catch (err) {
    console.error("Error aplicando filtros avanzados:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">Error al filtrar datos</td></tr>`;
    // hideStatsProfesional(); // ⭐ COMENTADO TEMPORALMENTE
  }
}

// ⭐ NUEVO: Calcular rango de fechas según opción seleccionada
function calcularRangoFechas(opcion) {
  const hoy = new Date();
  let inicio, fin;
  
  switch(opcion) {
    case 'mes_actual':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      break;
      
    case 'mes_anterior':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      break;
      
    case 'ultimos_3_meses':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
      fin = hoy;
      break;
      
    case 'ultimos_6_meses':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1);
      fin = hoy;
      break;
      
    case 'este_año':
      inicio = new Date(hoy.getFullYear(), 0, 1);
      fin = hoy;
      break;
      
    default:
      return { inicio: '', fin: '' };
  }
  
  return {
    inicio: formatearFecha(inicio),
    fin: formatearFecha(fin)
  };
}

// Formatear fecha a YYYY-MM-DD
function formatearFecha(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ⭐ NUEVO: Limpiar filtros avanzados
function clearAdvancedFilters() {
  filterProfesional.value = "";
  filterMes.value = "";
  filterFechaInicio.value = "";
  filterFechaFin.value = "";
  
  // Ocultar estadísticas del profesional
  // hideStatsProfesional(); // ⭐ COMENTADO TEMPORALMENTE
  
  // Recargar todos los clientes
  loadClients();
}

// Poblar filtros de Sede, Empresa y Subcontratista
function populateFilterOptions() {
  // Sedes únicas
  const sedes = [...new Set(allClients.map(c => c.sede).filter(Boolean))];
  fillSelect(filterSede, sedes, "Sede");
  
  // Empresas únicas (cliente_final)
  const empresas = [...new Set(allClients.map(c => c.cliente_final).filter(Boolean))];
  fillSelect(filterEmpresa, empresas, "Empresa");
  
  // Subcontratistas únicos
  const subcontratistas = [...new Set(
    allClients
      .map(c => c.subcontratista_definitivo || c.subcontratista_nombre)
      .filter(Boolean)
  )].sort();
  
  // Llenar select de subcontratistas
  filterSubcontratista.innerHTML = `
    <option value="">Todos los Subcontratistas</option>
    <option value="NO_APLICA">Sin Subcontratista</option>
  `;
  subcontratistas.forEach(sub => {
    const option = document.createElement("option");
    option.value = sub;
    option.textContent = sub;
    filterSubcontratista.appendChild(option);
  });
}

// Llenar select con opciones
function fillSelect(selectElem, items, placeholder) {
  selectElem.innerHTML = `<option value="">Todas las ${placeholder}s</option>`;
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    selectElem.appendChild(option);
  });
}

// Renderizar clientes en la tabla
function renderClients(clients) {
  // ✅ Actualizar lista de datos visibles para exportación
  currentFilteredClients = clients || [];
  tbody.innerHTML = "";
  
  if (!clients || clients.length === 0) {
    showNoData();
    return;
  }
  
  hideNoData();
  
  clients.forEach(client => {
    const tr = document.createElement("tr");
    
    // Badge de vínculo
    let vinculoBadge = '-';
    if (client.vinculo === 'Trabajador') {
      vinculoBadge = '<span class="badge badge-vinculo-trabajador">Trabajador</span>';
    } else if (client.vinculo === 'Familiar Trabajador') {
      vinculoBadge = '<span class="badge badge-vinculo-familiar">Familiar</span>';
    }
    
    // Badge de empresa
    let empresaBadge = client.cliente_final ? 
      `<span class="badge badge-empresa">${escapeHtml(client.cliente_final)}</span>` : 
      '-';
    
    // Badge de subcontratista
    let subcontratistaBadge = '-';
    const subcontratistaName = client.subcontratista_definitivo || client.subcontratista_nombre;
    if (subcontratistaName) {
      subcontratistaBadge = `<span class="badge badge-subcontratista">${escapeHtml(subcontratistaName)}</span>`;
    } else {
      subcontratistaBadge = '<span class="badge badge-no-subcontratista">N/A</span>';
    }
    
    // Badge de tipo cliente
    let tipoBadge = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      tipoBadge = '<span class="badge badge-tipo-particular">Particular</span>';
    } else if (client.tipo_entidad_pagadora === 'ARL') {
      tipoBadge = '<span class="badge badge-tipo-arl">ARL</span>';
    } else if (client.tipo_entidad_pagadora === 'CCF') {
      tipoBadge = '<span class="badge badge-tipo-ccf">CCF</span>';
    }
    
    // Badge de nombre cliente
    let nombreClienteBadge = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      nombreClienteBadge = client.cliente_final ? 
        `<span class="badge badge-nombre-cliente">${escapeHtml(client.cliente_final)}</span>` : 
        '-';
    } else {
      nombreClienteBadge = client.entidad_pagadora_especifica ? 
        `<span class="badge badge-nombre-cliente">${escapeHtml(client.entidad_pagadora_especifica)}</span>` : 
        '-';
    }
    
    // ⭐ NUEVO: Badge de profesional (COMENTADO - no se muestra en la tabla)
    /*
    let profesionalBadge = client.profesional_nombre ? 
      `<span class="badge badge-profesional">${escapeHtml(client.profesional_nombre)}</span>` : 
      '-';
    */
    
    // ⭐ NUEVO: Fecha de registro (COMENTADO - no se muestra en la tabla)
    /*
    let fechaRegistro = '-';
    if (client.created_at) {
      const fecha = new Date(client.created_at);
      fechaRegistro = fecha.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
    */
    
    tr.innerHTML = `
      <td>${tipoBadge}</td>
      <td>${nombreClienteBadge}</td>
      <td>${empresaBadge}</td>
      <td>${subcontratistaBadge}</td>
      <td>${vinculoBadge}</td>
      <td>${escapeHtml(client.sede || '-')}</td>
      <td>${escapeHtml(client.nombre || '-')}</td>
      <td>${escapeHtml(client.cedula || '-')}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// Mostrar mensaje sin datos
function showNoData() {
  tableContainer.style.display = "none";
  noDataMessage.style.display = "block";
}

// Ocultar mensaje sin datos
function hideNoData() {
  tableContainer.style.display = "block";
  noDataMessage.style.display = "none";
}

// Actualizar estadísticas
function updateStatistics(clients) {
  const total = clients.length;
  const particular = clients.filter(c => c.tipo_entidad_pagadora === 'Particular').length;
  const arl = clients.filter(c => c.tipo_entidad_pagadora === 'ARL').length;
  const ccf = clients.filter(c => c.tipo_entidad_pagadora === 'CCF').length;
  
  updateStats(total, particular, arl, ccf);
}

// Actualizar valores de estadísticas
function updateStats(total, particular, arl, ccf) {
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statParticular").textContent = particular;
  document.getElementById("statARL").textContent = arl;
  document.getElementById("statCCF").textContent = ccf;
}

// Configurar eventos de filtros
function setupFilterEvents() {
  // ⭐ NUEVO: Eventos para filtros avanzados
  if (btnApplyAdvancedFilters) {
    btnApplyAdvancedFilters.addEventListener("click", applyAdvancedFilters);
  }
  
  if (btnClearAdvancedFilters) {
    btnClearAdvancedFilters.addEventListener("click", clearAdvancedFilters);
  }
  
  // Cuando se selecciona un mes, limpiar las fechas manuales
  if (filterMes) {
    filterMes.addEventListener("change", function() {
      if (this.value) {
        filterFechaInicio.value = "";
        filterFechaFin.value = "";
      }
    });
  }
  
  // Cuando se seleccionan fechas manuales, limpiar el selector de mes
  if (filterFechaInicio) {
    filterFechaInicio.addEventListener("change", function() {
      if (this.value) {
        filterMes.value = "";
      }
    });
  }
  
  if (filterFechaFin) {
    filterFechaFin.addEventListener("change", function() {
      if (this.value) {
        filterMes.value = "";
      }
    });
  }
  
  // Filtros en cascada existentes
  filterTipoCliente.addEventListener("change", function() {
    const tipoSeleccionado = this.value;
    
    filterNombreCliente.innerHTML = '<option value="">Todos</option>';
    
    if (tipoSeleccionado === "Particular" || tipoSeleccionado === "") {
      filterNombreClienteContainer.style.display = "none";
      filterNombreCliente.value = "";
    } else if (tipoSeleccionado === "ARL" || tipoSeleccionado === "CCF") {
      filterNombreClienteContainer.style.display = "block";
      labelNombreCliente.textContent = `Seleccione ${tipoSeleccionado}:`;
      
      const opciones = ENTIDADES[tipoSeleccionado];
      opciones.forEach(entidad => {
        const option = document.createElement("option");
        option.value = entidad;
        option.textContent = entidad;
        filterNombreCliente.appendChild(option);
      });
    }
    
    applyFilters();
  });
  
  filterNombreCliente.addEventListener("change", applyFilters);
  filterVinculo.addEventListener("change", applyFilters);
  filterSede.addEventListener("change", applyFilters);
  filterEmpresa.addEventListener("change", applyFilters);
  filterSubcontratista.addEventListener("change", applyFilters);
  
  btnClearFilters.addEventListener("click", clearAllFilters);
}

// Aplicar todos los filtros (locales)
function applyFilters() {
  let filtered = [...allClients];
  
  const tipoVal = filterTipoCliente.value;
  const nombreVal = filterNombreCliente.value;
  const vinculoVal = filterVinculo.value;
  const sedeVal = filterSede.value;
  const empresaVal = filterEmpresa.value;
  const subcontratistaVal = filterSubcontratista.value;
  
  if (tipoVal) {
    filtered = filtered.filter(c => c.tipo_entidad_pagadora === tipoVal);
  }
  
  if (nombreVal) {
    filtered = filtered.filter(c => c.entidad_pagadora_especifica === nombreVal);
  }
  
  if (vinculoVal) {
    filtered = filtered.filter(c => c.vinculo === vinculoVal);
  }
  
  if (sedeVal) {
    filtered = filtered.filter(c => c.sede === sedeVal);
  }
  
  if (empresaVal) {
    filtered = filtered.filter(c => c.cliente_final === empresaVal);
  }
  
  if (subcontratistaVal) {
    if (subcontratistaVal === "NO_APLICA") {
      filtered = filtered.filter(c => !c.subcontratista_id && !c.subcontratista_nombre && !c.subcontratista_definitivo);
    } else {
      filtered = filtered.filter(c => {
        const subName = c.subcontratista_definitivo || c.subcontratista_nombre;
        return subName === subcontratistaVal;
      });
    }
  }
  
  renderClients(filtered);
  updateStatistics(filtered);
}

// Limpiar todos los filtros
function clearAllFilters() {
  filterTipoCliente.value = "";
  filterNombreCliente.value = "";
  filterNombreClienteContainer.style.display = "none";
  filterVinculo.value = "";
  filterSede.value = "";
  filterEmpresa.value = "";
  filterSubcontratista.value = "";
  
  renderClients(allClients);
  updateStatistics(allClients);
}

// ✅ FUNCIÓN: Exportar datos visibles a Excel
function exportarExcel() {
  const datos = currentFilteredClients;

  if (!datos || datos.length === 0) {
    alert('⚠️ No hay datos para exportar. Aplica los filtros primero o espera a que carguen los registros.');
    return;
  }

  // Mapear cada cliente a una fila con las 8 columnas de la tabla
  const filas = datos.map(client => {
    // Tipo Cliente
    const tipoCliente = client.tipo_entidad_pagadora || '-';

    // Nombre Cliente (empresa o entidad pagadora según tipo)
    let nombreCliente = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      nombreCliente = client.cliente_final || '-';
    } else {
      nombreCliente = client.entidad_pagadora_especifica || '-';
    }

    // Empresa Usuario
    const empresaUsuario = client.cliente_final || '-';

    // Cliente Final (subcontratista, N/A si no aplica)
    const subcontratistaName = client.subcontratista_definitivo || client.subcontratista_nombre;
    const clienteFinal = subcontratistaName || 'N/A';

    // Vínculo
    const vinculo = client.vinculo || '-';

    // Sede
    const sede = client.sede || '-';

    // Nombre trabajador
    const nombre = client.nombre || '-';

    // Cédula
    const cedula = client.cedula || '-';

    return {
      'Tipo Cliente':    tipoCliente,
      'Nombre Cliente':  nombreCliente,
      'Empresa Usuario': empresaUsuario,
      'Cliente Final':   clienteFinal,
      'Vínculo':         vinculo,
      'Sede':            sede,
      'Nombre':          nombre,
      'Cédula':          String(cedula)  // Forzar texto para no perder ceros a la izquierda
    };
  });

  // Crear libro y hoja de Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  // Ajustar ancho de columnas automáticamente
  const colWidths = [
    { wch: 14 }, // Tipo Cliente
    { wch: 30 }, // Nombre Cliente
    { wch: 30 }, // Empresa Usuario
    { wch: 30 }, // Cliente Final
    { wch: 18 }, // Vínculo
    { wch: 16 }, // Sede
    { wch: 28 }, // Nombre
    { wch: 14 }, // Cédula
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Trazabilidad');

  // Nombre del archivo con fecha
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  const nombreArchivo = `Trazabilidad_Pagos_${fecha}.xlsx`;

  XLSX.writeFile(wb, nombreArchivo);
  console.log(`✅ Exportado: ${nombreArchivo} con ${filas.length} registros`);
}

// Escape HTML para seguridad
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ⭐ COMENTADO TEMPORALMENTE - Estadísticas del Profesional
/* async function loadStatsProfesional(profesionalId) {
  try {
    console.log("📊 Cargando estadísticas del profesional:", profesionalId);
    console.log("📡 URL:", `${API_CONSULTAS}/estadisticas-profesional?profesional_id=${profesionalId}`);
    
    const res = await fetch(`${API_CONSULTAS}/estadisticas-profesional?profesional_id=${profesionalId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    console.log("📥 Response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Error response:", errorText);
      throw new Error("Error al cargar estadísticas del profesional");
    }
    
    const stats = await res.json();
    console.log("✅ Estadísticas recibidas:", stats);
    
    // Obtener nombre del profesional
    const profesionalSelect = document.getElementById("filterProfesional");
    const profesionalNombre = profesionalSelect.options[profesionalSelect.selectedIndex].text;
    
    console.log("👤 Nombre profesional:", profesionalNombre);
    
    // Mostrar estadísticas
    showStatsProfesional(profesionalNombre, stats);
    
  } catch (err) {
    console.error("❌ Error cargando estadísticas del profesional:", err);
    hideStatsProfesional();
  }
}

// ⭐ NUEVO: Mostrar estadísticas del profesional
function showStatsProfesional(nombre, stats) {
  statsProfesionalNombre.textContent = nombre;
  statPacientesAtendidos.textContent = stats.pacientes_atendidos || 0;
  statSesionesRealizadas.textContent = stats.total_consultas || 0;
  statHorasAtendidas.textContent = stats.total_consultas || 0;
  statCasosCerrados.textContent = stats.casos_cerrados || 0;
  
  statsProfesionalContainer.style.display = "block";
  
  // Animación suave
  statsProfesionalContainer.style.opacity = "0";
  setTimeout(() => {
    statsProfesionalContainer.style.opacity = "1";
  }, 100);
}

// ⭐ NUEVO: Ocultar estadísticas del profesional
function hideStatsProfesional() {
  if (statsProfesionalContainer) {
    statsProfesionalContainer.style.display = "none";
  }
}
*/ // FIN BLOQUE COMENTADO - Estadísticas del Profesional