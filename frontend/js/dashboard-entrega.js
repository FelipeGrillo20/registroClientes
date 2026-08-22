// js/dashboard-entrega.js
// Dashboard de Entrega Individual de Resultados

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // CONFIG
  // ============================================================
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';

  function getToken() {
    return (typeof window.getAuthToken === 'function')
      ? window.getAuthToken()
      : localStorage.getItem('token');
  }
  function authHeader() {
    return { 'Authorization': `Bearer ${getToken()}` };
  }
  function jsonHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
  }

  const currentUser   = JSON.parse(localStorage.getItem('userData') || '{}');
  const userRol       = currentUser.rol || '';
  const userId        = currentUser.id;
  const isProfesional = userRol === 'profesional';

  // ============================================================
  // ESTADO GLOBAL
  // ============================================================
  let allProfesionales = [];   // [{id, nombre}]
  let allClientes      = [];   // todos los clientes accesibles (con perfil_estres si existe)
  let allEntregas      = [];   // todos los registros de entrega_resultados
  let profFiltroId     = 'todos'; // 'todos' o id de profesional
  let empresaFiltroId  = 'todos'; // 'todos' o id de empresa (subcontratista)
  let sedeFiltroId     = 'todos'; // 'todos' o nombre de sede
  let anioFiltro       = 'todos'; // 'todos' o 'YYYY'
  let mesFiltro        = 'todos'; // 'todos' o '1'..'12' (sin cero a la izquierda)

  const MESES = [
    { valor: '1',  nombre: 'Enero' },      { valor: '2',  nombre: 'Febrero' },
    { valor: '3',  nombre: 'Marzo' },      { valor: '4',  nombre: 'Abril' },
    { valor: '5',  nombre: 'Mayo' },       { valor: '6',  nombre: 'Junio' },
    { valor: '7',  nombre: 'Julio' },      { valor: '8',  nombre: 'Agosto' },
    { valor: '9',  nombre: 'Septiembre' }, { valor: '10', nombre: 'Octubre' },
    { valor: '11', nombre: 'Noviembre' },  { valor: '12', nombre: 'Diciembre' },
  ];

  let chartPruebas = null;

  // Color fijo por categoría (mismo color en la torta y en el desglose
  // por profesional, para que ambas vistas se lean como el mismo sistema)
  const PRUEBAS_PROFUNDIDAD_COLORES = {
    'IPT':                       '#a8a0d8',
    'Entrevista Semi':           '#f6c945',
    'Grupo Focal':               '#4dd0e1',
    'Perfil Estres':             '#ff8a65',
  };
  function colorPruebaProfundidad(cat) {
    return PRUEBAS_PROFUNDIDAD_COLORES[cat] || '#bdbdbd';
  }

  // Solo estos 4 son conceptos reales de "Pruebas a profundidad" — el resto
  // de opciones del desplegable (incluido "No asistio") no cuentan. Mismo
  // criterio que informe-empresas.js (PRUEBAS_PROFUNDIDAD_VALIDAS).
  const PRUEBAS_PROFUNDIDAD_VALIDAS = ['Perfil Estres', 'Entrevista Semi', 'IPT', 'Grupo Focal'];
  function tieneSeguimiento(entrega) {
    return PRUEBAS_PROFUNDIDAD_VALIDAS.includes((entrega.pruebas_profundidad || '').trim());
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function getIniciales(nombre) {
    if (!nombre) return '?';
    const p = nombre.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
  }

  function formatRelativo(isoDate) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Justo ahora';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.floor(h / 24);
    return `Hace ${d} día${d > 1 ? 's' : ''}`;
  }

  // ============================================================
  // CARGA DE DATOS — secuencial y robusta
  // ============================================================
  async function cargarTodosLosDatos() {
    mostrarLoader(true);
    try {
      // 1. Profesionales
      await cargarProfesionales();
      // 2. Clientes (depende de profesionales)
      await cargarClientes();
      // 3. Entregas — una sola petición al servidor (antes era 1 por cliente)
      await cargarEntregas();
      // 4. Anotar perfil estrés (dato que ya viaja en la respuesta anterior,
      //    no requiere peticiones adicionales)
      enriquecerConPerfilesEstres();
      // 5. Render
      poblarFiltroProfesional();
      poblarFiltroEmpresa();
      poblarFiltroSede();
      poblarFiltroAnioMes();
      renderDashboard();
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      mostrarLoader(false);
    }
  }

  // — Profesionales —
  async function cargarProfesionales() {
    if (isProfesional) {
      allProfesionales = [{ id: userId, nombre: currentUser.nombre || 'Mi cuenta' }];
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      const lista = data.users || (Array.isArray(data) ? data : []);
      // Incluir todos los usuarios (profesionales y admins) que tienen clientes asignados
      allProfesionales = lista.filter(u => u.nombre || u.name);
    } catch (e) {
      console.warn('No se pudieron cargar profesionales:', e);
      allProfesionales = [];
    }
  }

  // — Clientes —
  // Se carga un bloque por profesional y se anota _profesional_id en cada cliente
  // para que clientesFiltrados() funcione correctamente.
  async function cargarClientes() {
    try {
      const modalidades = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];

      if (isProfesional) {
        const peticiones = modalidades.map(m =>
          fetch(
            `${API_URL}/api/clients?profesional_id=${userId}&modalidad=${encodeURIComponent(m)}`,
            { headers: authHeader() }
          ).then(r => r.ok ? r.json() : []).catch(() => [])
        );
        const res = await Promise.all(peticiones);
        const trabajadores = res.flat().filter(Boolean);
        trabajadores.forEach(c => { c._profesional_id = String(userId); });
        allClientes = trabajadores;

      } else {
        // Admin: un fetch por profesional, anotar a quién pertenece cada cliente
        const peticiones = allProfesionales.map(p =>
          fetch(
            `${API_URL}/api/clients/filters?profesional_id=${p.id}`,
            { headers: authHeader() }
          ).then(r => r.ok ? r.json() : [])
           .catch(() => [])
           .then(lista => {
             (lista || []).forEach(c => { c._profesional_id = String(p.id); });
             return lista || [];
           })
        );
        const res = await Promise.all(peticiones);
        const todos = res.flat().filter(Boolean);

        // Deduplicar: si un cliente aparece en varios profesionales, guardar todas sus asignaciones
        const mapa = {};
        todos.forEach(c => {
          if (!mapa[c.id]) {
            mapa[c.id] = { ...c, _profesionales_ids: new Set([c._profesional_id]) };
          } else {
            mapa[c.id]._profesionales_ids.add(c._profesional_id);
          }
        });
        allClientes = Object.values(mapa);
      }

      // Excluir "pendientes" (agendados sin completar registro, sin sede):
      // este dashboard cuenta trabajadores efectivamente registrados. Además,
      // como un pendiente no tiene modalidad asignada, aparece en la
      // respuesta de cada modalidad consultada arriba — sin este filtro
      // quedaría contado más de una vez.
      allClientes = allClientes.filter(c => c.sede);
    } catch (e) {
      console.warn('No se pudieron cargar clientes:', e);
      allClientes = [];
    }
  }

  // — Entregas: una sola petición al backend, en vez de una por cliente —
  // (antes se hacía fetch(`/api/entrega-resultados/cliente/${c.id}`) por
  // cada trabajador, lo que con cientos de clientes disparaba cientos de
  // round-trips al servidor; ahora el backend arma un único listado).
  async function cargarEntregas() {
    try {
      const res = await fetch(`${API_URL}/api/entrega-resultados`, { headers: authHeader() });
      allEntregas = res.ok ? await res.json() : [];
    } catch (e) {
      console.warn('Error al cargar entregas:', e);
      allEntregas = [];
    }
  }

  // — Perfil estrés: cada cliente ya trae la columna `perfil_estres` en su
  // propio registro (viene incluida en /api/clients y /api/clients/filters),
  // y cada entrega ahora trae `trabajador_perfil_estres` vía JOIN — no hace
  // falta ninguna petición adicional por cliente.
  function enriquecerConPerfilesEstres() {
    allClientes.forEach(c => { c._tiene_perfil = !!c.perfil_estres; });
    allEntregas.forEach(e => { e._tiene_perfil = !!e.trabajador_perfil_estres; });
  }

  // ============================================================
  // FILTRO DE PROFESIONAL — selector superior
  // ============================================================
  function poblarFiltroProfesional() {
    const select  = document.getElementById('filtroProfesional');
    const wrapper = document.getElementById('filtroProfWrapper');
    const hint    = document.getElementById('profFilterHint');
    if (!select) return;

    // Siempre mostrar la barra cuando hay usuarios
    if (!allProfesionales.length) {
      if (wrapper) wrapper.style.display = 'none';
      return;
    }
    if (wrapper) wrapper.style.display = 'block';

    // Etiqueta de rol legible
    function labelRol(u) {
      const r = (u.rol || '').toLowerCase();
      if (r === 'admin' || r === 'administrador') return ' (Admin)';
      if (r === 'profesional') return ' (Prof.)';
      return '';
    }

    select.innerHTML =
      `<option value="todos">— Todos los usuarios —</option>` +
      allProfesionales.map(p =>
        `<option value="${p.id}">${(p.nombre || p.name || 'Usuario')}${labelRol(p)}</option>`
      ).join('');

    select.value = profFiltroId;
    actualizarHintFiltros();

    // Actualizar hint al cambiar selección
    select.addEventListener('change', actualizarHintFiltros);
  }

  // Hint dinámico compartido: cuántos trabajadores y entregas quedan con
  // los filtros de profesional y empresa actualmente seleccionados
  function actualizarHintFiltros() {
    const hint = document.getElementById('profFilterHint');
    if (!hint) return;
    if (profFiltroId === 'todos' && empresaFiltroId === 'todos' && sedeFiltroId === 'todos'
        && anioFiltro === 'todos' && mesFiltro === 'todos') {
      hint.textContent = `${allClientes.length} trabajadores · ${allEntregas.length} entregas`;
    } else {
      hint.textContent = `${clientesFiltrados().length} trabajadores · ${entregasFiltradas().length} entregas`;
    }
  }

  // Evento del selector de profesional
  document.getElementById('filtroProfesional')?.addEventListener('change', function () {
    profFiltroId = this.value;
    // Los catálogos de empresa y sede dependen de qué profesional está
    // seleccionado (solo deben verse las opciones con trabajadores de ESE profesional).
    poblarFiltroEmpresa();
    poblarFiltroSede();
    renderDashboard();
  });

  // Clientes filtrados SOLO por profesional (sin aplicar el filtro de
  // empresa) — es la base tanto para poblar el catálogo de empresas como
  // para el filtrado final combinado.
  function clientesPorProfesional() {
    if (profFiltroId === 'todos') return allClientes;
    const pid = String(profFiltroId);
    return allClientes.filter(c => {
      // 1. Fue cargado desde el endpoint de ese profesional (_profesional_id anotado en carga)
      if (String(c._profesional_id) === pid) return true;
      // 2. Tiene múltiples profesionales asignados (Set anotado en carga)
      if (c._profesionales_ids instanceof Set && c._profesionales_ids.has(pid)) return true;
      // 3. Fallback: tiene al menos una entrega creada por ese profesional
      return allEntregas.some(e =>
        String(e.client_id) === String(c.id) &&
        String(e.profesional_id) === pid
      );
    });
  }

  // ============================================================
  // FILTRO DE EMPRESA — solo empresas con trabajadores registrados
  // (y, si hay un profesional seleccionado, solo las suyas)
  // ============================================================
  function poblarFiltroEmpresa() {
    const select = document.getElementById('filtroEmpresa');
    if (!select) return;

    // Catálogo de empresas (subcontratista) presentes entre los trabajadores
    // del profesional seleccionado — no se pide el listado completo al backend.
    const mapa = {};
    clientesPorProfesional().forEach(c => {
      if (!c.subcontratista_id) return;
      if (!mapa[c.subcontratista_id]) {
        mapa[c.subcontratista_id] = c.subcontratista_definitivo || c.subcontratista_nombre || `Empresa ${c.subcontratista_id}`;
      }
    });
    const empresas = Object.entries(mapa)
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Si la empresa antes seleccionada ya no aplica para este profesional, resetear
    if (empresaFiltroId !== 'todos' && !empresas.some(e => String(e.id) === String(empresaFiltroId))) {
      empresaFiltroId = 'todos';
    }

    select.innerHTML =
      `<option value="todos">Todas las empresas</option>` +
      empresas.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');

    select.value = empresaFiltroId;
  }

  document.getElementById('filtroEmpresa')?.addEventListener('change', function () {
    empresaFiltroId = this.value;
    actualizarHintFiltros();
    renderDashboard();
  });

  // ============================================================
  // FILTRO DE SEDE — solo sedes con trabajadores registrados
  // (y, si hay un profesional seleccionado, solo las suyas)
  // ============================================================
  function poblarFiltroSede() {
    const select = document.getElementById('filtroSede');
    if (!select) return;

    const sedes = [...new Set(
      clientesPorProfesional().map(c => c.sede).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    // Si la sede antes seleccionada ya no aplica para este profesional, resetear
    if (sedeFiltroId !== 'todos' && !sedes.includes(sedeFiltroId)) {
      sedeFiltroId = 'todos';
    }

    select.innerHTML =
      `<option value="todos">Todas las sedes</option>` +
      sedes.map(s => `<option value="${s}">${s}</option>`).join('');

    select.value = sedeFiltroId;
  }

  document.getElementById('filtroSede')?.addEventListener('change', function () {
    sedeFiltroId = this.value;
    actualizarHintFiltros();
    renderDashboard();
  });

  // ============================================================
  // FILTRO DE AÑO / MES — sobre la fecha de retroalimentación de la entrega
  // Rango de años fijo (2026-2030), no depende de los datos cargados.
  // ============================================================
  function poblarFiltroAnioMes() {
    const selectAnio = document.getElementById('filtroAnio');
    const selectMes  = document.getElementById('filtroMes');
    if (selectAnio) {
      const anios = [];
      for (let a = 2026; a <= 2030; a++) anios.push(a);
      selectAnio.innerHTML =
        `<option value="todos">Todos los años</option>` +
        anios.map(a => `<option value="${a}">${a}</option>`).join('');
      selectAnio.value = anioFiltro;
    }
    if (selectMes) {
      selectMes.innerHTML =
        `<option value="todos">Todos los meses</option>` +
        MESES.map(m => `<option value="${m.valor}">${m.nombre}</option>`).join('');
      selectMes.value = mesFiltro;
    }
  }

  document.getElementById('filtroAnio')?.addEventListener('change', function () {
    anioFiltro = this.value;
    actualizarHintFiltros();
    renderDashboard();
  });

  document.getElementById('filtroMes')?.addEventListener('change', function () {
    mesFiltro = this.value;
    actualizarHintFiltros();
    renderDashboard();
  });

  // Mapa client_id -> subcontratista_id, usado para filtrar entregas por empresa
  function clienteEmpresaId(clientId) {
    const c = allClientes.find(c => String(c.id) === String(clientId));
    return c ? c.subcontratista_id : null;
  }

  // Mapa client_id -> sede, usado para filtrar entregas por sede
  function clienteSede(clientId) {
    const c = allClientes.find(c => String(c.id) === String(clientId));
    return c ? c.sede : null;
  }

  // Año/mes de la fecha de retroalimentación de una entrega (string 'YYYY-MM-DD...')
  function entregaAnio(fecha) {
    return fecha ? fecha.slice(0, 4) : null;
  }
  function entregaMes(fecha) {
    return fecha ? String(parseInt(fecha.slice(5, 7), 10)) : null;
  }

  // Devuelve los datos filtrados según profesional, empresa, sede, año y mes
  function entregasFiltradas() {
    let entregas = allEntregas;
    if (profFiltroId !== 'todos') {
      entregas = entregas.filter(e => String(e.profesional_id) === String(profFiltroId));
    }
    if (empresaFiltroId !== 'todos') {
      entregas = entregas.filter(e => String(clienteEmpresaId(e.client_id)) === String(empresaFiltroId));
    }
    if (sedeFiltroId !== 'todos') {
      entregas = entregas.filter(e => clienteSede(e.client_id) === sedeFiltroId);
    }
    if (anioFiltro !== 'todos') {
      entregas = entregas.filter(e => entregaAnio(e.fecha_retroalimentacion) === anioFiltro);
    }
    if (mesFiltro !== 'todos') {
      entregas = entregas.filter(e => entregaMes(e.fecha_retroalimentacion) === mesFiltro);
    }
    return entregas;
  }

  function clientesFiltrados() {
    let clientes = clientesPorProfesional();
    if (empresaFiltroId !== 'todos') {
      clientes = clientes.filter(c => String(c.subcontratista_id) === String(empresaFiltroId));
    }
    if (sedeFiltroId !== 'todos') {
      clientes = clientes.filter(c => c.sede === sedeFiltroId);
    }
    return clientes;
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  function renderDashboard() {
    const entregas = entregasFiltradas();
    const clientes = clientesFiltrados();

    renderKPIs(entregas, clientes);
    renderChartPruebas(entregas);
    renderTablaProfesionales(entregas);
    renderTimeline(entregas);
    renderBarrasCobertura(entregas);
  }

  // ── KPIs ──────────────────────────────────────────────────────
  function renderKPIs(entregas, clientes) {
    const totalEntregas         = entregas.length;
    const totalTrabajadores      = clientes.length;
    const profActivos            = new Set(entregas.map(e => e.profesional_id)).size;
    const profSinEntregas        = Math.max(0, allProfesionales.length - profActivos);
    // "Pruebas de profundidad": clientes únicos con al menos una de las 4
    // pruebas reales aplicadas (no duplicar por múltiples entregas).
    const clientesConSeguimiento = new Set(
      entregas.filter(tieneSeguimiento).map(e => e.client_id)
    ).size;
    const coberturaPct = totalTrabajadores
      ? Math.round(clientesConSeguimiento / totalTrabajadores * 100) : 0;
    // "Pruebas de profundidad Con Adjunto": clientes únicos con el PDF de
    // Perfil Estrés cargado Y una de las 4 pruebas reales aplicadas.
    const clientesConAdjunto = new Set(
      entregas.filter(e => e._tiene_perfil && tieneSeguimiento(e)).map(e => e.client_id)
    ).size;

    // Variación mensual
    const ahora   = new Date();
    const mesAct  = ahora.getMonth();
    const anoAct  = ahora.getFullYear();
    const esteMes = entregas.filter(e => {
      if (!e.created_at) return false;
      const d = new Date(e.created_at);
      return d.getMonth() === mesAct && d.getFullYear() === anoAct;
    }).length;
    const mesPas = entregas.filter(e => {
      if (!e.created_at) return false;
      const d  = new Date(e.created_at);
      const mp = mesAct === 0 ? 11 : mesAct - 1;
      const ap = mesAct === 0 ? anoAct - 1 : anoAct;
      return d.getMonth() === mp && d.getFullYear() === ap;
    }).length;
    const varPct = mesPas > 0 ? Math.round((esteMes - mesPas) / mesPas * 100) : null;

    const kpis = [
      {
        label: 'Entregas totales',
        value: totalEntregas,
        badge: varPct !== null
          ? { cls: varPct >= 0 ? 'badge-green' : 'badge-amber', text: `${varPct >= 0 ? '+' : ''}${varPct}% vs mes ant.` }
          : (esteMes > 0 ? { cls: 'badge-blue', text: `${esteMes} este mes` } : null),
        iconBg: '#e3f0ff', iconColor: '#1565c0',
        iconPath: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                   <polyline points="14 2 14 8 20 8"/>
                   <line x1="16" y1="13" x2="8" y2="13"/>
                   <line x1="16" y1="17" x2="8" y2="17"/>`,
      },
      {
        label: 'Pruebas de profundidad',
        value: clientesConSeguimiento,
        badge: { cls: coberturaPct >= 60 ? 'badge-green' : 'badge-amber', text: `${coberturaPct}% cobertura` },
        iconBg: '#ede7f6', iconColor: '#4527a0',
        iconPath: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                   <polyline points="17 8 12 3 7 8"/>
                   <line x1="12" y1="3" x2="12" y2="15"/>`,
      },
      {
        label: 'Pruebas de profundidad Con Adjunto',
        value: clientesConAdjunto,
        badge: totalEntregas
          ? { cls: 'badge-blue', text: `${Math.round(clientesConAdjunto / totalEntregas * 100)}% del total` }
          : null,
        iconBg: '#fce4ec', iconColor: '#c62828',
        iconPath: `<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
      },
      {
        label: 'Profesionales activos',
        value: profActivos,
        badge: profSinEntregas > 0
          ? { cls: 'badge-amber', text: `${profSinEntregas} sin entregas` }
          : (profActivos > 0 ? { cls: 'badge-green', text: 'Todos activos' } : null),
        iconBg: '#fff3e0', iconColor: '#e65100',
        iconPath: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                   <circle cx="12" cy="7" r="4"/>`,
      },
    ];

    document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-top">
          <div class="kpi-icon" style="background:${k.iconBg}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="${k.iconColor}" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">${k.iconPath}</svg>
          </div>
          ${k.label}
        </div>
        <div class="kpi-value">${k.value}</div>
        ${k.sub  ? `<div style="font-size:11px;color:#9aa3b5">${k.sub}</div>` : ''}
        ${k.badge ? `<span class="kpi-badge ${k.badge.cls}">${k.badge.text}</span>` : ''}
      </div>
    `).join('');
  }

  // ── Chart torta: Pruebas a profundidad ─────────────────────────
  function renderChartPruebas(entregas) {
    const cats = {};
    PRUEBAS_PROFUNDIDAD_VALIDAS.forEach(l => { cats[l] = 0; });

    entregas.forEach(e => {
      const valor = (e.pruebas_profundidad || '').trim();
      if (PRUEBAS_PROFUNDIDAD_VALIDAS.includes(valor)) cats[valor]++;
    });

    const labels  = Object.keys(cats).filter(k => cats[k] > 0);
    const valores = labels.map(l => cats[l]);
    const total = valores.reduce((a,b)=>a+b,0);

    document.getElementById('pruebasLegend').innerHTML = labels.map((l,i) => {
      const pct = total ? Math.round(valores[i]/total*100) : 0;
      return `<div class="dl-row">
        <span class="dl-left"><span class="legend-dot" style="background:${colorPruebaProfundidad(l)}"></span>${l}</span>
        <span class="dl-val">${pct}%</span>
      </div>`;
    }).join('');

    const backgroundColor = labels.map(colorPruebaProfundidad);

    if (chartPruebas) {
      chartPruebas.data.labels                      = labels;
      chartPruebas.data.datasets[0].data             = valores;
      chartPruebas.data.datasets[0].backgroundColor  = backgroundColor;
      chartPruebas.update();
      return;
    }
    chartPruebas = new Chart(document.getElementById('cPruebas'), {
      type: 'pie',
      data: { labels, datasets: [{ data: valores, backgroundColor, borderWidth: 0, hoverOffset: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}` } } },
      },
    });
  }

  // ── Tabla profesionales ───────────────────────────────────────
  function renderTablaProfesionales(entregas) {
    const tbody = document.getElementById('profTableBody');
    const mapa  = {};

    // Inicializar con todos los profesionales conocidos
    allProfesionales.forEach(p => { mapa[p.id] = { nombre:p.nombre, entregas:0, conSeguimiento:0 }; });

    entregas.forEach(e => {
      const pid = e.profesional_id;
      if (!mapa[pid]) mapa[pid] = { nombre: e.profesional_nombre || `Prof. ${pid}`, entregas:0, conSeguimiento:0 };
      mapa[pid].entregas++;
      if (tieneSeguimiento(e)) mapa[pid].conSeguimiento++;
    });

    const lista = Object.values(mapa).filter(p => p.entregas > 0)
      .sort((a,b) => b.entregas - a.entregas);

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="table-loading">Sin datos disponibles</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(p => {
      const pct    = p.entregas ? Math.round(p.conSeguimiento / p.entregas * 100) : 0;
      const cls    = pct >= 80 ? 'pill-green' : pct >= 55 ? 'pill-amber' : 'pill-red';
      return `<tr>
        <td><div class="td-prof"><div class="prof-avatar">${getIniciales(p.nombre)}</div>${p.nombre}</div></td>
        <td class="text-right" style="font-weight:700">${p.entregas}</td>
        <td class="text-right"><span class="pill ${cls}">${pct}%</span></td>
      </tr>`;
    }).join('');
  }

  // ── Timeline ──────────────────────────────────────────────────
  function renderTimeline(entregas) {
    const tl = document.getElementById('timeline');
    if (!entregas.length) {
      tl.innerHTML = `<div class="tl-empty">Sin actividad registrada</div>`;
      return;
    }
    const recientes = [...entregas]
      .sort((a,b) => new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at))
      .slice(0, 8);

    tl.innerHTML = recientes.map(e => {
      const nombre   = e.trabajador_nombre  || `Trabajador #${e.client_id}`;
      const profName = e.profesional_nombre || '';
      const tieneRetro = !!e.fecha_retroalimentacion;
      const esEdita  = e.updated_at && Math.abs(new Date(e.updated_at)-new Date(e.created_at)) > 5000;

      let dotColor, desc;
      if (tieneRetro)    { dotColor='#5B8AF0'; desc=`Retroalimentación registrada${profName?' · '+profName:''}`; }
      else if (esEdita)  { dotColor='#52b788'; desc=`Recomendaciones editadas${profName?' · '+profName:''}`; }
      else               { dotColor='#f4a261'; desc=`Nueva entrega creada${profName?' · '+profName:''}`; }

      if (e._tiene_perfil) { dotColor='#9b59b6'; desc='Perfil estrés subido · '+desc; }

      return `<div class="tl-item">
        <span class="tl-dot" style="background:${dotColor}"></span>
        <div class="tl-body">
          <div class="tl-name">${nombre}</div>
          <div class="tl-desc">${desc}</div>
        </div>
        <span class="tl-time">${formatRelativo(e.updated_at||e.created_at)}</span>
      </div>`;
    }).join('');
  }

  // ── Pruebas a profundidad por profesional (desglose por categoría) ────
  // Antes esta sección solo medía "Perfil Estrés" (un único valor posible).
  // Ahora "pruebas_profundidad" tiene 10 categorías, así que por cada
  // profesional mostramos una barra apilada con la proporción de cada una,
  // más una lista de conteos/porcentaje debajo.
  function renderBarrasCobertura(entregas) {
    const lista = document.getElementById('barList');
    const mapa  = {};
    allProfesionales.forEach(p => { mapa[p.id] = { nombre:p.nombre, total:0, categorias:{} }; });
    entregas.forEach(e => {
      const cat = (e.pruebas_profundidad || '').trim();
      if (!PRUEBAS_PROFUNDIDAD_VALIDAS.includes(cat)) return;
      const pid = e.profesional_id;
      if (!mapa[pid]) mapa[pid] = { nombre:e.profesional_nombre||`Prof. ${pid}`, total:0, categorias:{} };
      mapa[pid].total++;
      mapa[pid].categorias[cat] = (mapa[pid].categorias[cat] || 0) + 1;
    });

    const datos = Object.values(mapa).filter(p => p.total > 0).sort((a,b) => b.total - a.total);
    if (!datos.length) {
      lista.innerHTML = `<p style="font-size:13px;color:#9aa3b5;text-align:center;padding:16px 0">Sin datos disponibles</p>`;
      return;
    }

    lista.innerHTML = datos.map(p => {
      const categoriasPresentes = PRUEBAS_PROFUNDIDAD_VALIDAS.filter(cat => p.categorias[cat] > 0);

      const segmentos = categoriasPresentes.map(cat => {
        const n   = p.categorias[cat];
        const pct = Math.round(n / p.total * 100);
        const color = colorPruebaProfundidad(cat);
        return { cat, n, pct, color };
      });

      const track = segmentos.map(s =>
        `<div class="bar-segment" style="width:${s.pct}%;background:${s.color}" title="${s.cat}: ${s.n} (${s.pct}%)"></div>`
      ).join('');

      const chips = segmentos.map(s =>
        `<span class="bar-chip"><span class="legend-dot" style="background:${s.color}"></span>${s.cat} · ${s.n} (${s.pct}%)</span>`
      ).join('');

      return `<div class="bar-row">
        <div class="bar-meta">
          <span class="bar-name">${p.nombre}</span>
          <span class="bar-stat">${p.total} ${p.total === 1 ? 'entrega' : 'entregas'}</span>
        </div>
        <div class="bar-track stacked">${track}</div>
        <div class="bar-chips">${chips}</div>
      </div>`;
    }).join('');
  }

  // ============================================================
  // BOTÓN ACTUALIZAR
  // ============================================================
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnRefresh');
    btn.classList.add('spinning');
    btn.disabled = true;
    // Destruir gráfica para que se recree con datos frescos
    chartPruebas?.destroy();
    chartPruebas = null;
    await cargarTodosLosDatos();
    btn.classList.remove('spinning');
    btn.disabled = false;
  });

  // ============================================================
  // LIMPIAR FILTROS — vuelve profesional/empresa/sede/año/mes a "todos"
  // ============================================================
  document.getElementById('btnLimpiarFiltros')?.addEventListener('click', () => {
    profFiltroId    = 'todos';
    empresaFiltroId = 'todos';
    sedeFiltroId    = 'todos';
    anioFiltro      = 'todos';
    mesFiltro       = 'todos';

    poblarFiltroProfesional();
    poblarFiltroEmpresa();
    poblarFiltroSede();
    poblarFiltroAnioMes();
    actualizarHintFiltros();
    renderDashboard();
  });

  // ============================================================
  // DESCARGUE MASIVO — genera un PDF por cada plantilla diligenciada
  // que cumpla los filtros activos (profesional / empresa / sede) y los
  // empaqueta en un único .zip. La construcción de cada PDF reutiliza el
  // mismo módulo (js/plantilla-pdf.js) que usa la descarga individual en
  // entrega-resultados.html, para que ambas plantillas sean idénticas.
  // ============================================================
  document.getElementById('btnDescargaMasiva')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnDescargaMasiva');
    const textoOriginal = btn.innerHTML;

    const entregas = entregasFiltradas();
    if (!entregas.length) {
      alert('No hay plantillas diligenciadas para descargar con los filtros actuales.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `Generando 0 / ${entregas.length}…`;

    try {
      await PlantillaPDF.precargarLogo();
      const zip = new JSZip();
      const nombresUsados = new Set();

      for (let i = 0; i < entregas.length; i++) {
        const e = entregas[i];
        btn.innerHTML = `Generando ${i + 1} / ${entregas.length}…`;

        const firma = await PlantillaPDF.obtenerFirmaBase64(e.profesional_cedula);
        const doc = PlantillaPDF.construirDocumentoPDF({
          trabajadorNombre: e.trabajador_nombre || 'Sin nombre',
          fechaRetroalimentacion: e.fecha_retroalimentacion?.slice(0, 10) || '',
          tituloSeccion: e.titulo_seccion,
          recomendacionesHtml: e.recomendaciones_html,
          pruebasProfundidad: e.pruebas_profundidad,
          profesional: {
            nombre:   e.profesional_nombre   || '',
            licencia: e.profesional_licencia || '',
            telefono: e.profesional_telefono || '',
          },
          firmaBase64: firma,
        });

        // Nombre de archivo único dentro del .zip — si dos entregas
        // comparten trabajador (ej. reingreso) se numeran para no
        // sobreescribirse entre sí.
        const base = `Plantilla_${(e.trabajador_nombre || 'Sin_nombre').replace(/\s+/g, '_')}`;
        let nombreArchivo = `${base}.pdf`;
        let contador = 2;
        while (nombresUsados.has(nombreArchivo)) {
          nombreArchivo = `${base}_${contador++}.pdf`;
        }
        nombresUsados.add(nombreArchivo);

        zip.file(nombreArchivo, doc.output('blob'));
      }

      btn.innerHTML = 'Comprimiendo…';
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Fecha local del navegador (no UTC) — toISOString() adelanta el día
      // varias horas antes de medianoche en zonas horarias negativas como Colombia.
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
      const nombreZip = `Plantillas_Entrega_Resultados_${hoy}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreZip;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error generando el descargue masivo:', err);
      alert('Ocurrió un error generando el descargue masivo. Revisa la consola para más detalle.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });

  // ============================================================
  // UI HELPERS
  // ============================================================
  function mostrarLoader(visible) {
    document.getElementById('globalLoader').style.display = visible ? 'flex' : 'none';
    document.getElementById('dashContent').style.display  = visible ? 'none'  : 'block';
  }

  // ============================================================
  // INIT
  // ============================================================
  cargarTodosLosDatos();

});