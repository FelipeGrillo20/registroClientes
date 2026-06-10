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
  let periodoActual    = 'all';

  let chartBarras = null;
  let chartDonut  = null;
  let chartLinea  = null;

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

  function diffDias(f1, f2) {
    if (!f1 || !f2) return null;
    return Math.round(Math.abs(new Date(f2) - new Date(f1)) / 86400000);
  }

  function mesIdx(isoDate) {
    if (!isoDate) return -1;
    return new Date(isoDate).getMonth(); // 0-11
  }

  function trimestre(isoDate) {
    const m = mesIdx(isoDate) + 1;
    if (m <= 3)  return 'q1';
    if (m <= 6)  return 'q2';
    if (m <= 9)  return 'q3';
    return 'q4';
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
      // 3. Entregas por cada cliente (fuente real de datos)
      await cargarEntregas();
      // 4. Datos de perfiles estrés de cada cliente
      await enriquecerConPerfilesEstres();
      // 5. Render
      poblarFiltroProfesional();
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
    } catch (e) {
      console.warn('No se pudieron cargar clientes:', e);
      allClientes = [];
    }
  }

  // — Entregas: por cada cliente real —
  async function cargarEntregas() {
    if (!allClientes.length) { allEntregas = []; return; }
    try {
      const peticiones = allClientes.map(c =>
        fetch(
          `${API_URL}/api/entrega-resultados/cliente/${c.id}`,
          { headers: authHeader() }
        ).then(r => r.ok ? r.json() : [])
         .catch(() => [])
      );
      const res = await Promise.all(peticiones);
      allEntregas = res.flat().filter(Boolean);
    } catch (e) {
      console.warn('Error al cargar entregas:', e);
      allEntregas = [];
    }
  }

  // — Perfil estrés: enriquecer cada entrega con si el cliente tiene perfil —
  // El perfil vive en GET /api/clients/:id/documentos → { perfil_estres: "ruta/..." }
  async function enriquecerConPerfilesEstres() {
    if (!allClientes.length) return;
    try {
      const peticiones = allClientes.map(c =>
        fetch(
          `${API_URL}/api/clients/${c.id}/documentos`,
          { headers: authHeader() }
        ).then(r => r.ok ? r.json() : null)
         .catch(() => null)
      );
      const resultados = await Promise.all(peticiones);
      // Construir mapa clientId → tienePerfil
      const mapaPerfiles = {};
      allClientes.forEach((c, i) => {
        const doc = resultados[i];
        mapaPerfiles[c.id] = !!(doc && doc.perfil_estres);
      });
      // Anotar en cada entrega
      allEntregas.forEach(e => {
        e._tiene_perfil = !!mapaPerfiles[e.client_id];
      });
      // También anotar en clientes para el estado global
      allClientes.forEach(c => {
        c._tiene_perfil = !!mapaPerfiles[c.id];
      });
    } catch (e) {
      console.warn('Error al enriquecer perfiles:', e);
    }
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
    if (wrapper) wrapper.style.display = 'flex';

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

    // Hint dinámico: cuántos trabajadores y entregas tiene el seleccionado
    function actualizarHint() {
      if (!hint) return;
      if (profFiltroId === 'todos') {
        hint.textContent = `${allClientes.length} trabajadores · ${allEntregas.length} entregas`;
      } else {
        const e = allEntregas.filter(e => String(e.profesional_id) === String(profFiltroId));
        const c = clientesFiltrados();
        hint.textContent = `${c.length} trabajadores · ${e.length} entregas`;
      }
    }
    actualizarHint();

    // Actualizar hint al cambiar selección
    select.addEventListener('change', actualizarHint);
  }

  // Evento del selector de profesional
  document.getElementById('filtroProfesional')?.addEventListener('change', function () {
    profFiltroId = this.value;
    renderDashboard();
  });

  // Devuelve los datos filtrados según el profesional seleccionado
  function entregasFiltradas() {
    if (profFiltroId === 'todos') return allEntregas;
    return allEntregas.filter(e => String(e.profesional_id) === String(profFiltroId));
  }

  function clientesFiltrados() {
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

  function entregasPorPeriodo(entregas, periodo) {
    if (periodo === 'all') return entregas;
    const meses = { q1:[0,1,2], q2:[3,4,5], q3:[6,7,8], q4:[9,10,11] };
    return entregas.filter(e => {
      const m = mesIdx(e.created_at);
      return m >= 0 && meses[periodo]?.includes(m);
    });
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  function renderDashboard() {
    const entregas = entregasFiltradas();
    const clientes = clientesFiltrados();

    renderKPIs(entregas, clientes);
    renderEstados(entregas, clientes);
    renderChartBarras(entregasPorPeriodo(entregas, periodoActual), periodoActual);
    renderChartDonut(entregas);
    renderChartLinea(entregasPorPeriodo(entregas, periodoActual), periodoActual);
    renderTablaProfesionales(entregas);
    renderTimeline(entregas);
    renderBarrasCobertura(entregas);
  }

  // ── KPIs ──────────────────────────────────────────────────────
  function renderKPIs(entregas, clientes) {
    const totalEntregas         = entregas.length;
    const trabajadoresConEntrega = new Set(entregas.map(e => e.client_id)).size;
    const totalTrabajadores      = clientes.length;
    const profActivos            = new Set(entregas.map(e => e.profesional_id)).size;
    const profSinEntregas        = Math.max(0, allProfesionales.length - profActivos);
    // Perfiles estrés: contamos clientes únicos con perfil (no duplicar por múltiples entregas)
    const clientesConPerfil = new Set(
      entregas.filter(e => e._tiene_perfil).map(e => e.client_id)
    ).size;
    const coberturaPct = totalTrabajadores
      ? Math.round(clientesConPerfil / totalTrabajadores * 100) : 0;
    const conRetro = entregas.filter(e => e.fecha_retroalimentacion).length;

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
        label: 'Trabajadores atendidos',
        value: trabajadoresConEntrega,
        sub: totalTrabajadores ? `de ${totalTrabajadores} registrados` : null,
        iconBg: '#e8f5e9', iconColor: '#2e7d32',
        iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                   <circle cx="9" cy="7" r="4"/>
                   <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                   <path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
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
      {
        label: 'Perfiles estrés subidos',
        value: clientesConPerfil,
        badge: { cls: coberturaPct >= 60 ? 'badge-green' : 'badge-amber', text: `${coberturaPct}% cobertura` },
        iconBg: '#ede7f6', iconColor: '#4527a0',
        iconPath: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                   <polyline points="17 8 12 3 7 8"/>
                   <line x1="12" y1="3" x2="12" y2="15"/>`,
      },
      {
        label: 'Con retroalimentación',
        value: conRetro,
        badge: totalEntregas
          ? { cls: 'badge-blue', text: `${Math.round(conRetro / totalEntregas * 100)}% del total` }
          : null,
        iconBg: '#fce4ec', iconColor: '#c62828',
        iconPath: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                   <polyline points="7 10 12 15 17 10"/>
                   <line x1="12" y1="15" x2="12" y2="3"/>`,
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

  // ── Estados ───────────────────────────────────────────────────
  function renderEstados(entregas, clientes) {
    // Con plantilla Y perfil estrés
    const clientesConEntrega = new Set(entregas.map(e => e.client_id));
    const conTodo = [...clientesConEntrega].filter(cid => {
      const tieneEntrega = entregas.some(e => String(e.client_id) === String(cid) && e.recomendaciones_html);
      const c = allClientes.find(c => String(c.id) === String(cid));
      return tieneEntrega && c?._tiene_perfil;
    }).length;

    // Tiene entrega (plantilla) pero SIN perfil
    const sinPerfil = [...clientesConEntrega].filter(cid => {
      const tieneEntrega = entregas.some(e => String(e.client_id) === String(cid) && e.recomendaciones_html);
      const c = allClientes.find(c => String(c.id) === String(cid));
      return tieneEntrega && !c?._tiene_perfil;
    }).length;

    // Clientes sin ninguna entrega registrada
    const sinEntrega = clientes.filter(c => !clientesConEntrega.has(c.id)).length;

    document.getElementById('statusGrid').innerHTML = `
      <div class="status-card s-complete">
        <div class="status-n">${conTodo}</div>
        <div class="status-lbl">Con plantilla y perfil estrés</div>
      </div>
      <div class="status-card s-pending">
        <div class="status-n">${sinPerfil}</div>
        <div class="status-lbl">Plantilla sin perfil estrés</div>
      </div>
      <div class="status-card s-missing">
        <div class="status-n">${sinEntrega}</div>
        <div class="status-lbl">Sin entrega registrada</div>
      </div>
    `;
  }

  // ── Chart barras ──────────────────────────────────────────────
  function renderChartBarras(entregas, periodo) {
    const mesesLabel = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const rangos = {
      all:[0,1,2,3,4,5,6,7,8,9,10,11], q1:[0,1,2], q2:[3,4,5], q3:[6,7,8], q4:[9,10,11]
    };
    const idxs   = rangos[periodo];
    const labels = idxs.map(i => mesesLabel[i]);

    const nuevas   = idxs.map(i => entregas.filter(e => {
      const m = mesIdx(e.created_at);
      const esEdita = e.updated_at && Math.abs(new Date(e.updated_at) - new Date(e.created_at)) > 5000;
      return m === i && !esEdita;
    }).length);

    const editadas = idxs.map(i => entregas.filter(e => {
      const m = mesIdx(e.updated_at);
      return m === i && e.updated_at && Math.abs(new Date(e.updated_at) - new Date(e.created_at)) > 5000;
    }).length);

    const gridC = 'rgba(0,0,0,.06)', textC = '#888';

    if (chartBarras) {
      chartBarras.data.labels            = labels;
      chartBarras.data.datasets[0].data  = nuevas;
      chartBarras.data.datasets[1].data  = editadas;
      chartBarras.update();
      return;
    }
    chartBarras = new Chart(document.getElementById('cBarras'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Nuevas',   data:nuevas,   backgroundColor:'#5B8AF0', borderRadius:5, borderSkipped:false },
          { label:'Editadas', data:editadas, backgroundColor:'#52b788', borderRadius:5, borderSkipped:false },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}`} } },
        scales:{
          x:{grid:{display:false}, ticks:{color:textC, font:{size:11}}},
          y:{grid:{color:gridC},   ticks:{color:textC, font:{size:11}, precision:0}, border:{display:false}},
        },
      },
    });
  }

  // ── Chart dona ────────────────────────────────────────────────
  function renderChartDonut(entregas) {
    const cats = {'Manejo estrés':0,'Hábitos salud':0,'Autocuidado':0,'Comunicación':0,'Otros':0};
    const kw = {
      'Manejo estrés': ['estrés','estres','ansiedad','tensión','tension','relajación','relajacion'],
      'Hábitos salud': ['hábito','habito','salud','nutrición','nutricion','sueño','sueno','ejercicio'],
      'Autocuidado':   ['autocuidado','bienestar','higiene','emocional','cuidado personal'],
      'Comunicación':  ['comunicación','comunicacion','relacion','social','interpersonal','asertividad'],
    };
    entregas.forEach(e => {
      const txt = ((e.recomendaciones_html||'') + ' ' + (e.titulo_seccion||'')).toLowerCase();
      let ok = false;
      for (const [cat, palabras] of Object.entries(kw)) {
        if (palabras.some(p => txt.includes(p))) { cats[cat]++; ok = true; break; }
      }
      if (!ok) cats['Otros']++;
    });

    const labels  = Object.keys(cats).filter(k => cats[k] > 0);
    const valores = labels.map(l => cats[l]);
    const colores = ['#5B8AF0','#52b788','#f4a261','#e07a9e','#a8a0d8'];
    const total   = valores.reduce((a,b)=>a+b,0);

    document.getElementById('donutLegend').innerHTML = labels.map((l,i) => {
      const pct = total ? Math.round(valores[i]/total*100) : 0;
      return `<div class="dl-row">
        <span class="dl-left"><span class="legend-dot" style="background:${colores[i]}"></span>${l}</span>
        <span class="dl-val">${pct}%</span>
      </div>`;
    }).join('');

    if (chartDonut) {
      chartDonut.data.labels             = labels;
      chartDonut.data.datasets[0].data   = valores;
      chartDonut.data.datasets[0].backgroundColor = colores.slice(0,labels.length);
      chartDonut.update();
      return;
    }
    chartDonut = new Chart(document.getElementById('cDonut'), {
      type:'doughnut',
      data:{ labels, datasets:[{data:valores, backgroundColor:colores.slice(0,labels.length), borderWidth:0, hoverOffset:4}] },
      options:{ responsive:true, maintainAspectRatio:true, cutout:'70%',
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}`}} } },
    });
  }

  // ── Chart línea ───────────────────────────────────────────────
  function renderChartLinea(entregas, periodo) {
    const mesesLabel = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const rangos = { all:[0,1,2,3,4,5,6,7,8,9,10,11], q1:[0,1,2], q2:[3,4,5], q3:[6,7,8], q4:[9,10,11] };
    const idxs   = rangos[periodo];
    const labels = idxs.map(i => mesesLabel[i]);

    const conAmbas = entregas.filter(e => e.fecha_aplicacion && e.fecha_retroalimentacion);
    const data = idxs.map(i => {
      const del = conAmbas.filter(e => mesIdx(e.fecha_aplicacion) === i);
      if (!del.length) return 0;
      const suma = del.reduce((a,e) => a + (diffDias(e.fecha_aplicacion, e.fecha_retroalimentacion)||0), 0);
      return Math.round(suma / del.length);
    });

    const tieneData = data.some(v => v > 0);
    const promGlobal = tieneData
      ? Math.round(data.filter(v=>v>0).reduce((a,b)=>a+b,0) / data.filter(v=>v>0).length * 10) / 10
      : 0;

    const gridC = 'rgba(0,0,0,.06)', textC = '#888';

    if (chartLinea) {
      chartLinea.data.labels           = labels;
      chartLinea.data.datasets[0].data = data;
      chartLinea.data.datasets[1].data = Array(labels.length).fill(promGlobal);
      chartLinea.update();
      return;
    }
    chartLinea = new Chart(document.getElementById('cLinea'), {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:'Días promedio', data,
            borderColor:'#5B8AF0', backgroundColor:'rgba(91,138,240,.1)',
            tension:.35, fill:true, pointRadius:3, pointBackgroundColor:'#5B8AF0' },
          { label:'Promedio global', data:Array(labels.length).fill(promGlobal),
            borderColor:'#e05252', borderDash:[5,4], borderWidth:1.5, pointRadius:0, fill:false },
        ],
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw} días`}} },
        scales:{
          x:{grid:{display:false}, ticks:{color:textC, font:{size:11}}},
          y:{grid:{color:gridC},   ticks:{color:textC, font:{size:11}, callback:v=>v+'d'}, border:{display:false}, min:0},
        },
      },
    });
  }

  // ── Tabla profesionales ───────────────────────────────────────
  function renderTablaProfesionales(entregas) {
    const tbody = document.getElementById('profTableBody');
    const mapa  = {};

    // Inicializar con todos los profesionales conocidos
    allProfesionales.forEach(p => { mapa[p.id] = { nombre:p.nombre, entregas:0, conPerfil:0 }; });

    entregas.forEach(e => {
      const pid = e.profesional_id;
      if (!mapa[pid]) mapa[pid] = { nombre: e.profesional_nombre || `Prof. ${pid}`, entregas:0, conPerfil:0 };
      mapa[pid].entregas++;
      if (e._tiene_perfil) mapa[pid].conPerfil++;
    });

    const lista = Object.values(mapa).filter(p => p.entregas > 0)
      .sort((a,b) => b.entregas - a.entregas);

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="table-loading">Sin datos disponibles</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(p => {
      const pct    = p.entregas ? Math.round(p.conPerfil / p.entregas * 100) : 0;
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

  // ── Barras de cobertura ───────────────────────────────────────
  function renderBarrasCobertura(entregas) {
    const lista = document.getElementById('barList');
    const mapa  = {};
    allProfesionales.forEach(p => { mapa[p.id] = { nombre:p.nombre, total:0, conPerfil:0 }; });
    entregas.forEach(e => {
      const pid = e.profesional_id;
      if (!mapa[pid]) mapa[pid] = { nombre:e.profesional_nombre||`Prof. ${pid}`, total:0, conPerfil:0 };
      mapa[pid].total++;
      if (e._tiene_perfil) mapa[pid].conPerfil++;
    });

    const datos = Object.values(mapa).filter(p => p.total > 0).sort((a,b) => b.total - a.total);
    if (!datos.length) {
      lista.innerHTML = `<p style="font-size:13px;color:#9aa3b5;text-align:center;padding:16px 0">Sin datos disponibles</p>`;
      return;
    }
    lista.innerHTML = datos.map(p => {
      const pct   = Math.round(p.conPerfil / p.total * 100);
      const color = pct >= 80 ? '#52b788' : pct >= 55 ? '#f4a261' : '#e05252';
      return `<div class="bar-row">
        <div class="bar-meta">
          <span class="bar-name">${p.nombre}</span>
          <span class="bar-stat">${p.conPerfil} / ${p.total} · ${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ============================================================
  // FILTRO DE PERÍODO
  // ============================================================
  document.getElementById('chipGroup')?.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    periodoActual = chip.dataset.period;
    const entregas = entregasFiltradas();
    renderChartBarras(entregasPorPeriodo(entregas, periodoActual), periodoActual);
    renderChartLinea(entregasPorPeriodo(entregas, periodoActual), periodoActual);
  });

  // ============================================================
  // BOTÓN ACTUALIZAR
  // ============================================================
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnRefresh');
    btn.classList.add('spinning');
    btn.disabled = true;
    // Destruir gráficas para que se recreen con datos frescos
    [chartBarras, chartDonut, chartLinea].forEach(c => c?.destroy());
    chartBarras = chartDonut = chartLinea = null;
    await cargarTodosLosDatos();
    btn.classList.remove('spinning');
    btn.disabled = false;
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