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

// ✅ Token de renderizado: evita race conditions entre peticiones concurrentes.
// Cada llamada a loadClients genera un nuevo ID; renderClients lo verifica
// después de cada await y aborta si ya fue reemplazado por una petición más reciente.
let renderToken = 0;

// ============================================
// ✅ FUNCIONES DEL MODAL DE TRABAJADOR RELACIONADO
// ============================================
function mostrarModalTrabajadorRelacionado(cedulaTrabajador, nombreTrabajador) {
  let modal = document.getElementById('modalTrabajadorRelacionado');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalTrabajadorRelacionado';
    modal.className = 'modal-trabajador-overlay';
    modal.innerHTML = `
      <div class="modal-trabajador-container">
        <div class="modal-trabajador-header">
          <h3>👤 Trabajador Relacionado</h3>
          <button class="modal-trabajador-close" onclick="cerrarModalTrabajadorRelacionado()">
            <span>✕</span>
          </button>
        </div>
        <div class="modal-trabajador-body">
          <div class="modal-trabajador-info">
            <div class="info-row">
              <div class="info-icon">🆔</div>
              <div class="info-content">
                <label>Cédula del Trabajador</label>
                <p id="modalCedulaTrabajador"></p>
              </div>
            </div>
            <div class="info-row">
              <div class="info-icon">👨‍💼</div>
              <div class="info-content">
                <label>Nombre del Trabajador</label>
                <p id="modalNombreTrabajador"></p>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-trabajador-footer">
          <button class="btn-modal-cerrar" onclick="cerrarModalTrabajadorRelacionado()">
            Cerrar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cerrarModalTrabajadorRelacionado();
      }
    });
  }
  
  document.getElementById('modalCedulaTrabajador').textContent = cedulaTrabajador || 'No especificado';
  document.getElementById('modalNombreTrabajador').textContent = nombreTrabajador || 'No especificado';
  
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}

function cerrarModalTrabajadorRelacionado() {
  const modal = document.getElementById('modalTrabajadorRelacionado');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
  }
}

window.mostrarModalTrabajadorRelacionado = mostrarModalTrabajadorRelacionado;
window.cerrarModalTrabajadorRelacionado = cerrarModalTrabajadorRelacionado;

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

// ✅ ACTUALIZADO: Verificar informes disponibles por trabajador
// Devuelve el número de consultas cerradas (con fecha_cierre) para Orientación Psicosocial,
// o true/false para SVE (que no tiene múltiples consultas).
// El cache ahora almacena { count, consultas } para Psicosocial.
async function verificarInformeDisponible(clienteId, modalidad) {
  try {
    if (consultasDisponibles[clienteId] !== undefined) {
      return consultasDisponibles[clienteId];
    }

    if (modalidad === 'Orientación Psicosocial') {
      const resConsultas = await fetch(`${CONSULTAS_URL}/cliente/${clienteId}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      });

      if (!resConsultas.ok) {
        consultasDisponibles[clienteId] = { count: 0, consultas: [] };
        return consultasDisponibles[clienteId];
      }

      const consultas = await resConsultas.json();
      if (!Array.isArray(consultas) || consultas.length === 0) {
        consultasDisponibles[clienteId] = { count: 0, consultas: [] };
        return consultasDisponibles[clienteId];
      }

      // Agrupar por consulta_number y contar las que tienen fecha_cierre
      const grupos = {};
      consultas.forEach(c => {
        const num = c.consulta_number;
        if (!grupos[num]) grupos[num] = [];
        grupos[num].push(c);
      });

      const consultasCerradas = Object.entries(grupos)
        .filter(([, sesiones]) => sesiones.some(s => s.fecha_cierre))
        .map(([num, sesiones]) => {
          const sesionCierre = sesiones.find(s => s.fecha_cierre);
          return {
            consulta_number: parseInt(num),
            motivo: sesiones[0].motivo_consulta,
            fecha_cierre: sesionCierre.fecha_cierre,
            sesiones
          };
        })
        .sort((a, b) => a.consulta_number - b.consulta_number);

      const resultado = { count: consultasCerradas.length, consultas: consultasCerradas };
      consultasDisponibles[clienteId] = resultado;
      return resultado;
    }

    // SVE: solo verificar que tenga consultas (sin múltiples consultas)
    if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
      const resConsultas = await fetch(`${CONSULTAS_SVE_URL}/cliente/${clienteId}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      });

      if (!resConsultas.ok) {
        consultasDisponibles[clienteId] = false;
        return false;
      }

      const consultas = await resConsultas.json();
      const tiene = Array.isArray(consultas) && consultas.length > 0;
      consultasDisponibles[clienteId] = tiene;
      return tiene;
    }

    consultasDisponibles[clienteId] = { count: 0, consultas: [] };
    return consultasDisponibles[clienteId];

  } catch (err) {
    console.error(`❌ Error verificando informe para cliente ${clienteId}:`, err);
    consultasDisponibles[clienteId] = { count: 0, consultas: [] };
    return consultasDisponibles[clienteId];
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
    
    // Mostrar y poblar filtros de año y mes
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
    
    // Mostrar contador de trabajadores
    const contadorTrabajadores = document.getElementById("contadorTrabajadores");
    if (contadorTrabajadores) {
      contadorTrabajadores.style.display = "flex";
    }
  }
  
  // ✅ NUEVO: Si es profesional, mostrar badge con su nombre y filtros de año/mes
  if (currentUserRole === 'profesional') {
    // Mostrar badge del profesional
    const badgeContainer = document.getElementById("profesionalBadgeContainer");
    if (badgeContainer) {
      badgeContainer.style.display = "flex";
      // Rellenar nombre desde userData
      const nombreBadge = document.getElementById("profesionalBadgeNombre");
      if (nombreBadge && userData?.nombre) {
        nombreBadge.textContent = userData.nombre;
      }
      // Iniciales para el avatar
      const avatarEl = document.getElementById("profesionalBadgeAvatar");
      if (avatarEl && userData?.nombre) {
        const partes = userData.nombre.trim().split(' ');
        const iniciales = partes.length >= 2
          ? (partes[0][0] + partes[1][0]).toUpperCase()
          : partes[0].substring(0, 2).toUpperCase();
        avatarEl.textContent = iniciales;
      }
    }
    
    // Mostrar filtros de año y mes también para el profesional
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
    
    // Mostrar contador de trabajadores
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
  // ✅ Incrementar token: cualquier renderClients anterior que siga en curso
  //    detectará que su token ya no es válido y se detendrá.
  const myToken = ++renderToken;

  // Limpiar tabla INMEDIATAMENTE para que no queden datos viejos visibles
  tbody.innerHTML = `<tr><td colspan="8" class="no-data">Cargando clientes...</td></tr>`;
  allClients = [];
  
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

    // ✅ Si llegó una petición más reciente mientras esperábamos, descartar esta respuesta
    if (myToken !== renderToken) {
      console.log("⚠️ Respuesta descartada (petición más reciente en curso)");
      return;
    }
    
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">Error al cargar clientes</td></tr>`;
      // ✅ Actualizar contador a 0 en caso de error
      actualizarContadorTrabajadores(0);
      return;
    }
    
    const clients = await res.json();

    // ✅ Verificar token nuevamente después de parsear JSON
    if (myToken !== renderToken) {
      console.log("⚠️ Respuesta descartada tras parsear JSON (petición más reciente en curso)");
      return;
    }
    
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
    
    renderClients(allClients, myToken);
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
// Recibe myToken para abortar si llega una petición más nueva mientras renderiza.
async function renderClients(list, myToken = null) {
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">No se encontraron clientes con esos filtros</td></tr>`;
    return;
  }

  const modalidad = window.currentModalidad || localStorage.getItem('modalidadSeleccionada');
  console.log(`🎨 Renderizando ${list.length} clientes en modalidad: ${modalidad}`);

  for (const c of list) {
    // ✅ Verificar antes de cada await: si el token cambió, detener el render
    if (myToken !== null && myToken !== renderToken) {
      console.log("⚠️ Render cancelado: nueva petición reemplazó a esta");
      return;
    }

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


    // ✅ NUEVO: Crear icono de información si es Familiar Trabajador
    let iconoTrabajador = '';
    if (c.vinculo === 'Familiar Trabajador' && (c.cedula_trabajador || c.nombre_trabajador)) {
      iconoTrabajador = `
        <button 
          class="btn-trabajador-relacionado" 
          onclick="mostrarModalTrabajadorRelacionado('${c.cedula_trabajador || ''}', '${c.nombre_trabajador || ''}')"
          title="Ver información del trabajador relacionado"
        >
          <span class="icon-info">👤</span>
        </button>
      `;
    }
    // ✅ Verificar informes disponibles para el trabajador
    const informeData = await verificarInformeDisponible(c.id, modalidad);

    // ✅ Verificar token también después del await de informes
    if (myToken !== null && myToken !== renderToken) {
      console.log("⚠️ Render cancelado tras verificar informe: nueva petición activa");
      return;
    }

    let informeDisabled = 'disabled';
    let informeClass = 'btn-informe btn-informe-disabled';
    let informeOnClick = '';

    if (modalidad === 'Orientación Psicosocial') {
      const count = informeData?.count || 0;
      if (count === 1) {
        // Un solo informe → comportamiento directo igual que antes
        informeDisabled = '';
        informeClass = 'btn-informe';
        informeOnClick = `onInforme(${c.id}, '${modalidad}')`;
      } else if (count > 1) {
        // Múltiples informes → abre modal de selección
        informeDisabled = '';
        informeClass = 'btn-informe btn-informe-multi';
        informeOnClick = `abrirModalInformes(${c.id}, '${modalidad}')`;
      }
    } else {
      // SVE: booleano simple
      if (informeData === true) {
        informeDisabled = '';
        informeClass = 'btn-informe';
        informeOnClick = `onInforme(${c.id}, '${modalidad}')`;
      }
    }

    tr.innerHTML = `
      <td>${c.cedula ?? ""}</td>
      <td>
        <div class="nombre-con-icono">
          <span>${escapeHtml(c.nombre ?? "")}</span>
          ${iconoTrabajador}
        </div>
      </td>
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
          <button class="btn-action ${informeClass}" data-id="${c.id}" ${informeOnClick ? `onclick="${informeOnClick}"` : ''} ${informeDisabled}>Informe</button>
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
      
      // Limpiar filtros de año y mes
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
      
      // Para profesional, no resetear el profesional_id (siempre filtra por el suyo)
      const userData = getCurrentUserData();
      const profesionalIdParaLimpiar = userData?.rol === 'profesional' ? null : null;
      
      loadClients(modalidad, profesionalIdParaLimpiar, null, null);

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

// ============================================
// MODAL DE SELECCIÓN DE INFORMES
// Se muestra cuando el trabajador tiene 2+ consultas cerradas
// ============================================

window.abrirModalInformes = function(clienteId, modalidad) {
  const datos = consultasDisponibles[clienteId];
  if (!datos || !datos.consultas || datos.consultas.length === 0) {
    alert("No hay informes disponibles para este trabajador.");
    return;
  }

  // Crear modal si no existe
  let modal = document.getElementById('modalSeleccionInformes');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalSeleccionInformes';
    modal.className = 'modal-informes-overlay';
    modal.innerHTML = `
      <div class="modal-informes-container">
        <div class="modal-informes-header">
          <h3>📄 Seleccionar Informe</h3>
          <button class="modal-informes-close" onclick="cerrarModalInformes()">✕</button>
        </div>
        <p class="modal-informes-subtitle">Este trabajador tiene múltiples consultas cerradas. Selecciona el informe que deseas generar.</p>
        <div class="modal-informes-lista" id="modalInformesLista"></div>
        <div class="modal-informes-footer">
          <button class="btn-modal-cerrar-informes" onclick="cerrarModalInformes()">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) cerrarModalInformes();
    });
  }

  // Poblar la lista de consultas
  const lista = document.getElementById('modalInformesLista');
  lista.innerHTML = datos.consultas.map(consulta => {
    const fechaCierre = consulta.fecha_cierre
      ? new Date(consulta.fecha_cierre).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '-';
    return `
      <div class="informe-item" onclick="onInforme(${clienteId}, '${modalidad}', ${consulta.consulta_number}); cerrarModalInformes();">
        <div class="informe-item-num">Consulta ${consulta.consulta_number}</div>
        <div class="informe-item-detalle">
          <span class="informe-item-motivo">${consulta.motivo || 'Sin motivo'}</span>
          <span class="informe-item-fecha">📅 Cierre: ${fechaCierre}</span>
        </div>
        <span class="informe-item-arrow">›</span>
      </div>
    `;
  }).join('');

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
};

