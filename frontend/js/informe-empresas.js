// js/informe-empresas.js
// Dashboard de Informe Empresas — Solo admin
// Lógica de clasificación:
//   CRÍTICO      → confidencial=true  + sesiones >= 3
//   EN OBSERVACIÓN → confidencial=true  + sesiones <  3
//   COMPLEJO     → confidencial=false + sesiones >= 5
//   NORMAL       → confidencial=false + sesiones <  5
// Reingresos: trabajadores con consulta_number >= 2

(function () {
  "use strict";

  // ─── CONFIG ────────────────────────────────────────
  // Igual que perfil.js: window.API_CONFIG.BASE_URL + "/api"
  const API = (window.API_CONFIG && window.API_CONFIG.BASE_URL)
    ? window.API_CONFIG.BASE_URL
    : "";
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  // Chart.js defaults (tema oscuro)
  Chart.defaults.color = "#8b94a8";
  Chart.defaults.borderColor = "rgba(255,255,255,0.07)";
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  // ─── ESTADO ────────────────────────────────────────
  let rawClients      = [];  // todos los clientes
  let rawConsultas    = [];  // sesiones de Orientación Psicosocial
  let rawConsultasSve = [];  // sesiones de SVE (/api/consultas-sve)
  let rawMesaTrabajoSve = []; // registros mesa de trabajo SVE (criterio_inclusion)
  let rawEntregas     = [];  // registros de Entrega Individual de Resultados
  let empresas        = [];  // catálogo de empresas
  let charts          = {};  // instancias Chart.js activas
  let lastSnapshot    = null; // snapshot para el informe imprimible

  // ─── HELPERS JWT ───────────────────────────────────
  function getToken() {
    // El proyecto guarda el JWT bajo la clave "authToken" (ver script.js / perfil.js)
    return localStorage.getItem("authToken") || "";
  }

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
  }

  // ─── INIT ───────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    // Verificar que es admin (auth-check.js ya redirige si no hay sesión,
    // pero aquí protegemos la vista en caso de carga directa)
    // El proyecto guarda el usuario bajo la clave "userData" (ver perfil.js)
    const raw = localStorage.getItem("userData");
    const userData = raw ? JSON.parse(raw) : {};
    if (userData.rol !== "admin") {
      window.location.href = "perfil.html";
      return;
    }

    // Botones de navegación
    document.getElementById("btnBack").addEventListener("click", () => {
      history.back();
    });
    document.getElementById("btnRefresh").addEventListener("click", () => aplicarFiltros());
    document.getElementById("btnApply").addEventListener("click", () => aplicarFiltros());
    document.getElementById("btnPrintReport").addEventListener("click", abrirInforme);
    document.getElementById("btnClear").addEventListener("click", limpiarFiltros);

    // Poblar selector de años
    const anioSel = document.getElementById("filterAnio");
    const anioActual = new Date().getFullYear();
    for (let y = anioActual; y >= anioActual - 4; y--) {
      anioSel.innerHTML += `<option value="${y}">${y}</option>`;
    }
    anioSel.value = String(anioActual);

    // Cargar catálogo empresas
    await cargarEmpresas();

    // Primera carga
    await aplicarFiltros();
  });

  // ─── EMPRESAS ───────────────────────────────────────
  // Solo descarga el catálogo. El filtrado a empresas con registros
  // lo hace poblarSelectEmpresa() una vez que rawClients está cargado.
  async function cargarEmpresas() {
    try {
      const res = await fetch(`${API}/api/empresas`, { headers: authHeaders() });
      if (!res.ok) return;
      empresas = await res.json();
    } catch (err) {
      console.error("Error cargando empresas:", err);
    }
  }

  // Puebla el buscador con solo las empresas que tienen al menos un trabajador registrado.
  function poblarSelectEmpresa() {
    // IDs presentes en clients.subcontratista_id
    const idsConRegistros = new Set(
      rawClients.map(c => c.subcontratista_id).filter(id => id != null)
    );
    const empresasConRegistros = empresas
      .filter(e => idsConRegistros.has(e.id))
      .sort((a, b) => {
        const la = (a.cliente_definitivo || a.cliente_final || "").toLowerCase();
        const lb = (b.cliente_definitivo || b.cliente_final || "").toLowerCase();
        return la.localeCompare(lb);
      });

    renderEmpresaOptions(empresasConRegistros, "");
    setupEmpresaBuscador(empresasConRegistros);
  }

  // Renderiza las opciones del buscador (con highlight del término buscado).
  function renderEmpresaOptions(lista, termino) {
    const container = document.getElementById("empresaOptions");
    if (!container) return;

    container.innerHTML = "";

    if (lista.length === 0 && termino) {
      container.innerHTML = '<div class="empresa-option no-match">Sin resultados</div>';
      return;
    }

    const currentVal = document.getElementById("filterEmpresa").value;

    // Opción "Todas"
    const todas = document.createElement("div");
    todas.className = "empresa-option" + (currentVal === "" ? " selected" : "");
    todas.textContent = "Todas las empresas";
    todas.dataset.value = "";
    todas.dataset.label = "Todas las empresas";
    container.appendChild(todas);

    lista.forEach(e => {
      const label = e.cliente_definitivo || e.cliente_final || e.nombre_cliente || ("Empresa " + e.id);
      const div = document.createElement("div");
      div.className = "empresa-option" + (String(e.id) === currentVal ? " selected" : "");
      div.dataset.value = String(e.id);
      div.dataset.label = label;

      if (termino) {
        const idx = label.toLowerCase().indexOf(termino.toLowerCase());
        if (idx >= 0) {
          div.innerHTML =
            escHtml(label.slice(0, idx)) +
            '<span class="match-highlight">' + escHtml(label.slice(idx, idx + termino.length)) + '</span>' +
            escHtml(label.slice(idx + termino.length));
        } else {
          div.textContent = label;
        }
      } else {
        div.textContent = label;
      }
      container.appendChild(div);
    });

    // Click delegado en todo el contenedor
    container.onclick = (ev) => {
      const opt = ev.target.closest(".empresa-option");
      if (!opt || opt.classList.contains("no-match")) return;
      seleccionarEmpresa(opt.dataset.value, opt.dataset.label);
    };
  }

  // Configura apertura/cierre y filtrado del buscador de empresa.
  // Se llama desde poblarSelectEmpresa (puede llamarse varias veces;
  // usamos un flag para no duplicar listeners).
  let _empresaBuscadorSetup = false;
  function setupEmpresaBuscador(empresasConRegistros) {
    if (_empresaBuscadorSetup) {
      // Solo re-renderiza las opciones con la lista actualizada
      const searchInp = document.getElementById("empresaSearch");
      renderEmpresaOptions(empresasConRegistros, searchInp ? searchInp.value.trim() : "");
      return;
    }
    _empresaBuscadorSetup = true;

    const trigger   = document.getElementById("empresaTrigger");
    const dropdown  = document.getElementById("empresaDropdown");
    const searchInp = document.getElementById("empresaSearch");
    const clearBtn  = document.getElementById("empresaSearchClear");
    const wrapper   = document.getElementById("empresaSelectWrapper");

    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", () => {
      const isOpen = dropdown.style.display === "block";
      if (isOpen) {
        cerrarEmpresaDropdown();
      } else {
        dropdown.style.display = "block";
        trigger.classList.add("open");
        renderEmpresaOptions(empresasConRegistros, "");
        setTimeout(() => searchInp && searchInp.focus(), 60);
      }
    });

    document.addEventListener("click", (ev) => {
      if (wrapper && !wrapper.contains(ev.target)) cerrarEmpresaDropdown();
    });

    if (searchInp) {
      searchInp.addEventListener("input", () => {
        const term = searchInp.value.trim();
        clearBtn.style.display = term ? "inline" : "none";
        const filtradas = term
          ? empresasConRegistros.filter(e => {
              const label = (e.cliente_definitivo || e.cliente_final || "").toLowerCase();
              return label.includes(term.toLowerCase());
            })
          : empresasConRegistros;
        renderEmpresaOptions(filtradas, term);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        searchInp.value = "";
        clearBtn.style.display = "none";
        renderEmpresaOptions(empresasConRegistros, "");
        searchInp.focus();
      });
    }
  }

  function seleccionarEmpresa(value, label) {
    document.getElementById("filterEmpresa").value = value || "";
    const triggerText = document.getElementById("empresaTriggerText");
    if (triggerText) triggerText.textContent = label || "Todas las empresas";
    cerrarEmpresaDropdown();
    // Actualizar sedes al cambiar empresa
    const clientesFiltrados = rawClients.filter(c =>
      !value || String(c.subcontratista_id) === value
    );
    actualizarSedes(clientesFiltrados);
  }

  function cerrarEmpresaDropdown() {
    const dropdown  = document.getElementById("empresaDropdown");
    const trigger   = document.getElementById("empresaTrigger");
    const searchInp = document.getElementById("empresaSearch");
    const clearBtn  = document.getElementById("empresaSearchClear");
    if (dropdown)  dropdown.style.display = "none";
    if (trigger)   trigger.classList.remove("open");
    if (searchInp) searchInp.value = "";
    if (clearBtn)  clearBtn.style.display = "none";
  }

  function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }


  // ─── CARGA DE DATOS ─────────────────────────────────
  // Traemos todo sin filtros de URL. El filtro real se hace localmente
  // en filtrarDatos() usando subcontratista_id, sede, etc.
  async function cargarDatos() {
    const [resClients, resConsultas, resConsultasSve, resMesa, resEntregas] = await Promise.all([
      fetch(`${API}/api/clients`,           { headers: authHeaders() }),
      fetch(`${API}/api/consultas`,         { headers: authHeaders() }),
      fetch(`${API}/api/consultas-sve`,     { headers: authHeaders() }),
      fetch(`${API}/api/mesa-trabajo-sve`,  { headers: authHeaders() }),
      fetch(`${API}/api/entrega-resultados`,{ headers: authHeaders() }),
    ]);

    rawClients        = resClients.ok      ? await resClients.json()      : [];
    rawConsultas      = resConsultas.ok    ? await resConsultas.json()    : [];
    rawConsultasSve   = resConsultasSve.ok ? await resConsultasSve.json() : [];
    rawMesaTrabajoSve = resMesa.ok         ? await resMesa.json()         : [];
    rawEntregas       = resEntregas.ok     ? await resEntregas.json()     : [];

    // Normalizar sesiones SVE para que sean compatibles con la lógica existente:
    // - Agregar consulta_number = 1 (SVE no lo tiene, cada registro es independiente)
    // - Agregar motivo_consulta = null (SVE no tiene este campo)
    // - Agregar observaciones_confidenciales = false
    rawConsultasSve = rawConsultasSve.map(s => ({
      ...s,
      consulta_number:             s.consulta_number             ?? 1,
      motivo_consulta:             s.motivo_consulta             ?? null,
      observaciones_confidenciales: s.observaciones_confidenciales ?? false,
    }));
  }

  // ─── FILTRAR DATOS LOCALMENTE ────────────────────────
  function filtrarDatos() {
    const subcontratistaId = document.getElementById("filterEmpresa").value;
    const sedeVal          = document.getElementById("filterSede").value;
    const modalidad        = document.getElementById("filterModalidad").value;
    const anio             = parseInt(document.getElementById("filterAnio").value) || null;
    const mes              = parseInt(document.getElementById("filterMes").value) || null;

    // El select guarda códigos cortos de localStorage ('orientacion','vigilancia')
    // pero la BD guarda el texto completo. Mapeamos antes de comparar.
    const MODALIDAD_MAP = {
      "orientacion": "Orientación Psicosocial",
      "vigilancia":  "Sistema de Vigilancia Epidemiológica",
      "entrega":     "Entrega Individual de Resultados",
    };
    const modalidadBD = MODALIDAD_MAP[modalidad] || modalidad; // si ya es texto completo, lo usa tal cual

    // Filtrar clientes por empresa, sede y modalidad del programa
    let clientes = rawClients.filter(c => {
      if (subcontratistaId && String(c.subcontratista_id) !== subcontratistaId) return false;
      if (sedeVal    && c.sede      !== sedeVal)      return false;
      if (modalidadBD && c.modalidad !== modalidadBD) return false;
      return true;
    });

    const clienteIds = new Set(clientes.map(c => c.id));

    // Seleccionar el pool de sesiones según modalidad del programa:
    // - "Orientación Psicosocial" → solo rawConsultas
    // - "Sistema de Vigilancia Epidemiológica" → solo rawConsultasSve
    // - Sin filtro → ambas combinadas
    let pool;
    if (modalidadBD === "Orientación Psicosocial") {
      pool = rawConsultas;
    } else if (modalidadBD === "Sistema de Vigilancia Epidemiológica") {
      pool = rawConsultasSve;
    } else if (modalidadBD === "Entrega Individual de Resultados") {
      // Normalizar registros de entrega para que sean compatibles con el
      // filtro genérico de abajo (cliente_id / fecha).
      pool = rawEntregas.map(e => ({
        ...e,
        cliente_id: e.client_id,
        fecha:      e.fecha_aplicacion || e.created_at,
      }));
    } else {
      // Todos: combinar ambas fuentes, evitando IDs duplicados
      // (un mismo id puede existir en ambas tablas — usamos prefijo para diferenciar)
      pool = [
        ...rawConsultas.map(s    => ({ ...s, _src: "ps"  })),
        ...rawConsultasSve.map(s => ({ ...s, _src: "sve", id: `sve_${s.id}` })),
      ];
    }

    // Filtrar por clienteIds y fecha
    let sesiones = pool.filter(s => {
      if (!clienteIds.has(s.cliente_id)) return false;
      if (anio || mes) {
        const f = new Date(s.fecha);
        if (anio && f.getFullYear() !== anio) return false;
        if (mes  && f.getMonth() + 1 !== mes)  return false;
      }
      return true;
    });

    return { clientes, sesiones };
  }

  // ─── ACTUALIZAR SEDES DISPONIBLES ───────────────────
  function actualizarSedes(clientes) {
    const sel = document.getElementById("filterSede");
    const current = sel.value;
    const sedes = [...new Set(clientes.map(c => c.sede).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todas las sedes</option>';
    sedes.forEach(s => {
      sel.innerHTML += `<option value="${s}"${s === current ? " selected" : ""}>${s}</option>`;
    });
  }

  // ─── CLASIFICAR CASO ────────────────────────────────
  // sesiones: array de sesiones del trabajador (un consulta_number)
  function clasificarCaso(sesiones) {
    const n = sesiones.length;
    const esConfi = sesiones.some(s => s.observaciones_confidenciales === true);
    if (esConfi && n >= 3) return "critico";
    if (esConfi && n < 3)  return "observacion";
    if (!esConfi && n >= 5) return "complejo";
    return "normal";
  }

  // Agrupar sesiones por (cliente_id, consulta_number) → casos
  function agruparEnCasos(sesiones) {
    const map = new Map();
    sesiones.forEach(s => {
      const key = `${s.cliente_id}_${s.consulta_number}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map; // Map<key, sesiones[]>
  }

  // ─── LIMPIAR FILTROS ─────────────────────────────────
  function limpiarFiltros() {
    // Resetear selects estándar
    document.getElementById("filterSede").value     = "";
    document.getElementById("filterModalidad").value = "";
    const anioActual = new Date().getFullYear();
    document.getElementById("filterAnio").value     = String(anioActual);
    document.getElementById("filterMes").value      = "";

    // Resetear buscador de empresa
    seleccionarEmpresa("", "Todas las empresas");

    // Reaplicar con filtros limpios
    aplicarFiltros();
  }

  // ─── MOTOR PRINCIPAL ────────────────────────────────
  async function aplicarFiltros() {
    setLoading(true);

    try {
      // Cargamos todo sin filtro de URL; el filtro es local
      await cargarDatos();

      // Poblar el buscador de empresa (solo las que tienen registros)
      // Se llama en cada refresh para reflejar nuevos registros
      poblarSelectEmpresa();

      // Sedes disponibles: solo las que realmente tienen los clientes
      // filtradas ya por la empresa (subcontratista) seleccionada
      const subcontratistaId = document.getElementById("filterEmpresa").value;
      const clientesFiltradosParaSede = rawClients.filter(c =>
        !subcontratistaId || String(c.subcontratista_id) === subcontratistaId
      );
      actualizarSedes(clientesFiltradosParaSede);

      const { clientes, sesiones } = filtrarDatos();
      renderDashboard(clientes, sesiones);
      actualizarTimestamp();

      // Guardar snapshot para el informe imprimible
      lastSnapshot = buildSnapshot(clientes, sesiones);
    } catch (err) {
      console.error("Error aplicando filtros:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── RENDER PRINCIPAL ───────────────────────────────
  function renderDashboard(clientes, sesiones) {
    const modalidadFiltro = document.getElementById("filterModalidad").value;
    const esSVE     = modalidadFiltro === "vigilancia";
    const esEntrega = modalidadFiltro === "entrega";

    aplicarEtiquetasModalidad(esEntrega);

    // Mostrar/ocultar tarjetas KPI según modalidad
    const cardConfi   = document.getElementById("cardConfidenciales");
    const cardCritico = document.getElementById("cardCriticos");
    const cardProf    = document.getElementById("cardProfesionales");
    const kpiGrid     = document.querySelector(".kpi-grid");
    if (cardConfi)   cardConfi.style.display   = (esSVE || esEntrega) ? "none" : "";
    if (cardCritico) cardCritico.style.display  = (esSVE || esEntrega) ? "none" : "";
    if (cardProf)    cardProf.style.display     = esEntrega ? "" : "none";
    if (kpiGrid) {
      kpiGrid.classList.remove("kpi-grid-sve", "kpi-grid-entrega");
      if (esSVE)     kpiGrid.classList.add("kpi-grid-sve");
      if (esEntrega) kpiGrid.classList.add("kpi-grid-entrega");
    }
    // Sección vínculo: solo en Orientación Psicosocial
    const secVinculo = document.getElementById("secVinculo");
    if (secVinculo) secVinculo.style.display = (esSVE || esEntrega) ? "none" : "";

    // Entrega Individual de Resultados tiene su propio flujo de render,
    // porque sus registros no tienen consulta_number/estado/confidencialidad
    // (no forman "casos" como OP/SVE).
    if (esEntrega) {
      renderKPIsEntrega(clientes, sesiones);
      renderPruebasProfundidad(sesiones);
      renderEstadosEntrega(sesiones);
      renderRecomendacionesEntrega(sesiones);
      renderCoberturaEntrega(clientes, sesiones);
      renderSedesEntrega(clientes, sesiones);
      return;
    }

    const casos = agruparEnCasos(sesiones);

    // ── KPIs
    renderKPIs(clientes, sesiones, casos);

    // Actualizar título del panel de tendencia según modalidad
    // (modalidadFiltro ya declarado arriba)
    const tituloPanel = document.querySelector(".chart-title");
    if (tituloPanel) {
      if (modalidadFiltro === "vigilancia") {
        tituloPanel.innerHTML = 'Criterio de Inclusión al SVE <span class="badge-top5">Top 5</span>';
      } else {
        tituloPanel.innerHTML = 'Motivos de consulta más frecuentes <span class="badge-top5">Top 5</span>';
      }
    }

    // ── Tendencia — alternar motivos (OP) o criterios (SVE) según modalidad
    if (modalidadFiltro === "vigilancia") {
      renderCriteriosSve(sesiones);
    } else {
      renderMotivos(sesiones);
    }
    renderEstados(casos); // Pasa casos (consultas únicas), no sesiones

    // ── Vínculo — solo Orientación Psicosocial
    if (!esSVE) {
      renderVinculo(clientes, sesiones);
    }

    // ── Complejidad — alternar según modalidad
    if (modalidadFiltro === "vigilancia") {
      renderComplejidadSve(sesiones);
    } else {
      renderComplejidad(casos);
    }

    // ── Casos críticos — DESACTIVADO TEMPORALMENTE
    // renderCriticos(sesiones, casos);

    // ── Confidencialidad — DESACTIVADO TEMPORALMENTE
    // renderConfidencialidad(sesiones);

    // ── Cobertura
    renderCobertura(clientes, sesiones);

    // ── Sedes
    renderSedes(clientes, sesiones, casos, esSVE);
  }

  // ── SECCIÓN 1: KPIs ─────────────────────────────────
  // Sesiones y casos ya filtrados por el periodo seleccionado.
  function renderKPIs(clientes, sesiones, casos) {

    // ── Trabajadores atendidos ─────────────────────────
    // Únicos con al menos 1 sesión en el periodo.
    const trabConSesion = new Set(sesiones.map(s => s.cliente_id));

    // ── Total sesiones ─────────────────────────────────
    const totalSesiones = sesiones.length;

    // ── Total consultas ────────────────────────────────
    // Igual a trabajadores atendidos: cada trabajador con sesión en el periodo = 1 consulta.
    const totalConsultas = trabConSesion.size;

    // ── Casos abiertos y cerrados ──────────────────────
    // Misma lógica que la gráfica "Abiertos vs Cerrados" (renderEstados):
    // sobre casos del periodo — abierto si tiene al menos 1 sesión "Abierto",
    // cerrado si todas sus sesiones están "Cerrado". Siempre suman = total consultas.
    let casosAbiertos = 0;
    let casosCerrados = 0;
    casos.forEach(ss => {
      const tieneAbierta = ss.some(s => s.estado === "Abierto");
      if (tieneAbierta) casosAbiertos++;
      else casosCerrados++;
    });

    // ── Casos confidenciales ───────────────────────────
    const casosConfi = new Set();
    sesiones.filter(s => s.observaciones_confidenciales === true).forEach(s =>
      casosConfi.add(`${s.cliente_id}_${s.consulta_number}`)
    );

    // ── Casos críticos ─────────────────────────────────
    let criticos = 0;
    casos.forEach(ss => { if (clasificarCaso(ss) === "critico") criticos++; });

    setText("kpiTrabajadores",  trabConSesion.size);
    setText("kpiSesiones",      totalSesiones);
    setText("kpiAbiertos",      casosAbiertos);
    setText("kpiCerrados",      casosCerrados);
    setText("kpiConfidenciales",casosConfi.size);
    setText("kpiCriticos",      criticos);
  }

  // ── Criterios de Inclusión SVE ──────────────────────
  // Cuenta criterio_inclusion por trabajador único, solo entre los trabajadores
  // atendidos en el periodo filtrado (mismo criterio que el KPI "Trabajadores atendidos").
  // Si un trabajador tiene más de un registro en mesa_trabajo_sve, se cuenta
  // solo el más reciente para no inflar el total.
  function renderCriteriosSve(sesiones) {
    const container = document.getElementById("tablaMotivos");
    if (!container) return;

    const trabajadoresIds = new Set(sesiones.map(s => s.cliente_id));

    const criterioPorTrabajador = new Map();
    rawMesaTrabajoSve
      .filter(m => trabajadoresIds.has(m.cliente_id) && m.criterio_inclusion)
      .sort((a, b) => (a.id || 0) - (b.id || 0))
      .forEach(m => criterioPorTrabajador.set(m.cliente_id, m.criterio_inclusion.trim()));

    const conteo = {};
    criterioPorTrabajador.forEach(criterio => {
      conteo[criterio] = (conteo[criterio] || 0) + 1;
    });

    const items = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (items.length === 0) {
      container.innerHTML = '<div class="motivos-empty">Sin criterios de inclusión registrados</div>';
      return;
    }

    const TOP = 5;
    const maxVal         = items[0][1];
    const totalMenciones = items.reduce((s, [, v]) => s + v, 0);
    const hayMas         = items.length > TOP;

    const filaHTML = ([criterio, count], idx) => {
      const pct    = totalMenciones > 0 ? Math.round((count / totalMenciones) * 100) : 0;
      const barPct = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
      const rankCls  = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "";
      const extraCls = idx >= TOP ? "motivo-extra" : "";
      return `
        <tr class="${extraCls}">
          <td class="td-rank"><span class="rank-badge ${rankCls}">${idx + 1}</span></td>
          <td class="td-motivo">
            <div class="motivo-nombre">${criterio}</div>
            <div class="motivo-bar-track">
              <div class="motivo-bar-fill" style="width:${barPct}%"></div>
            </div>
          </td>
          <td class="td-count">
            <span class="count-num">${count}</span>
            <span class="count-pct">(${pct}%)</span>
          </td>
        </tr>`;
    };

    let html = `
      <table class="tabla-motivos">
        <thead><tr>
          <th class="td-rank">#</th>
          <th>Criterio de Inclusión al SVE</th>
          <th class="td-count">Casos</th>
        </tr></thead>
        <tbody>${items.map(filaHTML).join("")}</tbody>
      </table>`;

    if (hayMas) {
      const restantes = items.length - TOP;
      html += `
        <button class="btn-ver-mas-motivos" id="btnVerMasMotivos">
          Ver ${restantes} criterio${restantes > 1 ? "s" : ""} más
          <span class="btn-arrow">▼</span>
        </button>`;
    }

    container.innerHTML = html;

    if (hayMas) {
      const btn = document.getElementById("btnVerMasMotivos");
      btn.addEventListener("click", () => {
        const expanded = btn.classList.toggle("expanded");
        document.querySelectorAll(".motivo-extra").forEach(tr =>
          tr.classList.toggle("visible", expanded)
        );
        const restantes = items.length - TOP;
        btn.childNodes[0].textContent = expanded
          ? "Ver menos "
          : `Ver ${restantes} criterio${restantes > 1 ? "s" : ""} más `;
      });
    }
  }

  // ── SECCIÓN 2: TENDENCIA ────────────────────────────
  // ── Motivos de consulta más frecuentes ─────────────
  // motivo_consulta se guarda como string en la BD.
  // Cuando hay múltiples motivos vienen separados por ", "
  // (ej: "AUTOLESIONES, BAJA AUTOESTIMA, ACOMPAÑAMIENTO JUBILACIÓN").
  // Contamos cada término independiente y ordenamos de mayor a menor.
  function renderMotivos(sesiones) {
    const conteo = {};
    const consultasVistas = new Set();

    sesiones.forEach(s => {
      if (!s.motivo_consulta) return;
      const clave = `${s.cliente_id}_${s.consulta_number}`;
      if (consultasVistas.has(clave)) return;
      consultasVistas.add(clave);
      s.motivo_consulta
        .split("|")
        .map(m => m.trim().toUpperCase())
        .filter(m => m.length > 0)
        .forEach(m => { conteo[m] = (conteo[m] || 0) + 1; });
    });

    const container = document.getElementById("tablaMotivos");
    if (!container) return;

    const items = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (items.length === 0) {
      container.innerHTML = '<div class="motivos-empty">Sin motivos registrados en el periodo</div>';
      return;
    }

    const TOP = 5;
    const maxVal         = items[0][1];
    const totalMenciones = items.reduce((s, [, v]) => s + v, 0);
    const hayMas         = items.length > TOP;

    const filaHTML = ([motivo, count], idx) => {
      const pct    = totalMenciones > 0 ? Math.round((count / totalMenciones) * 100) : 0;
      const barPct = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
      const rankCls  = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "";
      const extraCls = idx >= TOP ? "motivo-extra" : "";
      return `
        <tr class="${extraCls}">
          <td class="td-rank"><span class="rank-badge ${rankCls}">${idx + 1}</span></td>
          <td class="td-motivo">
            <div class="motivo-nombre">${motivo}</div>
            <div class="motivo-bar-track">
              <div class="motivo-bar-fill" style="width:${barPct}%"></div>
            </div>
          </td>
          <td class="td-count">
            <span class="count-num">${count}</span>
            <span class="count-pct">(${pct}%)</span>
          </td>
        </tr>`;
    };

    let html = `
      <table class="tabla-motivos" id="tablaMotivosTable">
        <thead>
          <tr>
            <th class="td-rank">#</th>
            <th>Motivo de consulta</th>
            <th class="td-count">Casos</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(filaHTML).join("")}
        </tbody>
      </table>`;

    // Botón "ver más" solo si hay más de 5
    if (hayMas) {
      const restantes = items.length - TOP;
      html += `
        <button class="btn-ver-mas-motivos" id="btnVerMasMotivos">
          Ver ${restantes} motivo${restantes > 1 ? "s" : ""} más
          <span class="btn-arrow">▼</span>
        </button>`;
    }

    container.innerHTML = html;

    // Evento del botón ver más
    if (hayMas) {
      const btn = document.getElementById("btnVerMasMotivos");
      btn.addEventListener("click", () => {
        const expanded = btn.classList.toggle("expanded");
        document.querySelectorAll(".motivo-extra").forEach(tr =>
          tr.classList.toggle("visible", expanded)
        );
        const restantes = items.length - TOP;
        btn.childNodes[0].textContent = expanded
          ? "Ver menos "
          : `Ver ${restantes} motivo${restantes > 1 ? "s" : ""} más `;
      });
    }
  }

  // Cuenta consultas únicas (cliente_id + consulta_number), no sesiones individuales.
  // Una consulta es "Abierta" si tiene al menos 1 sesión con estado Abierto.
  // Es "Cerrada" si todas sus sesiones están Cerradas.
  function renderEstados(casos) {
    let abiertos = 0;
    let cerrados = 0;

    casos.forEach(sesiones => {
      const tieneAbierta = sesiones.some(s => s.estado === "Abierto");
      if (tieneAbierta) abiertos++;
      else cerrados++;
    });

    const total = abiertos + cerrados;
    const pctAbiertos = total > 0 ? Math.round((abiertos / total) * 100) : 0;
    const pctCerrados = total > 0 ? Math.round((cerrados / total) * 100) : 0;

    destroyChart("chartEstados");
    const ctx = document.getElementById("chartEstados").getContext("2d");
    charts.estados = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          `Abiertas (${abiertos} — ${pctAbiertos}%)`,
          `Cerradas (${cerrados} — ${pctCerrados}%)`
        ],
        datasets: [{
          data: [abiertos, cerrados],
          backgroundColor: ["#f59e0b", "#10b981"],
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...chartOptionsDoughnut(),
        plugins: {
          ...chartOptionsDoughnut().plugins,
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${val} consulta${val !== 1 ? "s" : ""} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ── SECCIÓN 2b: VÍNCULO (solo OP) ───────────────────
  // Cuenta trabajadores únicos por vínculo (campo clients.vinculo).
  // "Trabajador" o "Familiar Trabajador"
  function renderVinculo(clientes, sesiones) {
    // Solo clientes con sesiones en el periodo
    const clientesConSesion = new Set(sesiones.map(s => s.cliente_id));
    const atendidos = clientes.filter(c => clientesConSesion.has(c.id));

    let trabajadores = 0;
    let familiares   = 0;
    atendidos.forEach(c => {
      if (c.vinculo === "Trabajador") trabajadores++;
      else if (c.vinculo === "Familiar Trabajador") familiares++;
    });

    const total = trabajadores + familiares;
    const pct   = v => total > 0 ? Math.round((v / total) * 100) : 0;

    // ── Gráfica dona
    destroyChart("chartVinculo");
    const ctx = document.getElementById("chartVinculo");
    if (ctx) {
      charts.vinculo = new Chart(ctx.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: [
            `Trabajador (${trabajadores} — ${pct(trabajadores)}%)`,
            `Familiar Trabajador (${familiares} — ${pct(familiares)}%)`,
          ],
          datasets: [{
            data: [trabajadores, familiares],
            backgroundColor: ["#6366f1", "#2dd4bf"],
            borderWidth: 0,
            hoverOffset: 8,
          }]
        },
        options: {
          ...chartOptionsDoughnut(),
          plugins: {
            ...chartOptionsDoughnut().plugins,
            tooltip: {
              ...tooltipStyle(),
              callbacks: {
                label: ctx => {
                  const val = ctx.parsed;
                  const p = total > 0 ? Math.round((val / total) * 100) : 0;
                  return ` ${val} persona${val !== 1 ? "s" : ""} (${p}%)`;
                }
              }
            }
          }
        }
      });
    }

    // ── Tabla de detalle
    const tabla = document.getElementById("tablaVinculo");
    if (!tabla) return;

    const items = [
      { label: "Trabajador",           count: trabajadores, cls: "trabajador" },
      { label: "Familiar Trabajador",  count: familiares,   cls: "familiar"   },
    ];

    tabla.innerHTML = items.map(item => {
      const barPct = total > 0 ? Math.round((item.count / total) * 100) : 0;
      return `
        <div class="vinculo-row">
          <div class="vinculo-dot vinculo-dot-${item.cls}"></div>
          <span class="vinculo-label">${item.label}</span>
          <div class="vinculo-bar-track">
            <div class="vinculo-bar-fill-${item.cls}" style="width:${barPct}%"></div>
          </div>
          <div class="vinculo-stats">
            <span class="vinculo-count">${item.count}</span>
            <span class="vinculo-pct">${pct(item.count)}%</span>
          </div>
        </div>`;
    }).join("");
  }

  // ── SECCIÓN 3: COMPLEJIDAD ───────────────────────────
  function renderComplejidad(casos) {
    const counts = { normal: 0, complejo: 0, observacion: 0, critico: 0 };
    casos.forEach(ss => counts[clasificarCaso(ss)]++);

    // Restaurar la leyenda original de OP por si venimos de SVE
    // (SVE reemplaza el innerHTML de la leyenda con sus propios elementos)
    const legendContainer = document.querySelector(".complexity-legend");
    if (legendContainer && !document.getElementById("cntNormal")) {
      legendContainer.innerHTML = `
        <div class="legend-item legend-normal">
          <div class="legend-dot"></div>
          <div>
            <p class="legend-name">Normal</p>
            <p class="legend-desc">Sin confidencialidad · 1–4 sesiones</p>
            <p class="legend-count" id="cntNormal">—</p>
          </div>
        </div>
        <div class="legend-item legend-complejo">
          <div class="legend-dot"></div>
          <div>
            <p class="legend-name">Complejo</p>
            <p class="legend-desc">Sin confidencialidad · 5+ sesiones</p>
            <p class="legend-count" id="cntComplejo">—</p>
          </div>
        </div>
        <div class="legend-item legend-observacion">
          <div class="legend-dot"></div>
          <div>
            <p class="legend-name">En observación</p>
            <p class="legend-desc">Con confidencialidad · 1–2 sesiones</p>
            <p class="legend-count" id="cntObservacion">—</p>
          </div>
        </div>
        <div class="legend-item legend-critico">
          <div class="legend-dot"></div>
          <div>
            <p class="legend-name">Crítico</p>
            <p class="legend-desc">Con confidencialidad · 3+ sesiones</p>
            <p class="legend-count" id="cntCritico">—</p>
          </div>
        </div>`;
    }

    setText("cntNormal",     counts.normal);
    setText("cntComplejo",   counts.complejo);
    setText("cntObservacion",counts.observacion);
    setText("cntCritico",    counts.critico);

    const total = counts.normal + counts.complejo + counts.observacion + counts.critico;
    const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

    destroyChart("chartComplejidad");
    const ctx = document.getElementById("chartComplejidad").getContext("2d");
    charts.complejidad = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          `Normal (${counts.normal} — ${pct(counts.normal)}%)`,
          `Complejo (${counts.complejo} — ${pct(counts.complejo)}%)`,
          `En observación (${counts.observacion} — ${pct(counts.observacion)}%)`,
          `Crítico (${counts.critico} — ${pct(counts.critico)}%)`,
        ],
        datasets: [{
          data: [counts.normal, counts.complejo, counts.observacion, counts.critico],
          backgroundColor: ["#10b981", "#f59e0b", "#a78bfa", "#f43f5e"],
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...chartOptionsDoughnut(),
        plugins: {
          ...chartOptionsDoughnut().plugins,
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const p = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${val} caso${val !== 1 ? "s" : ""} (${p}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ── SECCIÓN 3b: COMPLEJIDAD SVE ─────────────────────
  // nivel_complejidad se selecciona en la PRIMERA sesión del caso.
  // Como puede estar fuera del periodo filtrado, buscamos en rawConsultasSve
  // (histórico completo) pero solo para casos que tienen sesiones en el periodo.
  function renderComplejidadSve(sesiones) {
    // Casos con al menos 1 sesión en el periodo filtrado
    const casosEnPeriodo = new Set(
      sesiones.map(s => `${s.cliente_id}_${s.consulta_number}`)
    );

    // Para cada caso del periodo, buscar su primera sesión histórica en rawConsultasSve
    // y tomar el nivel_complejidad de ahí
    const casoNivel = {};
    rawConsultasSve
      .filter(s => {
        const clave = `${s.cliente_id}_${s.consulta_number}`;
        return casosEnPeriodo.has(clave) && s.nivel_complejidad;
      })
      .forEach(s => {
        const clave = `${s.cliente_id}_${s.consulta_number}`;
        // Guardar la sesión más antigua (primera sesión del caso)
        if (!casoNivel[clave]) {
          casoNivel[clave] = { nivel: s.nivel_complejidad, fecha: new Date(s.fecha) };
        } else {
          const f = new Date(s.fecha);
          if (f < casoNivel[clave].fecha) {
            casoNivel[clave] = { nivel: s.nivel_complejidad, fecha: f };
          }
        }
      });

    const counts = { Alto: 0, Medio: 0, Bajo: 0 };
    Object.values(casoNivel).forEach(({ nivel }) => {
      if (counts[nivel] !== undefined) counts[nivel]++;
    });

    const total = counts.Alto + counts.Medio + counts.Bajo;
    const pct = v => total > 0 ? Math.round((v / total) * 100) : 0;

    // Reusar el canvas de complejidad con nuevos datos
    // Orden: Alto → Medio → Bajo (de mayor a menor urgencia)
    destroyChart("chartComplejidad");
    const ctx = document.getElementById("chartComplejidad").getContext("2d");
    const COLORS_SVE = { Alto: "#f43f5e", Medio: "#f59e0b", Bajo: "#10b981" };
    charts.complejidad = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          `Alto (${counts.Alto} — ${pct(counts.Alto)}%)`,
          `Medio (${counts.Medio} — ${pct(counts.Medio)}%)`,
          `Bajo (${counts.Bajo} — ${pct(counts.Bajo)}%)`,
        ],
        datasets: [{
          data: [counts.Alto, counts.Medio, counts.Bajo],
          backgroundColor: [COLORS_SVE.Alto, COLORS_SVE.Medio, COLORS_SVE.Bajo],
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...chartOptionsDoughnut(),
        plugins: {
          ...chartOptionsDoughnut().plugins,
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const p = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${val} caso${val !== 1 ? "s" : ""} (${p}%)`;
              }
            }
          }
        }
      }
    });

    // Reemplazar la leyenda completa con colores y orden correctos (Alto/Medio/Bajo)
    const legendContainer = document.querySelector(".complexity-legend");
    if (legendContainer) {
      const nivelItems = [
        { name: "Alto",  desc: "Nivel de complejidad alto",  count: counts.Alto,  color: COLORS_SVE.Alto  },
        { name: "Medio", desc: "Nivel de complejidad medio", count: counts.Medio, color: COLORS_SVE.Medio },
        { name: "Bajo",  desc: "Nivel de complejidad bajo",  count: counts.Bajo,  color: COLORS_SVE.Bajo  },
      ];
      legendContainer.innerHTML = nivelItems.map(item => `
        <div class="legend-item" style="border-left: 3px solid ${item.color}; background: rgba(255,255,255,0.03);">
          <div class="legend-dot" style="background: ${item.color};"></div>
          <div>
            <p class="legend-name">${item.name}</p>
            <p class="legend-desc">${item.desc}</p>
            <p class="legend-count">${item.count}</p>
          </div>
        </div>`).join("");
    }
  }

  // ── SECCIÓN 4: CASOS CRÍTICOS ────────────────────────
  function renderCriticos(sesiones, casos) {
    // Evolución mensual de casos críticos
    const criticosPorMes = {};
    casos.forEach(ss => {
      if (clasificarCaso(ss) !== "critico") return;
      // Mes de la sesión más reciente del caso
      const fechas = ss.map(s => new Date(s.fecha));
      const ultima = new Date(Math.max(...fechas));
      const key = `${ultima.getFullYear()}-${String(ultima.getMonth() + 1).padStart(2,"0")}`;
      criticosPorMes[key] = (criticosPorMes[key] || 0) + 1;
    });

    const keys   = Object.keys(criticosPorMes).sort();
    const labels = keys.map(k => {
      const [y, m] = k.split("-");
      return `${MESES[parseInt(m) - 1]} ${y}`;
    });

    destroyChart("chartCriticosEvol");
    const ctx1 = document.getElementById("chartCriticosEvol").getContext("2d");
    charts.criticosEvol = new Chart(ctx1, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Casos críticos",
          data: keys.map(k => criticosPorMes[k]),
          backgroundColor: "rgba(244,63,94,0.7)",
          borderColor: "#f43f5e",
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: chartOptionsBar(),
    });

    // Distribución por sede (sin nombres de personas, solo sede)
    const criticosBySede = {};
    casos.forEach(ss => {
      if (clasificarCaso(ss) !== "critico") return;
      // Recuperar sede de rawClients usando cliente_id de la primera sesión
      const clienteId = ss[0]?.cliente_id;
      const cliente = rawClients.find(c => c.id === clienteId);
      const sede = cliente?.sede || "Sin sede";
      criticosBySede[sede] = (criticosBySede[sede] || 0) + 1;
    });

    destroyChart("chartCriticosSede");
    const ctx2 = document.getElementById("chartCriticosSede").getContext("2d");
    const sedeLabels = Object.keys(criticosBySede);
    charts.criticosSede = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: sedeLabels,
        datasets: [{
          label: "Críticos",
          data: sedeLabels.map(s => criticosBySede[s]),
          backgroundColor: sedeLabels.map((_, i) => PALETTE_ROSE[i % PALETTE_ROSE.length]),
          borderWidth: 0,
          borderRadius: 6,
        }]
      },
      options: { ...chartOptionsBar(), indexAxis: "y" },
    });
  }

  // ── SECCIÓN 5: CONFIDENCIALIDAD ──────────────────────
  function renderConfidencialidad(sesiones) {
    // Evolución mensual confi vs normal
    const byMonth = {};
    sesiones.forEach(s => {
      const f = new Date(s.fecha);
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2,"0")}`;
      if (!byMonth[key]) byMonth[key] = { confi: 0, normal: 0 };
      if (s.observaciones_confidenciales === true) byMonth[key].confi++;
      else byMonth[key].normal++;
    });

    const keys   = Object.keys(byMonth).sort();
    const labels = keys.map(k => {
      const [y, m] = k.split("-");
      return `${MESES[parseInt(m) - 1]} ${y}`;
    });

    destroyChart("chartConfiEvol");
    const ctx = document.getElementById("chartConfiEvol").getContext("2d");
    charts.confiEvol = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Normales",
            data: keys.map(k => byMonth[k].normal),
            backgroundColor: "rgba(99,102,241,0.65)",
            borderRadius: 4,
          },
          {
            label: "Confidenciales",
            data: keys.map(k => byMonth[k].confi),
            backgroundColor: "rgba(167,139,250,0.8)",
            borderRadius: 4,
          },
        ]
      },
      options: { ...chartOptionsBar(), scales: { x: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } }, y: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } } } },
    });

    // % confidenciales
    const totalConfi  = sesiones.filter(s => s.observaciones_confidenciales === true).length;
    const totalSes    = sesiones.length;
    const pct = totalSes > 0 ? Math.round((totalConfi / totalSes) * 100) : 0;
    setText("pctConfi", `${pct}%`);

    // Sede con más casos sensibles
    const confiBySede = {};
    sesiones.filter(s => s.observaciones_confidenciales === true).forEach(s => {
      const cliente = rawClients.find(c => c.id === s.cliente_id);
      const sede = cliente?.sede || "Sin sede";
      confiBySede[sede] = (confiBySede[sede] || 0) + 1;
    });
    const topSede = Object.entries(confiBySede).sort((a, b) => b[1] - a[1])[0];
    setText("sedeMasConfi", topSede ? topSede[0] : "—");
  }

  // ── SECCIÓN 6: COBERTURA ─────────────────────────────
  function renderCobertura(clientes, sesiones) {
    const unicos = new Set(sesiones.map(s => s.cliente_id)).size;
    const promedio = unicos > 0 ? (sesiones.length / unicos).toFixed(1) : "0";

    const virtuales    = sesiones.filter(s => s.modalidad === "Virtual").length;
    const presenciales = sesiones.filter(s => s.modalidad === "Presencial").length;
    const modFrecuente = virtuales >= presenciales ? "Virtual" : "Presencial";

    // Sesión más reciente
    const fechas = sesiones.map(s => new Date(s.fecha)).filter(f => !isNaN(f));
    const masReciente = fechas.length > 0
      ? new Date(Math.max(...fechas)).toLocaleDateString("es-CO", { day:"2-digit", month:"short", year:"numeric" })
      : "—";

    setText("covUnicos",    unicos);
    setText("covPromedio",  promedio);
    setText("covModalidad", modFrecuente);
    setText("covVirtual",   virtuales);
    setText("covPresencial",presenciales);
    setText("covReciente",  masReciente);
  }

  // ── SECCIÓN 7: SEDES ─────────────────────────────────
  // ─── Unifica sedes registradas solo como "Ciudad" con su forma completa
  // "Ciudad - Departamento" cuando ambas existen, sumando sus estadísticas.
  // Si solo existe la forma "Ciudad", se deja tal cual.
  function unificarSedes(mapa) {
    const formaCompleta = {};
    Object.keys(mapa).forEach(k => {
      const partes = k.split(/\s+[-–—]\s+/);
      if (partes.length === 2) {
        formaCompleta[partes[0].trim().toLowerCase()] = k;
      }
    });

    const resultado = {};
    Object.keys(mapa).forEach(k => {
      const ciudad = k.split(/\s+[-–—]\s+/)[0].trim().toLowerCase();
      const claveFinal = formaCompleta[ciudad] || k;
      const valor = mapa[k];

      if (typeof valor === "number") {
        resultado[claveFinal] = (resultado[claveFinal] || 0) + valor;
      } else {
        if (!resultado[claveFinal]) {
          resultado[claveFinal] = Object.fromEntries(Object.keys(valor).map(kk => [kk, 0]));
        }
        Object.keys(valor).forEach(kk => { resultado[claveFinal][kk] += valor[kk]; });
      }
    });
    return resultado;
  }

  function renderSedes(clientes, sesiones, casos, esSVE) {
    // Sesiones por sede
    const bySede = {};
    sesiones.forEach(s => {
      const cliente = rawClients.find(c => c.id === s.cliente_id);
      const sede = cliente?.sede || "Sin sede";
      bySede[sede] = (bySede[sede] || 0) + 1;
    });
    const bySedeUnificado = unificarSedes(bySede);

    const sedeLabels = Object.keys(bySedeUnificado).sort((a, b) => bySedeUnificado[b] - bySedeUnificado[a]);

    destroyChart("chartSedes");
    const ctx1 = document.getElementById("chartSedes").getContext("2d");
    charts.sedes = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: sedeLabels,
        datasets: [{
          label: "Sesiones",
          data: sedeLabels.map(s => bySedeUnificado[s]),
          backgroundColor: sedeLabels.map((_, i) => PALETTE_INDIGO[i % PALETTE_INDIGO.length]),
          borderWidth: 0,
          borderRadius: 6,
        }]
      },
      options: chartOptionsBar(),
    });

    // Complejidad por sede (stacked)
    const compBySede = {};
    if (esSVE) {
      // SVE: nivel de complejidad (Alto/Medio/Bajo) — el más antiguo por caso, igual que renderComplejidadSve
      const casosEnPeriodo = new Set(casos.keys());
      const casoNivelPorSede = {};
      rawConsultasSve
        .filter(s => casosEnPeriodo.has(`${s.cliente_id}_${s.consulta_number}`) && s.nivel_complejidad)
        .forEach(s => {
          const clave = `${s.cliente_id}_${s.consulta_number}`;
          const f = new Date(s.fecha);
          if (!casoNivelPorSede[clave] || f < casoNivelPorSede[clave].fecha) {
            const cliente = rawClients.find(c => c.id === s.cliente_id);
            casoNivelPorSede[clave] = { nivel: s.nivel_complejidad, sede: cliente?.sede || "Sin sede", fecha: f };
          }
        });
      Object.values(casoNivelPorSede).forEach(({ nivel, sede }) => {
        if (!compBySede[sede]) compBySede[sede] = { Alto: 0, Medio: 0, Bajo: 0 };
        if (compBySede[sede][nivel] !== undefined) compBySede[sede][nivel]++;
      });
    } else {
      casos.forEach(ss => {
        const clienteId = ss[0]?.cliente_id;
        const cliente = rawClients.find(c => c.id === clienteId);
        const sede = cliente?.sede || "Sin sede";
        if (!compBySede[sede]) compBySede[sede] = { normal: 0, complejo: 0, observacion: 0, critico: 0 };
        compBySede[sede][clasificarCaso(ss)]++;
      });
    }
    const compBySedeUnificado = unificarSedes(compBySede);

    const sedes2 = Object.keys(compBySedeUnificado);
    const datasetsComp = esSVE ? [
      { label: "Alto",  data: sedes2.map(s => compBySedeUnificado[s].Alto),  backgroundColor: "rgba(244,63,94,0.7)",  borderRadius: 4 },
      { label: "Medio", data: sedes2.map(s => compBySedeUnificado[s].Medio), backgroundColor: "rgba(245,158,11,0.7)", borderRadius: 4 },
      { label: "Bajo",  data: sedes2.map(s => compBySedeUnificado[s].Bajo),  backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 },
    ] : [
      { label: "Normal",         data: sedes2.map(s => compBySedeUnificado[s].normal),     backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 },
      { label: "Complejo",       data: sedes2.map(s => compBySedeUnificado[s].complejo),   backgroundColor: "rgba(245,158,11,0.7)", borderRadius: 4 },
      { label: "En observación", data: sedes2.map(s => compBySedeUnificado[s].observacion),backgroundColor: "rgba(167,139,250,0.7)", borderRadius: 4 },
      { label: "Crítico",        data: sedes2.map(s => compBySedeUnificado[s].critico),    backgroundColor: "rgba(244,63,94,0.7)",  borderRadius: 4 },
    ];

    destroyChart("chartSedesComplejidad");
    const ctx2 = document.getElementById("chartSedesComplejidad").getContext("2d");
    charts.sedesComp = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: sedes2,
        datasets: datasetsComp
      },
      options: {
        ...chartOptionsBar(),
        scales: {
          x: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // ENTREGA INDIVIDUAL DE RESULTADOS — render específico
  // (los registros no tienen consulta_number/estado/confidencialidad,
  // así que no pasan por agruparEnCasos/clasificarCaso)
  // ══════════════════════════════════════════════════════

  // Reetiqueta textos/íconos compartidos con OP/SVE según la modalidad activa.
  function aplicarEtiquetasModalidad(esEntrega) {
    setText("kpiLabelSesiones", esEntrega ? "Entregas totales"        : "Total de sesiones");
    setText("kpiLabelAbiertos", esEntrega ? "Con seguimiento"          : "Casos abiertos");
    setText("kpiLabelCerrados", esEntrega ? "Con retroalimentación"    : "Casos cerrados");
    const iconSes = document.getElementById("kpiIconSesiones");
    if (iconSes) iconSes.textContent = esEntrega ? "📨" : "📋";
    const iconAb = document.getElementById("kpiIconAbiertos");
    if (iconAb) iconAb.textContent = esEntrega ? "🩺" : "🔓";
    const iconCe = document.getElementById("kpiIconCerrados");
    if (iconCe) iconCe.textContent = esEntrega ? "💬" : "✅";

    setText("tituloEstados", esEntrega ? "Con retroalimentación vs Pendiente" : "Abiertos vs Cerrados");

    setText("tituloComplejidadSeccion", esEntrega ? "Tipos de Recomendaciones" : "Indicador de Complejidad");
    setText("descComplejidadSeccion",
      esEntrega ? "Clasificación de las recomendaciones registradas" : "Clasificación según sesiones y confidencialidad");
    setText("tituloComplejidadChart", esEntrega ? "Distribución de recomendaciones" : "Distribución de casos");

    setText("covLabelUnicos",    esEntrega ? "Trabajadores únicos con entrega"    : "Trabajadores únicos");
    setText("covLabelPromedio",  esEntrega ? "Promedio entregas / trabajador"     : "Promedio sesiones / trabajador");
    setText("covLabelModalidad", esEntrega ? "Profesionales activos"              : "Modalidad más frecuente");
    setText("covLabelVirtual",   esEntrega ? "Con seguimiento registrado"         : "Sesiones virtuales");
    setText("covLabelPresencial",esEntrega ? "Con retroalimentación"              : "Sesiones presenciales");
    setText("covLabelReciente",  esEntrega ? "Entrega más reciente"               : "Sesión más reciente");

    setText("tituloSedesTotal",       esEntrega ? "Entregas totales por sede" : "Sesiones totales por sede");
    setText("tituloSedesComplejidad", esEntrega ? "Seguimiento por sede"      : "Complejidad por sede");

    // Título del panel de tendencia (tabla top 5)
    const tituloPanel = document.querySelector(".chart-title");
    if (tituloPanel && esEntrega) {
      tituloPanel.innerHTML = 'Pruebas a profundidad más frecuentes <span class="badge-top5">Top 5</span>';
    }
  }

  // "No asistio" es el único valor que no implica seguimiento activo sobre
  // el trabajador — igual que en dashboard-entrega.js.
  function tieneSeguimientoEntrega(e) {
    return !!e.pruebas_profundidad && e.pruebas_profundidad !== "No asistio";
  }

  const RECOM_KEYWORDS = {
    "Manejo estrés":    ["estrés","estres","ansiedad","tensión","tension","relajación","relajacion"],
    "Hábitos de salud": ["hábito","habito","salud","nutrición","nutricion","sueño","sueno","ejercicio"],
    "Autocuidado":      ["autocuidado","bienestar","higiene","emocional","cuidado personal"],
    "Comunicación":     ["comunicación","comunicacion","relacion","social","interpersonal","asertividad"],
  };
  function clasificarRecomendacion(entrega) {
    const txt = ((entrega.recomendaciones_html || "") + " " + (entrega.titulo_seccion || "")).toLowerCase();
    for (const [cat, palabras] of Object.entries(RECOM_KEYWORDS)) {
      if (palabras.some(p => txt.includes(p))) return cat;
    }
    return "Otros";
  }

  // ── SECCIÓN 1: KPIs (Entrega) ───────────────────────
  function renderKPIsEntrega(clientes, entregas) {
    const trabConEntrega = new Set(entregas.map(e => e.cliente_id));
    const profActivos    = new Set(entregas.map(e => e.profesional_id)).size;
    const conSeguimiento = new Set(entregas.filter(tieneSeguimientoEntrega).map(e => e.cliente_id)).size;
    const conRetro       = entregas.filter(e => e.fecha_retroalimentacion).length;

    setText("kpiTrabajadores",  trabConEntrega.size);
    setText("kpiSesiones",      entregas.length);
    setText("kpiAbiertos",      conSeguimiento);
    setText("kpiCerrados",      conRetro);
    setText("kpiProfesionales", profActivos);
  }

  // ── SECCIÓN 2: Tendencia — Pruebas a profundidad más frecuentes ─────
  function renderPruebasProfundidad(entregas) {
    const container = document.getElementById("tablaMotivos");
    if (!container) return;

    const conteo = {};
    entregas.forEach(e => {
      const val = (e.pruebas_profundidad || "").trim();
      if (!val) return;
      conteo[val] = (conteo[val] || 0) + 1;
    });

    const items = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (items.length === 0) {
      container.innerHTML = '<div class="motivos-empty">Sin registros de pruebas a profundidad en el periodo</div>';
      return;
    }

    const TOP = 5;
    const maxVal         = items[0][1];
    const totalMenciones = items.reduce((s, [, v]) => s + v, 0);
    const hayMas         = items.length > TOP;

    const filaHTML = ([prueba, count], idx) => {
      const pct    = totalMenciones > 0 ? Math.round((count / totalMenciones) * 100) : 0;
      const barPct = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
      const rankCls  = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "";
      const extraCls = idx >= TOP ? "motivo-extra" : "";
      return `
        <tr class="${extraCls}">
          <td class="td-rank"><span class="rank-badge ${rankCls}">${idx + 1}</span></td>
          <td class="td-motivo">
            <div class="motivo-nombre">${prueba}</div>
            <div class="motivo-bar-track">
              <div class="motivo-bar-fill" style="width:${barPct}%"></div>
            </div>
          </td>
          <td class="td-count">
            <span class="count-num">${count}</span>
            <span class="count-pct">(${pct}%)</span>
          </td>
        </tr>`;
    };

    let html = `
      <table class="tabla-motivos">
        <thead><tr>
          <th class="td-rank">#</th>
          <th>Prueba a profundidad</th>
          <th class="td-count">Registros</th>
        </tr></thead>
        <tbody>${items.map(filaHTML).join("")}</tbody>
      </table>`;

    if (hayMas) {
      const restantes = items.length - TOP;
      html += `
        <button class="btn-ver-mas-motivos" id="btnVerMasMotivos">
          Ver ${restantes} prueba${restantes > 1 ? "s" : ""} más
          <span class="btn-arrow">▼</span>
        </button>`;
    }

    container.innerHTML = html;

    if (hayMas) {
      const btn = document.getElementById("btnVerMasMotivos");
      btn.addEventListener("click", () => {
        const expanded = btn.classList.toggle("expanded");
        document.querySelectorAll(".motivo-extra").forEach(tr =>
          tr.classList.toggle("visible", expanded)
        );
        const restantes = items.length - TOP;
        btn.childNodes[0].textContent = expanded
          ? "Ver menos "
          : `Ver ${restantes} prueba${restantes > 1 ? "s" : ""} más `;
      });
    }
  }

  // ── SECCIÓN 2b: Con retroalimentación vs Pendiente ──────────────────
  function renderEstadosEntrega(entregas) {
    const conRetro   = entregas.filter(e => e.fecha_retroalimentacion).length;
    const pendientes = entregas.length - conRetro;
    const total = entregas.length;
    const pct = v => total > 0 ? Math.round((v / total) * 100) : 0;

    destroyChart("chartEstados");
    const ctx = document.getElementById("chartEstados").getContext("2d");
    charts.estados = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [
          `Con retroalimentación (${conRetro} — ${pct(conRetro)}%)`,
          `Pendientes (${pendientes} — ${pct(pendientes)}%)`
        ],
        datasets: [{
          data: [conRetro, pendientes],
          backgroundColor: ["#10b981", "#f59e0b"],
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...chartOptionsDoughnut(),
        plugins: {
          ...chartOptionsDoughnut().plugins,
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                return ` ${val} entrega${val !== 1 ? "s" : ""} (${pct(val)}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ── SECCIÓN 4 (repurpuesta): Tipos de Recomendaciones ───────────────
  function renderRecomendacionesEntrega(entregas) {
    const COLORS = {
      "Manejo estrés":    "#6366f1",
      "Hábitos de salud": "#10b981",
      "Autocuidado":      "#f59e0b",
      "Comunicación":     "#38bdf8",
      "Otros":            "#a78bfa",
    };
    const counts = { "Manejo estrés": 0, "Hábitos de salud": 0, "Autocuidado": 0, "Comunicación": 0, "Otros": 0 };
    entregas.forEach(e => { counts[clasificarRecomendacion(e)]++; });

    const labelsAll = Object.keys(counts);
    const total = labelsAll.reduce((s, k) => s + counts[k], 0);
    const pct = v => total > 0 ? Math.round((v / total) * 100) : 0;

    // Reemplazar la leyenda (misma técnica que renderComplejidadSve)
    const legendContainer = document.querySelector(".complexity-legend");
    if (legendContainer) {
      legendContainer.innerHTML = labelsAll.map(name => `
        <div class="legend-item" style="border-left: 3px solid ${COLORS[name]}; background: rgba(255,255,255,0.03);">
          <div class="legend-dot" style="background: ${COLORS[name]};"></div>
          <div>
            <p class="legend-name">${name}</p>
            <p class="legend-desc">${pct(counts[name])}% del total</p>
            <p class="legend-count">${counts[name]}</p>
          </div>
        </div>`).join("");
    }

    destroyChart("chartComplejidad");
    const ctx = document.getElementById("chartComplejidad").getContext("2d");
    charts.complejidad = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labelsAll.map(name => `${name} (${counts[name]} — ${pct(counts[name])}%)`),
        datasets: [{
          data: labelsAll.map(name => counts[name]),
          backgroundColor: labelsAll.map(name => COLORS[name]),
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...chartOptionsDoughnut(),
        plugins: {
          ...chartOptionsDoughnut().plugins,
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                return ` ${val} entrega${val !== 1 ? "s" : ""} (${pct(val)}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ── SECCIÓN 6: Cobertura (Entrega) ──────────────────────────────────
  function renderCoberturaEntrega(clientes, entregas) {
    const unicos = new Set(entregas.map(e => e.cliente_id)).size;
    const promedio = unicos > 0 ? (entregas.length / unicos).toFixed(1) : "0";
    const profActivos    = new Set(entregas.map(e => e.profesional_id)).size;
    const conSeguimiento = new Set(entregas.filter(tieneSeguimientoEntrega).map(e => e.cliente_id)).size;
    const conRetro        = entregas.filter(e => e.fecha_retroalimentacion).length;

    const fechas = entregas.map(e => new Date(e.fecha)).filter(f => !isNaN(f));
    const masReciente = fechas.length > 0
      ? new Date(Math.max(...fechas)).toLocaleDateString("es-CO", { day:"2-digit", month:"short", year:"numeric" })
      : "—";

    setText("covUnicos",     unicos);
    setText("covPromedio",   promedio);
    setText("covModalidad",  profActivos);
    setText("covVirtual",    conSeguimiento);
    setText("covPresencial", conRetro);
    setText("covReciente",   masReciente);
  }

  // ── SECCIÓN 7: Análisis por Sede (Entrega) ──────────────────────────
  function renderSedesEntrega(clientes, entregas) {
    const bySede = {};
    entregas.forEach(e => {
      const cliente = rawClients.find(c => c.id === e.cliente_id);
      const sede = cliente?.sede || "Sin sede";
      if (!bySede[sede]) bySede[sede] = { total: 0, conSeguimiento: 0, sinSeguimiento: 0 };
      bySede[sede].total++;
      if (tieneSeguimientoEntrega(e)) bySede[sede].conSeguimiento++;
      else bySede[sede].sinSeguimiento++;
    });
    const bySedeUnificado = unificarSedes(bySede);

    const sedeLabels = Object.keys(bySedeUnificado)
      .sort((a, b) => bySedeUnificado[b].total - bySedeUnificado[a].total);

    destroyChart("chartSedes");
    const ctx1 = document.getElementById("chartSedes").getContext("2d");
    charts.sedes = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: sedeLabels,
        datasets: [{
          label: "Entregas",
          data: sedeLabels.map(s => bySedeUnificado[s].total),
          backgroundColor: sedeLabels.map((_, i) => PALETTE_INDIGO[i % PALETTE_INDIGO.length]),
          borderWidth: 0,
          borderRadius: 6,
        }]
      },
      options: chartOptionsBar(),
    });

    destroyChart("chartSedesComplejidad");
    const ctx2 = document.getElementById("chartSedesComplejidad").getContext("2d");
    charts.sedesComp = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: sedeLabels,
        datasets: [
          { label: "Con seguimiento", data: sedeLabels.map(s => bySedeUnificado[s].conSeguimiento), backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 },
          { label: "Sin seguimiento", data: sedeLabels.map(s => bySedeUnificado[s].sinSeguimiento), backgroundColor: "rgba(245,158,11,0.7)", borderRadius: 4 },
        ]
      },
      options: {
        ...chartOptionsBar(),
        scales: {
          x: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      },
    });
  }

  // ─── CHART OPTIONS ──────────────────────────────────
  function chartOptionsLine() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(),
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { maxRotation: 45 } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
      },
    };
  }

  function chartOptionsBar() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle(),
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { maxRotation: 40 } },
        y: { grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
      },
    };
  }

  function chartOptionsDoughnut() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8b94a8", font: { size: 12 }, padding: 12, boxWidth: 12 }
        },
        tooltip: tooltipStyle(),
      },
    };
  }

  function tooltipStyle() {
    return {
      backgroundColor: "#1e2233",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      titleColor: "#e8ecf4",
      bodyColor: "#8b94a8",
      padding: 10,
      cornerRadius: 8,
    };
  }

  // ─── PALETAS ────────────────────────────────────────
  const PALETTE_INDIGO = [
    "rgba(99,102,241,0.8)","rgba(129,140,248,0.8)","rgba(67,56,202,0.8)",
    "rgba(165,180,252,0.8)","rgba(55,48,163,0.8)","rgba(199,210,254,0.7)",
  ];
  const PALETTE_ROSE = [
    "rgba(244,63,94,0.8)","rgba(251,113,133,0.8)","rgba(225,29,72,0.8)",
    "rgba(253,164,175,0.8)","rgba(190,18,60,0.8)",
  ];

  // ─── UTILIDADES ─────────────────────────────────────
  // ─── SNAPSHOT PARA INFORME — Entrega Individual de Resultados ──────
  function buildSnapshotEntrega(clientes, entregas) {
    const empresaId = document.getElementById("filterEmpresa").value;
    const sedeVal    = document.getElementById("filterSede").value;
    const anio       = parseInt(document.getElementById("filterAnio").value) || null;
    const mes        = parseInt(document.getElementById("filterMes").value) || null;

    let empresaNombre = "Todas las empresas";
    if (empresaId) {
      const emp = empresas.find(e => String(e.id) === empresaId);
      if (emp) empresaNombre = emp.cliente_definitivo || emp.cliente_final || empresaNombre;
    }

    const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

    const trabConEntrega = new Set(entregas.map(e => e.cliente_id));
    const profActivos    = new Set(entregas.map(e => e.profesional_id)).size;
    const conSeguimiento = new Set(entregas.filter(tieneSeguimientoEntrega).map(e => e.cliente_id)).size;
    const conRetro       = entregas.filter(e => e.fecha_retroalimentacion).length;
    const pendientes     = entregas.length - conRetro;

    // Pruebas a profundidad — ranking
    const conteoPruebas = {};
    entregas.forEach(e => {
      const val = (e.pruebas_profundidad || "").trim();
      if (!val) return;
      conteoPruebas[val] = (conteoPruebas[val] || 0) + 1;
    });
    const pruebasOrdenadas = Object.entries(conteoPruebas)
      .sort((a, b) => b[1] - a[1])
      .map(([prueba, count]) => ({ prueba, count }));

    // Tipos de recomendaciones
    const recomCounts = { "Manejo estrés": 0, "Hábitos de salud": 0, "Autocuidado": 0, "Comunicación": 0, "Otros": 0 };
    entregas.forEach(e => { recomCounts[clasificarRecomendacion(e)]++; });

    // Cobertura
    const unicos = trabConEntrega.size;
    const promedio = unicos > 0 ? (entregas.length / unicos).toFixed(1) : "0";
    const fechas = entregas.map(e => new Date(e.fecha)).filter(f => !isNaN(f));
    const masReciente = fechas.length > 0
      ? new Date(Math.max(...fechas)).toLocaleDateString("es-CO", { day:"2-digit", month:"long", year:"numeric" })
      : "—";

    // Sedes
    const bySede = {};
    entregas.forEach(e => {
      const cliente = rawClients.find(c => c.id === e.cliente_id);
      const sede = cliente?.sede || "Sin sede";
      if (!bySede[sede]) bySede[sede] = { total: 0, conSeguimiento: 0, sinSeguimiento: 0 };
      bySede[sede].total++;
      if (tieneSeguimientoEntrega(e)) bySede[sede].conSeguimiento++;
      else bySede[sede].sinSeguimiento++;
    });
    const bySedeUnificado = unificarSedes(bySede);

    return {
      fechaGeneracion: new Date().toLocaleDateString("es-CO", {day:"2-digit",month:"long",year:"numeric"}),
      filtros: {
        empresa: empresaNombre,
        sede: sedeVal || "Todas",
        modalidad: "Entrega Individual de Resultados",
        anio: anio ? String(anio) : "Todos",
        mes: mes ? MESES_FULL[mes-1] : "Todo el año",
      },
      esGeneral: !empresaId,
      esSVE: false,
      esEntrega: true,
      kpis: {
        trabajadores:  trabConEntrega.size,
        entregas:      entregas.length,
        conSeguimiento,
        conRetro,
        profActivos,
      },
      estados: { conRetro, pendientes },
      pruebasProfundidad: pruebasOrdenadas,
      recomendaciones: recomCounts,
      cobertura: { unicos, promedio, profActivos, conSeguimiento, conRetro, masReciente },
      sedes: bySedeUnificado,
    };
  }

  // ─── SNAPSHOT PARA INFORME ─────────────────────────
  function buildSnapshot(clientes, sesiones) {
    if (document.getElementById("filterModalidad").value === "entrega") {
      return buildSnapshotEntrega(clientes, sesiones);
    }

    const casos = agruparEnCasos(sesiones);

    // Filtros activos
    const empresaId  = document.getElementById("filterEmpresa").value;
    const sedeVal    = document.getElementById("filterSede").value;
    const modalidad  = document.getElementById("filterModalidad").value;
    const anio       = parseInt(document.getElementById("filterAnio").value) || null;
    const mes        = parseInt(document.getElementById("filterMes").value) || null;

    // Nombre empresa
    let empresaNombre = "Todas las empresas";
    if (empresaId) {
      const emp = empresas.find(e => String(e.id) === empresaId);
      if (emp) empresaNombre = emp.cliente_definitivo || emp.cliente_final || empresaNombre;
    }

    // ── KPIs — misma lógica que renderKPIs ──────────────

    // 1. Trabajadores atendidos: únicos con sesión en el periodo
    const trabConSesion = new Set(sesiones.map(s => s.cliente_id));

    // 2. Total consultas = trabajadores únicos con sesión en el periodo
    const totalConsultas = trabConSesion.size;

    // 3 & 4. Casos abiertos y cerrados — misma lógica que renderEstados y renderKPIs
    let casosAbiertosSnap = 0;
    let casosCerradosSnap = 0;
    agruparEnCasos(sesiones).forEach(ss => {
      if (ss.some(s => s.estado === "Abierto")) casosAbiertosSnap++;
      else casosCerradosSnap++;
    });

    // 6. Confidenciales y críticos (sobre sesiones del periodo)
    const casosConfi = new Set();
    sesiones.filter(s => s.observaciones_confidenciales === true).forEach(s =>
      casosConfi.add(`${s.cliente_id}_${s.consulta_number}`)
    );
    let criticos = 0;
    casos.forEach(ss => { if (clasificarCaso(ss) === "critico") criticos++; });

    // Estados para gráfica dona (sobre sesiones del periodo)
    let casosAbCount = 0, casosCeCount = 0;
    casos.forEach(ss => {
      if (ss.some(s => s.estado === "Abierto")) casosAbCount++;
      else casosCeCount++;
    });

    // Complejidad
    const comp = { normal: 0, complejo: 0, observacion: 0, critico: 0 };
    casos.forEach(ss => comp[clasificarCaso(ss)]++);

    // Cobertura
    const unicos = new Set(sesiones.map(s => s.cliente_id)).size;
    const promedio = unicos > 0 ? (sesiones.length / unicos).toFixed(1) : "0";
    const virtuales    = sesiones.filter(s => s.modalidad === "Virtual").length;
    const presenciales = sesiones.filter(s => s.modalidad === "Presencial").length;
    const fechas = sesiones.map(s => new Date(s.fecha)).filter(f => !isNaN(f));
    const masReciente = fechas.length > 0
      ? new Date(Math.max(...fechas)).toLocaleDateString("es-CO", {day:"2-digit",month:"long",year:"numeric"})
      : "—";

    // Sedes
    const esSveSnapSedes = document.getElementById("filterModalidad").value === "vigilancia";
    const bySede = {};
    sesiones.forEach(s => {
      const cl = rawClients.find(c => c.id === s.cliente_id);
      const sede = cl?.sede || "Sin sede";
      if (!bySede[sede]) {
        bySede[sede] = esSveSnapSedes
          ? { consultas: 0, sesiones: 0, Alto: 0, Medio: 0, Bajo: 0 }
          : { consultas: 0, sesiones: 0, normal: 0, complejo: 0, observacion: 0, critico: 0 };
      }
      bySede[sede].sesiones++;
    });
    // Consultas (casos únicos) por sede — común a ambas modalidades
    casos.forEach(ss => {
      const cl = rawClients.find(c => c.id === ss[0]?.cliente_id);
      const sede = cl?.sede || "Sin sede";
      if (bySede[sede]) bySede[sede].consultas++;
    });
    if (esSveSnapSedes) {
      // SVE: nivel de complejidad (Alto/Medio/Bajo) — el más antiguo por caso
      const casosEnPeriodoSede = new Set(casos.keys());
      const casoNivelPorSede = {};
      rawConsultasSve
        .filter(s => casosEnPeriodoSede.has(`${s.cliente_id}_${s.consulta_number}`) && s.nivel_complejidad)
        .forEach(s => {
          const clave = `${s.cliente_id}_${s.consulta_number}`;
          const f = new Date(s.fecha);
          if (!casoNivelPorSede[clave] || f < casoNivelPorSede[clave].fecha) {
            const cl = rawClients.find(c => c.id === s.cliente_id);
            casoNivelPorSede[clave] = { nivel: s.nivel_complejidad, sede: cl?.sede || "Sin sede", fecha: f };
          }
        });
      Object.values(casoNivelPorSede).forEach(({ nivel, sede }) => {
        if (bySede[sede] && bySede[sede][nivel] !== undefined) bySede[sede][nivel]++;
      });
    } else {
      casos.forEach(ss => {
        const cl = rawClients.find(c => c.id === ss[0]?.cliente_id);
        const sede = cl?.sede || "Sin sede";
        if (bySede[sede]) bySede[sede][clasificarCaso(ss)]++;
      });
    }
    const bySedeUnificado = unificarSedes(bySede);

    const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

    // Vínculo: solo OP — contar trabajadores únicos con sesión en el periodo por tipo
    const clientesConSesionSnap = new Set(sesiones.map(s => s.cliente_id));
    const atendidosSnap = clientes.filter(c => clientesConSesionSnap.has(c.id));
    const vinculos = { trabajadores: 0, familiares: 0 };
    atendidosSnap.forEach(c => {
      if (c.vinculo === "Trabajador") vinculos.trabajadores++;
      else if (c.vinculo === "Familiar Trabajador") vinculos.familiares++;
    });

    // Motivos de consulta: contar igual que renderMotivos
    // Misma lógica que renderMotivos:
    // 1 sesión por consulta (cliente_id + consulta_number), separador "|"
    const conteoMotivos = {};
    const consultasVistasSnap = new Set();
    sesiones.forEach(s => {
      if (!s.motivo_consulta) return;
      const clave = `${s.cliente_id}_${s.consulta_number}`;
      if (consultasVistasSnap.has(clave)) return;
      consultasVistasSnap.add(clave);
      s.motivo_consulta.split("|").map(m => m.trim().toUpperCase()).filter(m => m).forEach(m => {
        conteoMotivos[m] = (conteoMotivos[m] || 0) + 1;
      });
    });
    const motivosOrdenados = Object.entries(conteoMotivos)
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, count]) => ({ motivo, count }));

    // Complejidad SVE: buscar nivel_complejidad en histórico completo
    // para casos que tienen sesiones en el periodo filtrado
    const casosEnPeriodoSnap = new Set(
      sesiones.map(s => `${s.cliente_id}_${s.consulta_number}`)
    );
    const compSveMap = {};
    rawConsultasSve
      .filter(s => {
        const clave = `${s.cliente_id}_${s.consulta_number}`;
        return casosEnPeriodoSnap.has(clave) && s.nivel_complejidad;
      })
      .forEach(s => {
        const clave = `${s.cliente_id}_${s.consulta_number}`;
        if (!compSveMap[clave]) {
          compSveMap[clave] = { nivel: s.nivel_complejidad, fecha: new Date(s.fecha) };
        } else {
          const f = new Date(s.fecha);
          if (f < compSveMap[clave].fecha) compSveMap[clave] = { nivel: s.nivel_complejidad, fecha: f };
        }
      });
    const compSve = { Alto: 0, Medio: 0, Bajo: 0 };
    Object.values(compSveMap).forEach(({ nivel }) => { if (compSve[nivel] !== undefined) compSve[nivel]++; });

    // Criterios de inclusión SVE (misma lógica que renderCriteriosSve):
    // solo trabajadores atendidos en el periodo, un criterio por trabajador.
    const criterioPorTrabajadorSnap = new Map();
    rawMesaTrabajoSve
      .filter(m => trabConSesion.has(m.cliente_id) && m.criterio_inclusion)
      .sort((a, b) => (a.id || 0) - (b.id || 0))
      .forEach(m => criterioPorTrabajadorSnap.set(m.cliente_id, m.criterio_inclusion.trim()));

    const conteoCriterios = {};
    criterioPorTrabajadorSnap.forEach(criterio => {
      conteoCriterios[criterio] = (conteoCriterios[criterio] || 0) + 1;
    });
    const criteriosOrdenados = Object.entries(conteoCriterios)
      .sort((a, b) => b[1] - a[1])
      .map(([criterio, count]) => ({ criterio, count }));

    // Modalidad del filtro para saber qué mostrar en el reporte
    const modalidadFiltroSnap = document.getElementById("filterModalidad").value;

    return {
      fechaGeneracion: new Date().toLocaleDateString("es-CO", {day:"2-digit",month:"long",year:"numeric"}),
      filtros: {
        empresa: empresaNombre,
        sede: sedeVal || "Todas",
        modalidad: modalidad === "orientacion" ? "Orientación Psicosocial"
               : modalidad === "vigilancia"  ? "Sistema de Vigilancia Epidemiológica"
               : "Todas",
        anio: anio ? String(anio) : "Todos",
        mes: mes ? MESES_FULL[mes-1] : "Todo el año",
      },
      esGeneral: !empresaId,
      kpis: {
        trabajadores: trabConSesion.size,
        consultas: totalConsultas,
        sesiones: sesiones.length,
        abiertos: casosAbiertosSnap,
        cerrados: casosCerradosSnap,
        confidenciales: casosConfi.size,
        criticos,
      },
      vinculos,
      motivos: motivosOrdenados,
      criterios: criteriosOrdenados,
      complejidadSve: compSve,
      esSVE: modalidadFiltroSnap === "vigilancia",
      estados: { abiertos: casosAbCount, cerrados: casosCeCount },
      complejidad: comp,
      cobertura: { unicos, promedio, virtuales, presenciales, masReciente,
        modFrecuente: virtuales >= presenciales ? "Virtual" : "Presencial" },
      sedes: bySedeUnificado,
    };
  }

  function abrirInforme() {
    if (!lastSnapshot) return;
    sessionStorage.setItem("informeSnapshot", JSON.stringify(lastSnapshot));
    window.open("reporte-empresa.html", "_blank");
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function destroyChart(id) {
    const key = Object.keys(charts).find(k => {
      return charts[k]?.canvas?.id === id;
    });
    if (key) { charts[key].destroy(); delete charts[key]; }
    // también por id de canvas directo
    Object.entries(charts).forEach(([k, c]) => {
      if (c?.canvas?.id === id) { c.destroy(); delete charts[k]; }
    });
  }

  function setLoading(show) {
    const el = document.getElementById("loadingOverlay");
    if (el) el.classList.toggle("hidden", !show);
  }

  function actualizarTimestamp() {
    const el = document.getElementById("lastUpdate");
    if (el) {
      const now = new Date();
      el.textContent = `Actualizado ${now.toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" })}`;
    }
  }

})();