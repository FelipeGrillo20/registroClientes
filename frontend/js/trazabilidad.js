// js/trazabilidad.js

const API_URL        = window.API_CONFIG.ENDPOINTS.CLIENTS;
const API_USERS      = window.API_CONFIG.ENDPOINTS.AUTH.USERS;
const API_CONSULTAS  = window.API_CONFIG.ENDPOINTS.CONSULTAS;

// ─── Referencias DOM ────────────────────────────────────────────────────────
const tbody                        = document.getElementById("trazabilidadList");
const filterTipoCliente            = document.getElementById("filterTipoCliente");
const filterNombreCliente          = document.getElementById("filterNombreCliente");
const filterNombreClienteContainer = document.getElementById("filterNombreClienteContainer");
const labelNombreCliente           = document.getElementById("labelNombreCliente");
const filterVinculo                = document.getElementById("filterVinculo");
const filterSede                   = document.getElementById("filterSede");
const filterEmpresa                = document.getElementById("filterEmpresa");
const filterSubcontratista         = document.getElementById("filterSubcontratista");
const btnClearFilters              = document.getElementById("btnClearFilters");
const noDataMessage                = document.getElementById("noDataMessage");
const tableContainer               = document.querySelector(".table-container");

// Filtros avanzados (admin)
const adminFiltersContainer  = document.getElementById("adminFiltersContainer");
const filterProfesional      = document.getElementById("filterProfesional");
const filterMes              = document.getElementById("filterMes");
const filterFechaInicio      = document.getElementById("filterFechaInicio");
const filterFechaFin         = document.getElementById("filterFechaFin");
const btnApplyAdvancedFilters = document.getElementById("btnApplyAdvancedFilters");
const btnClearAdvancedFilters = document.getElementById("btnClearAdvancedFilters");

// ─── Estado global ───────────────────────────────────────────────────────────
let allClients          = [];   // Lista base de clientes cargados
let allConsultas        = [];   // Todas las consultas cargadas
let allProfesionales    = [];   // Lista de profesionales (para cruzar nombre)
let matrizRows          = [];   // Filas combinadas (1 fila por sesión)
let currentFilteredRows = [];   // Filas visibles (para exportar)
let currentUserRole     = null;

const ENTIDADES = {
  ARL: ['Sura', 'Positiva', 'Colpatria', 'Bolívar', 'Colmena'],
  CCF: ['Colsubsidio', 'Compensar', 'CAFAM', 'Comfama']
};

// ─── Helpers de autenticación ────────────────────────────────────────────────
function getAuthToken() {
  return localStorage.getItem("authToken");
}

function getUserData() {
  const userData = localStorage.getItem("userData");
  return userData ? JSON.parse(userData) : null;
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const userData    = getUserData();
  currentUserRole   = userData?.rol;

  if (currentUserRole === 'admin') {
    adminFiltersContainer.style.display = "block";
    await loadProfesionales();
  }

  await loadData();
  setupFilterEvents();
});

// ─── Cargar lista de profesionales ──────────────────────────────────────────
async function loadProfesionales() {
  try {
    const res = await fetch(API_USERS, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Error al cargar profesionales");

    const data = await res.json();
    const users = data.users || data;
    // Incluir profesionales y administradores (ambos pueden registrar consultas)
    allProfesionales = users.filter(u => u.rol === 'profesional' || u.rol === 'admin');

    filterProfesional.innerHTML = '<option value="">Todos los Profesionales</option>';
    allProfesionales.forEach(prof => {
      const option = document.createElement("option");
      option.value = prof.id;
      option.textContent = prof.rol === 'admin' ? `${prof.nombre} 👑` : prof.nombre;
      filterProfesional.appendChild(option);
    });

  } catch (err) {
    console.error("Error cargando profesionales:", err);
  }
}

// ─── Cargar datos principales (clientes + consultas) ─────────────────────────
async function loadData() {
  tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:40px;">Cargando datos...</td></tr>`;

  try {
    // Petición de clientes y consultas en paralelo
    const [resClients, resConsultas] = await Promise.all([
      fetch(API_URL, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      }),
      fetch(API_CONSULTAS, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      })
    ]);

    if (!resClients.ok)   throw new Error("Error al cargar clientes");
    if (!resConsultas.ok) throw new Error("Error al cargar consultas");

    const clients  = await resClients.json();
    const consultas = await resConsultas.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      showNoData();
      updateStats([]);
      return;
    }

    allClients   = clients.sort((a, b) => b.id - a.id);
    allConsultas = Array.isArray(consultas) ? consultas : [];

    // Construir matriz combinada
    matrizRows = buildMatrizRows(allClients, allConsultas);

    populateFilterOptions();
    renderRows(matrizRows);
    updateStats(matrizRows);

  } catch (err) {
    console.error("Error cargando datos:", err);
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:40px;color:#e74c3c;">Error al cargar datos</td></tr>`;
  }
}

