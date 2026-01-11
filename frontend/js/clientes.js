// js/clientes.js
const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;
const EMPRESAS_URL = window.API_CONFIG.ENDPOINTS.EMPRESAS;

const tbody = document.getElementById("clientList");
const filterCedula = document.getElementById("filterCedula");
const filterSede = document.getElementById("filterSede");
const filterVinculo = document.getElementById("filterVinculo");
const filterEmpresa = document.getElementById("filterEmpresa");

let allClients = [];
let allEmpresas = [];

// Función para obtener token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// ✅ NUEVA FUNCIÓN: Verificar y mostrar modalidad seleccionada
function verificarYMostrarModalidad() {
  const modalidadSeleccionada = localStorage.getItem('modalidadSeleccionada');
  
  if (!modalidadSeleccionada) {
    alert('⚠️ Debes seleccionar una modalidad antes de ver trabajadores');
    window.location.href = 'modalidad.html';
    return null;
  }
  
  // ✅ Actualizar el título de la página según la modalidad
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
  // ✅ NUEVO: Verificar modalidad al cargar
  const modalidad = verificarYMostrarModalidad();
  if (!modalidad) return;
  
  loadClients(modalidad);
  loadEmpresas();
  setupFilterEvents();
});

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

// ✅ ACTUALIZADO: Cargar clientes CON filtro de modalidad
async function loadClients(modalidad) {
  tbody.innerHTML = `<tr><td colspan="8" class="no-data">Cargando clientes...</td></tr>`;
  
  try {
    // ✅ NUEVO: Agregar parámetro de modalidad a la petición
    const url = `${API_URL}?modalidad=${encodeURIComponent(modalidad)}`;
    
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">Error al cargar clientes</td></tr>`;
      return;
    }
    
    const clients = await res.json();
    
    if (!Array.isArray(clients) || clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">No hay clientes registrados en esta modalidad</td></tr>`;
      return;
    }

    // Ordenar clientes por ID descendente (último ingresado primero)
    const sortedClients = clients.sort((a, b) => b.id - a.id);
    
    allClients = sortedClients;
    renderClients(allClients);
    populateFilterOptions(allClients);
  } catch (err) {
    console.error("Error loading clients:", err);
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">Error de conexión al cargar clientes</td></tr>`;
  }
}

async function renderClients(list) {
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">No se encontraron clientes con esos filtros</td></tr>`;
    return;
  }

  for (const c of list) {
    const tr = document.createElement("tr");

    // Determinar badge de vínculo
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
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
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
  // Restaurar valor seleccionado si existía
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
  // Asegurar que todos los menús estén ocultos al inicio
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

      // Cerrar todos los demás menús
      menus.forEach(m => {
        if (m !== menu) {
          m.classList.remove("show");
          m.style.display = "none";
        }
      });

      // Alternar visibilidad del menú actual
      if (menu.classList.contains("show")) {
        menu.classList.remove("show");
        menu.style.display = "none";
      } else {
        menu.classList.add("show");
        menu.style.display = "block";
      }
    });
  });

  // Cerrar menús al hacer clic fuera
  document.addEventListener("click", e => {
    if (!e.target.closest(".filterable")) {
      menus.forEach(m => {
        m.classList.remove("show");
        m.style.display = "none";
      });
    }
  });

  // Prevenir que clicks dentro del menú lo cierren
  menus.forEach(menu => {
    menu.addEventListener("click", e => {
      e.stopPropagation();
    });
  });

  // Aplicar filtros
  filterCedula.addEventListener("input", applyFilters);
  
  [filterSede, filterVinculo, filterEmpresa].forEach(select => {
    select.addEventListener("change", () => {
      applyFilters();
      // Cerrar el menú correspondiente
      const filterType = select.id.replace('filter', '').toLowerCase();
      const menu = document.getElementById(`filterMenu-${filterType}`);
      if (menu) {
        menu.classList.remove("show");
        menu.style.display = "none";
      }
    });
  });

  // Botón para limpiar filtros
  const btnClearFilters = document.getElementById("btnClearFilters");
  if (btnClearFilters) {
    btnClearFilters.addEventListener("click", () => {
      // Limpiar todos los selectores y inputs
      filterCedula.value = "";
      filterSede.value = "";
      filterVinculo.value = "";
      filterEmpresa.value = "";

      // Mostrar todos los clientes
      renderClients(allClients);

      // Cerrar todos los menús abiertos
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
    
    // ✅ NUEVO: Recargar con modalidad actual
    const modalidad = localStorage.getItem('modalidadSeleccionada');
    await loadClients(modalidad);
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