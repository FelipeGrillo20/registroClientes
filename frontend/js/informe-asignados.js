// js/informe-asignados.js
// Módulo: Modal "Informe Asignados"
// Muestra los trabajadores con crédito asignado filtrando por año, mes y formato

(function () {
  'use strict';

  // ─── Configuración ────────────────────────────────────────────────────────
  const API_URL          = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';
  const API_CLIENTS      = window.API_CONFIG?.ENDPOINTS?.CLIENTS  || `${API_URL}/api/clients`;
  const API_CONSULTAS    = window.API_CONFIG?.ENDPOINTS?.CONSULTAS || `${API_URL}/api/consultas`;
  const STORAGE_KEY_BASE = 'creditos_asignaciones_';
  const MODALIDADES      = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];

  // ─── Referencias DOM ─────────────────────────────────────────────────────
  const btnAbrir         = document.getElementById('btnInformeAsignados');
  const modalOverlay     = document.getElementById('modalInformeAsignados');
  const btnCerrar        = document.getElementById('btnCerrarInforme');
  const btnCerrarFooter  = document.getElementById('btnCerrarInformeFooter');
  const selAnio          = document.getElementById('informeAnio');
  const selMes           = document.getElementById('informeMes');
  const selFormato       = document.getElementById('informeFormato');
  const loading          = document.getElementById('informeLoading');
  const empty            = document.getElementById('informeEmpty');
  const emptyMsg         = document.getElementById('informeEmptyMsg');
  const tabla            = document.getElementById('informeTable');
  const tbody            = document.getElementById('informeTableBody');
  const spanTotal        = document.getElementById('informeTotal');
  const spanTotalHoras   = document.getElementById('informeTotalHoras');

  // ─── Estado ──────────────────────────────────────────────────────────────
  let _asignaciones = new Map(); // creditoId_sesionKey → { profesional, trabajador, fecha, horas }
  let _creditos     = [];        // Lista de créditos del periodo seleccionado

  // ─── Init ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (!btnAbrir) return;

    btnAbrir.addEventListener('click', abrirModal);
    btnCerrar?.addEventListener('click', cerrarModal);
    btnCerrarFooter?.addEventListener('click', cerrarModal);
    modalOverlay?.addEventListener('click', e => { if (e.target === modalOverlay) cerrarModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOverlay?.classList.contains('active')) cerrarModal(); });

    // Al cambiar año o mes: recargar formatos disponibles
    selAnio?.addEventListener('change', cargarFormatos);
    selMes?.addEventListener('change',  cargarFormatos);

    // Al cambiar formato: generar informe
    selFormato?.addEventListener('change', generarInforme);
  });

  // ─── Abrir modal ─────────────────────────────────────────────────────────
  async function abrirModal() {
    // Preseleccionar mes y año actuales
    const now = new Date();
    selAnio.value = now.getFullYear();
    selMes.value  = now.getMonth() + 1;

    // Resetear tabla
    resetTabla('Seleccione año, mes y formato para generar el informe');

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar formatos del periodo actual
    await cargarFormatos();
  }

  function cerrarModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ─── Cargar formatos del periodo ──────────────────────────────────────────
  async function cargarFormatos() {
    const anio = selAnio.value;
    const mes  = selMes.value;

    selFormato.innerHTML = '<option value="">— Cargando... —</option>';
    resetTabla('Seleccione un formato para generar el informe');

    try {
      const token = localStorage.getItem('authToken');
      const modalidadPrograma = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';

      const res = await fetch(
        `${API_URL}/api/creditos?anio=${anio}&mes=${mes}&modalidad_programa=${encodeURIComponent(modalidadPrograma)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _creditos = Array.isArray(data.data) ? data.data : [];

      selFormato.innerHTML = '<option value="">— Seleccione un formato —</option>';

      if (_creditos.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'No hay formatos en este periodo';
        selFormato.appendChild(opt);
        return;
      }

      _creditos.forEach(c => {
        const horasDisp  = Math.max(0, c.cantidad_horas - c.horas_consumidas);
        const horasTotal = parseFloat(c.cantidad_horas) || 0;
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.consecutivo} (${horasDisp.toFixed(1)}h disp.) de ${horasTotal % 1 === 0 ? horasTotal.toFixed(0) : horasTotal.toFixed(1)} totales`;
        selFormato.appendChild(opt);
      });

    } catch (err) {
      console.error('❌ Error al cargar formatos:', err);
      selFormato.innerHTML = '<option value="">Error al cargar formatos</option>';
    }
  }

  // ─── Generar informe ──────────────────────────────────────────────────────
  async function generarInforme() {
    const creditoId = selFormato.value;
    if (!creditoId) {
      resetTabla('Seleccione un formato para generar el informe');
      return;
    }

    loading.style.display = 'block';
    empty.style.display   = 'none';
    tabla.style.display   = 'none';
    tbody.innerHTML       = '';
    spanTotal.textContent      = '0';
    spanTotalHoras.textContent = '0';

    try {
      // 1. Leer asignaciones del localStorage
      const asignacionesMap = leerAsignaciones();

      // 2. Filtrar entradas que corresponden a este creditoId
      const entradas = [];
      asignacionesMap.forEach((valor, clave) => {
        if (String(valor.credito_id) === String(creditoId)) {
          // Clave: profesionalId_clienteId_sesionId
          const partes = clave.split('_');
          if (partes.length >= 3) {
            entradas.push({
              profesional_id: partes[0],
              cliente_id:     partes[1],
              sesion_id:      partes[2],
              horas:          valor.horas_asignadas || 1
            });
          }
        }
      });

      loading.style.display = 'none';

      if (entradas.length === 0) {
        empty.style.display  = 'block';
        emptyMsg.textContent = 'No hay trabajadores asignados a este formato';
        return;
      }

      // 3. Enriquecer con datos de profesional, trabajador y fecha de sesión
      const token = localStorage.getItem('authToken');
      const filas = await enriquecerEntradas(entradas, token);

      if (filas.length === 0) {
        empty.style.display  = 'block';
        emptyMsg.textContent = 'No se pudieron cargar los datos del informe';
        return;
      }

      // 4. Renderizar
      renderizarInforme(filas);

    } catch (err) {
      console.error('❌ Error al generar informe:', err);
      loading.style.display = 'none';
      empty.style.display   = 'block';
      emptyMsg.textContent  = 'Error al generar el informe';
    }
  }

  // ─── Leer asignaciones del localStorage ──────────────────────────────────
  function leerAsignaciones() {
    const mapa = new Map();
    MODALIDADES.forEach(mod => {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_BASE}${mod}`);
        if (!raw) return;
        JSON.parse(raw).forEach(([k, v]) => mapa.set(k, v));
      } catch (_) {}
    });
    return mapa;
  }

  // ─── Enriquecer entradas con datos de API ────────────────────────────────
  async function enriquecerEntradas(entradas, token) {
    const headers = { 'Authorization': `Bearer ${token}` };

    // Cargar usuarios (profesionales) y sesiones (consultas) en paralelo
    try {
      const [resUsers, resConsultas] = await Promise.all([
        fetch(`${API_URL}/api/auth/users`, { headers }),
        fetch(API_CONSULTAS, { headers })
      ]);

      const dataUsers    = resUsers.ok    ? await resUsers.json()    : {};
      const dataConsultas = resConsultas.ok ? await resConsultas.json() : [];

      const usuarios   = dataUsers.users || [];
      const consultas  = Array.isArray(dataConsultas) ? dataConsultas : [];

      // Cargar clientes para obtener nombres de trabajadores
      const resClients = await fetch(API_CLIENTS, { headers });
      const clientes = resClients.ok ? await resClients.json() : [];

      return entradas.map(entrada => {
        const profesional = usuarios.find(u => String(u.id) === String(entrada.profesional_id));
        const sesion      = consultas.find(c => String(c.id) === String(entrada.sesion_id));
        const cliente     = clientes.find(c => String(c.id) === String(entrada.cliente_id));

        return {
          profesional_nombre: profesional?.nombre || `Profesional #${entrada.profesional_id}`,
          trabajador_nombre:  sesion?.nombre || cliente?.nombre || `Trabajador #${entrada.cliente_id}`,
          fecha_sesion:       sesion?.fecha || null,
          horas:              entrada.horas
        };
      }).filter(f => f.fecha_sesion); // Solo filas con fecha válida

    } catch (err) {
      console.error('❌ Error al enriquecer entradas:', err);
      return [];
    }
  }

  // ─── Renderizar tabla del informe ─────────────────────────────────────────
  function renderizarInforme(filas) {
    // Ordenar por fecha
    filas.sort((a, b) => new Date(a.fecha_sesion) - new Date(b.fecha_sesion));

    tbody.innerHTML = '';
    let totalHoras  = 0;

    filas.forEach(fila => {
      const horas = parseInt(fila.horas) || 1;
      totalHoras += horas;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:12px;font-weight:600;color:#6d28d9;">
          <i class="fas fa-user-md" style="margin-right:6px;font-size:12px;"></i>
          ${escHtml(fila.profesional_nombre)}
        </td>
        <td style="padding:12px;color:#374151;">
          <i class="fas fa-user" style="color:#9ca3af;margin-right:6px;font-size:11px;"></i>
          ${escHtml(fila.trabajador_nombre)}
        </td>
        <td style="padding:12px;font-weight:600;color:#374151;">
          ${formatearFecha(fila.fecha_sesion)}
        </td>
        <td style="padding:12px;text-align:center;">
          <span style="background:#ede9fe;color:#4c1d95;font-weight:700;
                       padding:3px 12px;border-radius:20px;font-size:13px;">
            ${horas} ${horas === 1 ? 'hora' : 'horas'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tabla.style.display        = 'table';
    empty.style.display        = 'none';
    spanTotal.textContent      = filas.length;
    spanTotalHoras.textContent = `${totalHoras} ${totalHoras === 1 ? 'hora' : 'horas'}`;
  }

  // ─── Utilidades ───────────────────────────────────────────────────────────
  function resetTabla(msg) {
    tabla.style.display        = 'none';
    tbody.innerHTML            = '';
    loading.style.display      = 'none';
    empty.style.display        = 'block';
    emptyMsg.textContent       = msg;
    spanTotal.textContent      = '0';
    spanTotalHoras.textContent = '0';
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const soloFecha = String(fechaStr).split('T')[0];
    const [a, m, d] = soloFecha.split('-').map(Number);
    if (!a || !m || !d) return '—';
    return new Date(a, m - 1, d, 12).toLocaleDateString('es-CO', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();