// ─── Construir filas de la matriz (1 fila por sesión) ────────────────────────
/**
 * Por cada cliente calcula el número de sesión de cada consulta
 * (ordenadas por fecha) y genera una fila combinada.
 * Si el cliente no tiene consultas, genera 1 fila sin datos de sesión.
 */
function buildMatrizRows(clients, consultas) {
  const rows = [];

  // Agrupar consultas por cliente_id
  const consultasPorCliente = {};
  consultas.forEach(c => {
    if (!consultasPorCliente[c.cliente_id]) {
      consultasPorCliente[c.cliente_id] = [];
    }
    consultasPorCliente[c.cliente_id].push(c);
  });

  clients.forEach(client => {
    const consultasCliente = consultasPorCliente[client.id] || [];

    if (consultasCliente.length === 0) {
      // Cliente sin sesiones → se omite
    } else {
      // Ordenar por fecha ascendente para numerar sesiones 1, 2, 3…
      const ordenadas = [...consultasCliente].sort((a, b) =>
        new Date(a.fecha) - new Date(b.fecha)
      );
      ordenadas.forEach((consulta, index) => {
        rows.push({ client, consulta, sesionNum: index + 1 });
      });
    }
  });

  return rows;
}

// ─── Nombre del profesional por ID ───────────────────────────────────────────
function getNombreProfesional(profesionalId) {
  if (!profesionalId) return '-';
  const prof = allProfesionales.find(p => p.id === profesionalId);
  return prof ? prof.nombre : `Prof. #${profesionalId}`;
}

// ─── Construir celda Nombre (con info del trabajador si es Familiar) ─────────
function buildNombreCell(client) {
  const nombre = escapeHtml(client.nombre || '-');

  if (client.vinculo === 'Familiar Trabajador' && client.nombre_trabajador) {
    const nombreTrabajador  = escapeHtml(client.nombre_trabajador);
    const cedulaTrabajador  = escapeHtml(client.cedula_trabajador || '');
    const relacionado = cedulaTrabajador
      ? `<span class="familiar-relacionado-titulo">- Relacionado al trabajador:</span><span class="familiar-relacionado-detalle">${nombreTrabajador} c.c. ${cedulaTrabajador}</span>`
      : `<span class="familiar-relacionado-titulo">- Relacionado al trabajador:</span><span class="familiar-relacionado-detalle">${nombreTrabajador}</span>`;
    return `${nombre} ${relacionado}`;
  }

  return nombre;
}

