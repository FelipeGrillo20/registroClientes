// js/trazabilidad.js

const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;

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

let allClients = [];

// Catálogo de entidades según tipo (mismo que en script.js)
const ENTIDADES = {
  ARL: ['Sura', 'Positiva', 'Colpatria', 'Bolívar', 'Colmena'],
  CCF: ['Colsubsidio', 'Compensar', 'CAFAM', 'Comfama']
};

// Función para obtener token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Cargar clientes al iniciar
document.addEventListener("DOMContentLoaded", () => {
  loadClients();
  setupFilterEvents();
});

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

// Poblar filtros de Sede, Empresa y Subcontratista
function populateFilterOptions() {
  // Sedes únicas
  const sedes = [...new Set(allClients.map(c => c.sede).filter(Boolean))];
  fillSelect(filterSede, sedes, "Sede");
  
  // Empresas únicas (cliente_final)
  const empresas = [...new Set(allClients.map(c => c.cliente_final).filter(Boolean))];
  fillSelect(filterEmpresa, empresas, "Empresa");
  
  // Subcontratistas únicos (subcontratista_nombre o subcontratista_definitivo)
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
    
    // Badge de nombre cliente (entidad específica)
    let nombreClienteBadge = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      // Si es Particular, mostrar el nombre de la empresa (cliente_final)
      nombreClienteBadge = client.cliente_final ? 
        `<span class="badge badge-nombre-cliente">${escapeHtml(client.cliente_final)}</span>` : 
        '-';
    } else {
      // Si es ARL o CCF, mostrar la entidad específica
      nombreClienteBadge = client.entidad_pagadora_especifica ? 
        `<span class="badge badge-nombre-cliente">${escapeHtml(client.entidad_pagadora_especifica)}</span>` : 
        '-';
    }
    
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
  // ============================================
  // FILTRO EN CASCADA: Tipo Cliente → Nombre Cliente
  // ============================================
  filterTipoCliente.addEventListener("change", function() {
    const tipoSeleccionado = this.value;
    
    // Limpiar el segundo filtro
    filterNombreCliente.innerHTML = '<option value="">Todos</option>';
    
    if (tipoSeleccionado === "Particular" || tipoSeleccionado === "") {
      // Si es Particular o "Todos", ocultar segundo filtro
      filterNombreClienteContainer.style.display = "none";
      filterNombreCliente.value = "";
    } else if (tipoSeleccionado === "ARL" || tipoSeleccionado === "CCF") {
      // Si es ARL o CCF, mostrar y cargar opciones
      filterNombreClienteContainer.style.display = "block";
      labelNombreCliente.textContent = `Seleccione ${tipoSeleccionado}:`;
      
      // Cargar opciones según el tipo
      const opciones = ENTIDADES[tipoSeleccionado];
      opciones.forEach(entidad => {
        const option = document.createElement("option");
        option.value = entidad;
        option.textContent = entidad;
        filterNombreCliente.appendChild(option);
      });
    }
    
    // Aplicar filtros
    applyFilters();
  });
  
  // Eventos para los demás filtros
  filterNombreCliente.addEventListener("change", applyFilters);
  filterVinculo.addEventListener("change", applyFilters);
  filterSede.addEventListener("change", applyFilters);
  filterEmpresa.addEventListener("change", applyFilters);
  filterSubcontratista.addEventListener("change", applyFilters);
  
  // Botón limpiar filtros
  btnClearFilters.addEventListener("click", clearAllFilters);
}

// Aplicar todos los filtros
function applyFilters() {
  let filtered = [...allClients];
  
  const tipoVal = filterTipoCliente.value;
  const nombreVal = filterNombreCliente.value;
  const vinculoVal = filterVinculo.value;
  const sedeVal = filterSede.value;
  const empresaVal = filterEmpresa.value;
  const subcontratistaVal = filterSubcontratista.value;
  
  // Filtro por tipo de cliente
  if (tipoVal) {
    filtered = filtered.filter(c => c.tipo_entidad_pagadora === tipoVal);
  }
  
  // Filtro por nombre cliente (entidad específica)
  if (nombreVal) {
    filtered = filtered.filter(c => c.entidad_pagadora_especifica === nombreVal);
  }
  
  // Filtro por vínculo
  if (vinculoVal) {
    filtered = filtered.filter(c => c.vinculo === vinculoVal);
  }
  
  // Filtro por sede
  if (sedeVal) {
    filtered = filtered.filter(c => c.sede === sedeVal);
  }
  
  // Filtro por empresa (cliente_final)
  if (empresaVal) {
    filtered = filtered.filter(c => c.cliente_final === empresaVal);
  }
  
  // Filtro por subcontratista
  if (subcontratistaVal) {
    if (subcontratistaVal === "NO_APLICA") {
      // Filtrar solo los que NO tienen subcontratista
      filtered = filtered.filter(c => !c.subcontratista_id && !c.subcontratista_nombre && !c.subcontratista_definitivo);
    } else {
      // Filtrar por el subcontratista específico
      filtered = filtered.filter(c => {
        const subName = c.subcontratista_definitivo || c.subcontratista_nombre;
        return subName === subcontratistaVal;
      });
    }
  }
  
  // Renderizar resultados filtrados
  renderClients(filtered);
  
  // Actualizar estadísticas con los datos filtrados
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
  
  // Renderizar todos los clientes
  renderClients(allClients);
  
  // Actualizar estadísticas
  updateStatistics(allClients);
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