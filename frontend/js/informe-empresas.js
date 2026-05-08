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
  let rawClients  = [];   // todos los clientes de la empresa/filtro
  let rawConsultas = [];  // todas las sesiones de esos clientes
  let empresas    = [];   // catálogo de empresas
  let charts      = {};   // instancias Chart.js activas
  let lastSnapshot = null; // último snapshot de datos para el informe imprimible

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
    const [resClients, resConsultas] = await Promise.all([
      fetch(`${API}/api/clients`,   { headers: authHeaders() }),
      fetch(`${API}/api/consultas`, { headers: authHeaders() }),
    ]);

    rawClients   = resClients.ok   ? await resClients.json()   : [];
    rawConsultas = resConsultas.ok ? await resConsultas.json() : [];
  }

  // ─── FILTRAR DATOS LOCALMENTE ────────────────────────
  function filtrarDatos() {
    // "Empresa" en el filtro = "Cliente Final" del formulario → guardado en clients.subcontratista_id
    const subcontratistaId = document.getElementById("filterEmpresa").value;
    const sedeVal          = document.getElementById("filterSede").value;
    const modalidad        = document.getElementById("filterModalidad").value;
    const anio             = parseInt(document.getElementById("filterAnio").value) || null;
    const mes              = parseInt(document.getElementById("filterMes").value) || null;

    // Filtrar clientes
    let clientes = rawClients.filter(c => {
      // "Cliente Final" → clients.subcontratista_id
      if (subcontratistaId && String(c.subcontratista_id) !== subcontratistaId) return false;
      // Sede: solo sedes que los trabajadores realmente tienen registradas
      if (sedeVal && c.sede !== sedeVal) return false;
      if (modalidad && c.modalidad !== modalidad) return false;
      return true;
    });

    const clienteIds = new Set(clientes.map(c => c.id));

    // Filtrar sesiones (consultas) por cliente y fecha
    let sesiones = rawConsultas.filter(s => {
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
    const casos = agruparEnCasos(sesiones);

    // ── KPIs
    renderKPIs(clientes, sesiones, casos);

    // ── Tendencia
    renderMotivos(sesiones);  // Tabla de motivos de consulta más frecuentes
    renderEstados(casos); // Pasa casos (consultas únicas), no sesiones

    // ── Complejidad
    renderComplejidad(casos);

    // ── Casos críticos — DESACTIVADO TEMPORALMENTE
    // renderCriticos(sesiones, casos);

    // ── Confidencialidad — DESACTIVADO TEMPORALMENTE
    // renderConfidencialidad(sesiones);

    // ── Cobertura
    renderCobertura(clientes, sesiones);

    // ── Sedes
    renderSedes(clientes, sesiones, casos);
  }

  // ── SECCIÓN 1: KPIs ─────────────────────────────────
  function renderKPIs(clientes, sesiones, casos) {
    // Trabajadores únicos con al menos una sesión
    const trabConSesion = new Set(sesiones.map(s => s.cliente_id));

    // Total sesiones
    const totalSesiones = sesiones.length;

    // Total consultas únicas (cliente_id + consulta_number)
    const totalConsultas = casos.size;

    // Casos abiertos: (cliente_id, consulta_number) con al menos 1 sesión abierta
    const casosAbiertos = new Set();
    sesiones.filter(s => s.estado === "Abierto").forEach(s =>
      casosAbiertos.add(`${s.cliente_id}_${s.consulta_number}`)
    );

    // Casos confidenciales: alguna sesión con observaciones_confidenciales=true
    const casosConfi = new Set();
    sesiones.filter(s => s.observaciones_confidenciales === true).forEach(s =>
      casosConfi.add(`${s.cliente_id}_${s.consulta_number}`)
    );

    // Casos críticos
    let criticos = 0;
    casos.forEach(ss => { if (clasificarCaso(ss) === "critico") criticos++; });

    // Reingresos: trabajadores con consulta_number >= 2
    const reingresos = new Set();
    sesiones.filter(s => s.consulta_number >= 2).forEach(s => reingresos.add(s.cliente_id));

    setText("kpiTrabajadores",  trabConSesion.size); // Solo trabajadores con al menos 1 sesión registrada
    setText("kpiConsultas",     totalConsultas);
    setText("kpiSesiones",      totalSesiones);
    setText("kpiAbiertos",      casosAbiertos.size);
    setText("kpiConfidenciales",casosConfi.size);
    setText("kpiCriticos",      criticos);
    setText("kpiReingresos",    reingresos.size);
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

  // ── SECCIÓN 3: COMPLEJIDAD ───────────────────────────
  function renderComplejidad(casos) {
    const counts = { normal: 0, complejo: 0, observacion: 0, critico: 0 };
    casos.forEach(ss => counts[clasificarCaso(ss)]++);

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
  function renderSedes(clientes, sesiones, casos) {
    // Sesiones por sede
    const bySede = {};
    sesiones.forEach(s => {
      const cliente = rawClients.find(c => c.id === s.cliente_id);
      const sede = cliente?.sede || "Sin sede";
      bySede[sede] = (bySede[sede] || 0) + 1;
    });

    const sedeLabels = Object.keys(bySede).sort((a, b) => bySede[b] - bySede[a]);

    destroyChart("chartSedes");
    const ctx1 = document.getElementById("chartSedes").getContext("2d");
    charts.sedes = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: sedeLabels,
        datasets: [{
          label: "Sesiones",
          data: sedeLabels.map(s => bySede[s]),
          backgroundColor: sedeLabels.map((_, i) => PALETTE_INDIGO[i % PALETTE_INDIGO.length]),
          borderWidth: 0,
          borderRadius: 6,
        }]
      },
      options: chartOptionsBar(),
    });

    // Complejidad por sede (stacked)
    const compBySede = {};
    casos.forEach(ss => {
      const clienteId = ss[0]?.cliente_id;
      const cliente = rawClients.find(c => c.id === clienteId);
      const sede = cliente?.sede || "Sin sede";
      if (!compBySede[sede]) compBySede[sede] = { normal: 0, complejo: 0, observacion: 0, critico: 0 };
      compBySede[sede][clasificarCaso(ss)]++;
    });

    const sedes2 = Object.keys(compBySede);
    destroyChart("chartSedesComplejidad");
    const ctx2 = document.getElementById("chartSedesComplejidad").getContext("2d");
    charts.sedesComp = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: sedes2,
        datasets: [
          { label: "Normal",         data: sedes2.map(s => compBySede[s].normal),     backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 },
          { label: "Complejo",       data: sedes2.map(s => compBySede[s].complejo),   backgroundColor: "rgba(245,158,11,0.7)", borderRadius: 4 },
          { label: "En observación", data: sedes2.map(s => compBySede[s].observacion),backgroundColor: "rgba(167,139,250,0.7)", borderRadius: 4 },
          { label: "Crítico",        data: sedes2.map(s => compBySede[s].critico),    backgroundColor: "rgba(244,63,94,0.7)",  borderRadius: 4 },
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
  // ─── SNAPSHOT PARA INFORME ─────────────────────────
  function buildSnapshot(clientes, sesiones) {
    const casos = agruparEnCasos(sesiones);

    // Filtros activos
    const empresaId  = document.getElementById("filterEmpresa").value;
    const sedeVal    = document.getElementById("filterSede").value;
    const modalidad  = document.getElementById("filterModalidad").value;
    const anio       = document.getElementById("filterAnio").value;
    const mes        = document.getElementById("filterMes").value;

    // Nombre empresa
    let empresaNombre = "Todas las empresas";
    if (empresaId) {
      const emp = empresas.find(e => String(e.id) === empresaId);
      if (emp) empresaNombre = emp.cliente_definitivo || emp.cliente_final || empresaNombre;
    }

    // KPIs
    const trabConSesion = new Set(sesiones.map(s => s.cliente_id));
    const casosAbiertos = new Set();
    sesiones.filter(s => s.estado === "Abierto").forEach(s =>
      casosAbiertos.add(`${s.cliente_id}_${s.consulta_number}`)
    );
    const casosConfi = new Set();
    sesiones.filter(s => s.observaciones_confidenciales === true).forEach(s =>
      casosConfi.add(`${s.cliente_id}_${s.consulta_number}`)
    );
    let criticos = 0;
    casos.forEach(ss => { if (clasificarCaso(ss) === "critico") criticos++; });
    const reingresos = new Set();
    sesiones.filter(s => s.consulta_number >= 2).forEach(s => reingresos.add(s.cliente_id));

    // Tendencia por mes
    const byMonth = {};
    sesiones.forEach(s => {
      const f = new Date(s.fecha);
      const key = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    // Estados (por consulta)
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
    const bySede = {};
    sesiones.forEach(s => {
      const cl = rawClients.find(c => c.id === s.cliente_id);
      const sede = cl?.sede || "Sin sede";
      if (!bySede[sede]) bySede[sede] = { sesiones: 0, normal: 0, complejo: 0, observacion: 0, critico: 0 };
      bySede[sede].sesiones++;
    });
    casos.forEach(ss => {
      const cl = rawClients.find(c => c.id === ss[0]?.cliente_id);
      const sede = cl?.sede || "Sin sede";
      if (bySede[sede]) bySede[sede][clasificarCaso(ss)]++;
    });

    const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

    return {
      fechaGeneracion: new Date().toLocaleDateString("es-CO", {day:"2-digit",month:"long",year:"numeric"}),
      filtros: {
        empresa: empresaNombre,
        sede: sedeVal || "Todas",
        modalidad: modalidad === "orientacion" ? "Orientación Psicosocial"
               : modalidad === "vigilancia"  ? "Sistema de Vigilancia Epidemiológica"
               : "Todas",
        anio: anio || "Todos",
        mes: mes ? MESES_FULL[parseInt(mes)-1] : "Todo el año",
      },
      esGeneral: !empresaId,
      kpis: {
        trabajadores: trabConSesion.size,
        consultas: casos.size,
        sesiones: sesiones.length,
        abiertos: casosAbiertos.size,
        confidenciales: casosConfi.size,
        criticos,
        reingresos: reingresos.size,
      },
      motivos: motivosOrdenados,
      estados: { abiertos: casosAbCount, cerrados: casosCeCount },
      complejidad: comp,
      cobertura: { unicos, promedio, virtuales, presenciales, masReciente,
        modFrecuente: virtuales >= presenciales ? "Virtual" : "Presencial" },
      sedes: bySede,
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