// ─── Renderizar filas en la tabla ────────────────────────────────────────────
function renderRows(rows) {
  currentFilteredRows = rows || [];
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    showNoData();
    return;
  }

  hideNoData();

  rows.forEach(({ client, consulta, sesionNum }) => {

    // ── Campos del cliente ───────────────────────────────────────────────────
    let tipoBadge = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      tipoBadge = '<span class="badge badge-tipo-particular">Particular</span>';
    } else if (client.tipo_entidad_pagadora === 'ARL') {
      tipoBadge = '<span class="badge badge-tipo-arl">ARL</span>';
    } else if (client.tipo_entidad_pagadora === 'CCF') {
      tipoBadge = '<span class="badge badge-tipo-ccf">CCF</span>';
    }

    let nombreClienteBadge = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      nombreClienteBadge = client.cliente_final
        ? `<span class="badge badge-nombre-cliente">${escapeHtml(client.cliente_final)}</span>`
        : '-';
    } else {
      nombreClienteBadge = client.entidad_pagadora_especifica
        ? `<span class="badge badge-nombre-cliente">${escapeHtml(client.entidad_pagadora_especifica)}</span>`
        : '-';
    }

    const empresaBadge = client.cliente_final
      ? `<span class="badge badge-empresa">${escapeHtml(client.cliente_final)}</span>`
      : '-';

    const subcontratistaName = client.subcontratista_definitivo || client.subcontratista_nombre;
    const subcontratistaBadge = subcontratistaName
      ? `<span class="badge badge-subcontratista">${escapeHtml(subcontratistaName)}</span>`
      : '<span class="badge badge-no-subcontratista">N/A</span>';

    let vinculoBadge = '-';
    if (client.vinculo === 'Trabajador') {
      vinculoBadge = '<span class="badge badge-vinculo-trabajador">Trabajador</span>';
    } else if (client.vinculo === 'Familiar Trabajador') {
      vinculoBadge = '<span class="badge badge-vinculo-familiar">Familiar</span>';
    }

    // ── Campos de la sesión ──────────────────────────────────────────────────
    let fechaConsulta = '-';
    let motivoConsulta = '-';
    let sesionNumCell = '-';
    let horasSesion = '-';
    let sesionessugeridas = '-';
    let observaciones = '-';
    let profesionalNombre = '-';

    if (consulta) {
      // Fecha consulta formateada
      if (consulta.fecha) {
        const d = new Date(consulta.fecha);
        fechaConsulta = d.toLocaleDateString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit'
        });
      }

      motivoConsulta = consulta.motivo_consulta
        ? escapeHtml(consulta.motivo_consulta)
        : '-';

      sesionNumCell = sesionNum !== null
        ? `<span class="badge badge-sesion">${sesionNum}</span>`
        : '-';

      // Cada sesión = 1 hora
      horasSesion = '1';

      // Sesiones sugeridas del cliente
      sesionessugeridas = client.consultas_sugeridas
        ? String(client.consultas_sugeridas)
        : '-';

      // Observaciones → columna1 en la tabla consultas
      observaciones = consulta.columna1
        ? escapeHtml(consulta.columna1)
        : '-';

      // Profesional que registró la consulta (viene del cliente si no hay en consulta)
      const profId = consulta.profesional_id || client.profesional_id;
      profesionalNombre = escapeHtml(getNombreProfesional(profId));
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-fecha">${fechaConsulta}</td>
      <td>${tipoBadge}</td>
      <td>${nombreClienteBadge}</td>
      <td>${empresaBadge}</td>
      <td>${subcontratistaBadge}</td>
      <td>${vinculoBadge}</td>
      <td>${escapeHtml(client.sede || '-')}</td>
      <td class="col-nombre">${buildNombreCell(client)}</td>
      <td class="col-cedula">${escapeHtml(client.cedula || '-')}</td>
      <td class="col-motivo">${motivoConsulta}</td>
      <td class="col-sesion-num">${sesionNumCell}</td>
      <td class="col-horas">${horasSesion}</td>
      <td class="col-sugeridas">${sesionessugeridas}</td>
      <td class="col-obs">${observaciones}</td>
      <td class="col-profesional">${profesionalNombre}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ─── Poblar selects dinámicos ─────────────────────────────────────────────────
function populateFilterOptions() {
  const sedes = [...new Set(allClients.map(c => c.sede).filter(Boolean))];
  fillSelect(filterSede, sedes, "Sede");

  const empresas = [...new Set(allClients.map(c => c.cliente_final).filter(Boolean))];
  fillSelect(filterEmpresa, empresas, "Empresa");

  const subcontratistas = [...new Set(
    allClients.map(c => c.subcontratista_definitivo || c.subcontratista_nombre).filter(Boolean)
  )].sort();

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

function fillSelect(selectElem, items, placeholder) {
  selectElem.innerHTML = `<option value="">Todas las ${placeholder}s</option>`;
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    selectElem.appendChild(option);
  });
}