window.cerrarModalInformes = function() {
  const modal = document.getElementById('modalSeleccionInformes');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
  }
};

// ✅ ACTUALIZADO: onInforme acepta consulta_number opcional
// - Sin consulta_number (o null): genera el informe de la única consulta cerrada (SVE o 1 consulta)
// - Con consulta_number: genera el informe de esa consulta específica
window.onInforme = async function(clienteId, modalidad, consultaNumber = null) {
  console.log(`📄 Generando informe para cliente ${clienteId}, modalidad: ${modalidad}, consulta: ${consultaNumber ?? 'única'}`);

  try {
    const resCliente = await fetch(`${API_URL}/${clienteId}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resCliente.ok) {
      alert("❌ Error al cargar datos del cliente");
      return;
    }

    const cliente = await resCliente.json();

    if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
      const resConsultas = await fetch(`${CONSULTAS_SVE_URL}/cliente/${clienteId}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      });

      if (!resConsultas.ok) { alert("❌ No se encontraron consultas SVE"); return; }

      const consultas = await resConsultas.json();
      if (!consultas || consultas.length === 0) {
        alert("ℹ️ No hay consultas SVE registradas para generar el informe");
        return;
      }

      window.clienteActual = cliente;
      window.consultasDelCliente = consultas;
      window.getClienteIdFromContext = () => clienteId;

      if (typeof window.generarInformeSVE !== 'function') {
        const script = document.createElement('script');
        script.src = 'js/informeSVE.js';
        script.onload = () => window.generarInformeSVE(clienteId);
        script.onerror = () => alert("❌ Error al cargar el generador de informes SVE");
        document.head.appendChild(script);
      } else {
        window.generarInformeSVE(clienteId);
      }

    } else {
      // Orientación Psicosocial
      const resConsultas = await fetch(`${CONSULTAS_URL}/cliente/${clienteId}`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` }
      });

      if (!resConsultas.ok) { alert("❌ No se encontraron consultas"); return; }

      const todasConsultas = await resConsultas.json();
      if (!todasConsultas || todasConsultas.length === 0) {
        alert("ℹ️ No hay consultas registradas para generar el informe");
        return;
      }

      // Determinar qué consulta_number usar
      let numParaInforme = consultaNumber;
      if (numParaInforme === null) {
        // Caso de 1 sola consulta cerrada: usar la primera con fecha_cierre
        const grupos = {};
        todasConsultas.forEach(c => {
          if (!grupos[c.consulta_number]) grupos[c.consulta_number] = [];
          grupos[c.consulta_number].push(c);
        });
        const cerrada = Object.entries(grupos).find(([, s]) => s.some(x => x.fecha_cierre));
        if (!cerrada) {
          alert("⚠️ No hay ninguna consulta cerrada para generar el informe.");
          return;
        }
        numParaInforme = parseInt(cerrada[0]);
      }

      window.clienteActual = cliente;
      window.consultasDelCliente = todasConsultas;

      // Informar a informe.js qué consulta_number debe usar
      window.setConsultaNumberActual && window.setConsultaNumberActual(numParaInforme);
      // Fallback para cuando informe.js no tenga setConsultaNumberActual disponible
      window._informeConsultaNumber = numParaInforme;

      if (typeof window.generarInformePaciente !== 'function') {
        const script = document.createElement('script');
        script.src = 'js/informe.js';
        script.onload = () => window.generarInformePaciente();
        script.onerror = () => alert("❌ Error al cargar el generador de informes");
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