// ─── Aplicar filtros locales (cascada) ───────────────────────────────────────
function applyFilters() {
  let filtered = [...matrizRows];

  const tipoVal          = filterTipoCliente.value;
  const nombreVal        = filterNombreCliente.value;
  const vinculoVal       = filterVinculo.value;
  const sedeVal          = filterSede.value;
  const empresaVal       = filterEmpresa.value;
  const subcontratistaVal = filterSubcontratista.value;

  if (tipoVal) {
    filtered = filtered.filter(r => r.client.tipo_entidad_pagadora === tipoVal);
  }

  if (nombreVal) {
    filtered = filtered.filter(r => r.client.entidad_pagadora_especifica === nombreVal);
  }

  if (vinculoVal) {
    filtered = filtered.filter(r => r.client.vinculo === vinculoVal);
  }

  if (sedeVal) {
    filtered = filtered.filter(r => r.client.sede === sedeVal);
  }

  if (empresaVal) {
    filtered = filtered.filter(r => r.client.cliente_final === empresaVal);
  }

  if (subcontratistaVal) {
    if (subcontratistaVal === "NO_APLICA") {
      filtered = filtered.filter(r =>
        !r.client.subcontratista_id && !r.client.subcontratista_nombre && !r.client.subcontratista_definitivo
      );
    } else {
      filtered = filtered.filter(r => {
        const name = r.client.subcontratista_definitivo || r.client.subcontratista_nombre;
        return name === subcontratistaVal;
      });
    }
  }

  renderRows(filtered);
  updateStats(filtered);
}

// ─── Limpiar filtros básicos ──────────────────────────────────────────────────
function clearAllFilters() {
  filterTipoCliente.value = "";
  filterNombreCliente.value = "";
  filterNombreClienteContainer.style.display = "none";
  filterVinculo.value = "";
  filterSede.value = "";
  filterEmpresa.value = "";
  filterSubcontratista.value = "";

  renderRows(matrizRows);
  updateStats(matrizRows);
}

// ─── Filtros avanzados (admin: profesional + fechas) ─────────────────────────
async function applyAdvancedFilters() {
  const profesionalId   = filterProfesional.value;
  const mesSeleccionado = filterMes.value;
  let fechaInicio       = filterFechaInicio.value;
  let fechaFin          = filterFechaFin.value;

  if (mesSeleccionado) {
    const fechas = calcularRangoFechas(mesSeleccionado);
    fechaInicio = fechas.inicio;
    fechaFin    = fechas.fin;
    filterFechaInicio.value = fechaInicio;
    filterFechaFin.value    = fechaFin;
  }

  const params = new URLSearchParams();
  if (profesionalId) params.append('profesional_id', profesionalId);
  if (fechaInicio)   params.append('fecha_inicio', fechaInicio);
  if (fechaFin)      params.append('fecha_fin', fechaFin);

  tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:40px;">Filtrando datos...</td></tr>`;

  try {
    const [resClients, resConsultas] = await Promise.all([
      fetch(`${API_URL}/filters?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      }),
      fetch(API_CONSULTAS, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      })
    ]);

    if (!resClients.ok)   throw new Error("Error al filtrar clientes");
    if (!resConsultas.ok) throw new Error("Error al filtrar consultas");

    const clients   = await resClients.json();
    const consultas = await resConsultas.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      showNoData();
      updateStats([]);
      return;
    }

    allClients   = clients.sort((a, b) => b.id - a.id);
    allConsultas = Array.isArray(consultas) ? consultas : [];

    // Si hay filtro de fechas, también filtrar consultas por fecha
    let consultasFiltradas = allConsultas;
    if (fechaInicio || fechaFin) {
      consultasFiltradas = allConsultas.filter(c => {
        if (!c.fecha) return false;
        const f = c.fecha.split('T')[0];
        if (fechaInicio && f < fechaInicio) return false;
        if (fechaFin    && f > fechaFin)    return false;
        return true;
      });
    }

    matrizRows = buildMatrizRows(allClients, consultasFiltradas);

    populateFilterOptions();
    renderRows(matrizRows);
    updateStats(matrizRows);

  } catch (err) {
    console.error("Error aplicando filtros avanzados:", err);
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;padding:40px;color:#e74c3c;">Error al filtrar datos</td></tr>`;
  }
}

// ─── Limpiar filtros avanzados ────────────────────────────────────────────────
function clearAdvancedFilters() {
  filterProfesional.value  = "";
  filterMes.value          = "";
  filterFechaInicio.value  = "";
  filterFechaFin.value     = "";
  loadData();
}

// ─── Calcular rango de fechas predefinido ─────────────────────────────────────
function calcularRangoFechas(opcion) {
  const hoy = new Date();
  let inicio, fin;

  switch (opcion) {
    case 'mes_actual':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      break;
    case 'mes_anterior':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      fin    = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      break;
    case 'ultimos_3_meses':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
      fin    = hoy;
      break;
    case 'ultimos_6_meses':
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1);
      fin    = hoy;
      break;
    case 'este_año':
      inicio = new Date(hoy.getFullYear(), 0, 1);
      fin    = hoy;
      break;
    default:
      return { inicio: '', fin: '' };
  }

  return {
    inicio: formatearFecha(inicio),
    fin:    formatearFecha(fin)
  };
}

function formatearFecha(fecha) {
  const y  = fecha.getFullYear();
  const m  = String(fecha.getMonth() + 1).padStart(2, '0');
  const d  = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────
function updateStats(rows) {
  // Contar clientes únicos
  const clientesUnicos = new Set(rows.map(r => r.client.id));
  const totalRegistros  = rows.length;
  const totalSesiones   = rows.filter(r => r.consulta !== null).length;

  // Contar clientes únicos por tipo (no filas, para no duplicar por sesiones)
  const particular = new Set(rows.filter(r => r.client.tipo_entidad_pagadora === 'Particular').map(r => r.client.id)).size;
  const arl        = new Set(rows.filter(r => r.client.tipo_entidad_pagadora === 'ARL').map(r => r.client.id)).size;
  const ccf        = new Set(rows.filter(r => r.client.tipo_entidad_pagadora === 'CCF').map(r => r.client.id)).size;

  document.getElementById("statTotal").textContent    = clientesUnicos.size;
  document.getElementById("statParticular").textContent = particular;
  document.getElementById("statARL").textContent      = arl;
  document.getElementById("statCCF").textContent      = ccf;
  document.getElementById("statSesiones").textContent = totalSesiones;
  document.getElementById("statHoras").textContent    = totalSesiones; // 1 sesión = 1 hora
}

// ─── Mostrar / Ocultar mensaje sin datos ──────────────────────────────────────
function showNoData() {
  tableContainer.style.display = "none";
  noDataMessage.style.display  = "block";
}

function hideNoData() {
  tableContainer.style.display = "block";
  noDataMessage.style.display  = "none";
}

// ─── Configurar eventos de filtros ───────────────────────────────────────────
function setupFilterEvents() {
  if (btnApplyAdvancedFilters) {
    btnApplyAdvancedFilters.addEventListener("click", applyAdvancedFilters);
  }
  if (btnClearAdvancedFilters) {
    btnClearAdvancedFilters.addEventListener("click", clearAdvancedFilters);
  }
  if (filterMes) {
    filterMes.addEventListener("change", function () {
      if (this.value) {
        filterFechaInicio.value = "";
        filterFechaFin.value    = "";
      }
    });
  }
  if (filterFechaInicio) {
    filterFechaInicio.addEventListener("change", () => { filterMes.value = ""; });
  }
  if (filterFechaFin) {
    filterFechaFin.addEventListener("change", () => { filterMes.value = ""; });
  }

  // Filtro tipo cliente (cascada)
  filterTipoCliente.addEventListener("change", function () {
    const tipo = this.value;
    filterNombreCliente.innerHTML = '<option value="">Todos</option>';

    if (tipo === "Particular" || tipo === "") {
      filterNombreClienteContainer.style.display = "none";
      filterNombreCliente.value = "";
    } else if (tipo === "ARL" || tipo === "CCF") {
      filterNombreClienteContainer.style.display = "block";
      labelNombreCliente.textContent = `Seleccione ${tipo}:`;
      (ENTIDADES[tipo] || []).forEach(entidad => {
        const option = document.createElement("option");
        option.value = entidad;
        option.textContent = entidad;
        filterNombreCliente.appendChild(option);
      });
    }
    applyFilters();
  });

  filterNombreCliente.addEventListener("change",   applyFilters);
  filterVinculo.addEventListener("change",         applyFilters);
  filterSede.addEventListener("change",            applyFilters);
  filterEmpresa.addEventListener("change",         applyFilters);
  filterSubcontratista.addEventListener("change",  applyFilters);
  btnClearFilters.addEventListener("click",        clearAllFilters);
}

// ─── Exportar a Excel ────────────────────────────────────────────────────────
function exportarExcel() {
  const datos = currentFilteredRows;

  if (!datos || datos.length === 0) {
    alert('⚠️ No hay datos para exportar.');
    return;
  }

  const filas = datos.map(({ client, consulta, sesionNum }) => {

    // Tipo Cliente
    const tipoCliente = client.tipo_entidad_pagadora || '-';

    // Nombre Cliente
    let nombreCliente = '-';
    if (client.tipo_entidad_pagadora === 'Particular') {
      nombreCliente = client.cliente_final || '-';
    } else {
      nombreCliente = client.entidad_pagadora_especifica || '-';
    }

    // Empresa Usuario
    const empresaUsuario = client.cliente_final || '-';

    // Cliente Final (subcontratista)
    const subcontratistaName = client.subcontratista_definitivo || client.subcontratista_nombre;
    const clienteFinal = subcontratistaName || 'N/A';

    // Vínculo, Sede, Nombre, Cédula
    const vinculo = client.vinculo || '-';
    const sede    = client.sede    || '-';
    const cedula  = String(client.cedula || '-');

    // Nombre: si es Familiar Trabajador, incluir info del trabajador relacionado
    let nombre = client.nombre || '-';
    if (client.vinculo === 'Familiar Trabajador' && client.nombre_trabajador) {
      const relacion = client.cedula_trabajador
        ? `Relacionado al trabajador: ${client.nombre_trabajador} con c.c ${client.cedula_trabajador}`
        : `Relacionado al trabajador: ${client.nombre_trabajador}`;
      nombre = `${nombre} - ${relacion}`;
    }

    // Sesiones sugeridas
    const sesionessugeridas = client.consultas_sugeridas
      ? String(client.consultas_sugeridas)
      : '-';

    // Campos de la sesión
    let fechaConsulta = '-';
    let motivoConsulta = '-';
    let numSesion = '-';
    let horasSesion = '-';
    let observaciones = '-';
    let profesional = '-';

    if (consulta) {
      if (consulta.fecha) {
        const d = new Date(consulta.fecha);
        fechaConsulta = d.toLocaleDateString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit'
        });
      }
      motivoConsulta = consulta.motivo_consulta || '-';
      numSesion      = sesionNum !== null ? String(sesionNum) : '-';
      horasSesion    = '1';
      observaciones  = consulta.columna1 || '-';

      const profId   = consulta.profesional_id || client.profesional_id;
      profesional    = getNombreProfesional(profId);
    }

    return {
      'Fecha Consulta':      fechaConsulta,
      'Tipo Cliente':        tipoCliente,
      'Nombre Cliente':      nombreCliente,
      'Empresa Usuario':     empresaUsuario,
      'Cliente Final':       clienteFinal,
      'Vínculo':             vinculo,
      'Sede':                sede,
      'Nombre':              nombre,
      'Cédula':              cedula,
      'Motivo Consulta':     motivoConsulta,
      'Sesión #':            numSesion,
      'Horas Sesión':        horasSesion,
      'Sesiones Sugeridas':  sesionessugeridas,
      'Observaciones':       observaciones,
      'Profesional':         profesional
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  ws['!cols'] = [
    { wch: 14 }, // Fecha Consulta
    { wch: 14 }, // Tipo Cliente
    { wch: 28 }, // Nombre Cliente
    { wch: 28 }, // Empresa Usuario
    { wch: 28 }, // Cliente Final
    { wch: 18 }, // Vínculo
    { wch: 14 }, // Sede
    { wch: 28 }, // Nombre
    { wch: 14 }, // Cédula
    { wch: 30 }, // Motivo Consulta
    { wch:  9 }, // Sesión #
    { wch: 12 }, // Horas Sesión
    { wch: 16 }, // Sesiones Sugeridas
    { wch: 40 }, // Observaciones
    { wch: 24 }, // Profesional
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Trazabilidad');

  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `Trazabilidad_Pagos_${fecha}.xlsx`);
  console.log(`✅ Exportado con ${filas.length} registros`);
}

// ─── Escape HTML ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}