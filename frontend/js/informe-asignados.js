// js/informe-asignados.js
// Módulo: Modal "Informe Asignados"
// Muestra los trabajadores con crédito asignado filtrando por año, mes y formato
// v2 — Lee desde la BD (asignaciones_creditos) en lugar de localStorage

(function () {
  'use strict';

  // ─── Configuración ────────────────────────────────────────────────────────
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';

  // ─── Referencias DOM ─────────────────────────────────────────────────────
  const btnAbrir        = document.getElementById('btnInformeAsignados');
  const modalOverlay    = document.getElementById('modalInformeAsignados');
  const btnCerrar       = document.getElementById('btnCerrarInforme');
  const btnCerrarFooter = document.getElementById('btnCerrarInformeFooter');
  const selAnio         = document.getElementById('informeAnio');
  const selMes          = document.getElementById('informeMes');
  const selFormato      = document.getElementById('informeFormato');
  const loading         = document.getElementById('informeLoading');
  const empty           = document.getElementById('informeEmpty');
  const emptyMsg        = document.getElementById('informeEmptyMsg');
  const tabla           = document.getElementById('informeTable');
  const tbody           = document.getElementById('informeTableBody');
  const spanTotal       = document.getElementById('informeTotal');
  const spanTotalHoras  = document.getElementById('informeTotalHoras');

  // ─── Init ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (!btnAbrir) return;

    btnAbrir.addEventListener('click', abrirModal);
    btnCerrar?.addEventListener('click', cerrarModal);
    btnCerrarFooter?.addEventListener('click', cerrarModal);
    modalOverlay?.addEventListener('click', e => {
      if (e.target === modalOverlay) cerrarModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalOverlay?.classList.contains('active')) cerrarModal();
    });

    // Al cambiar año o mes: recargar formatos disponibles
    selAnio?.addEventListener('change', cargarFormatos);
    selMes?.addEventListener('change',  cargarFormatos);

    // Al cambiar formato: generar informe desde la BD
    selFormato?.addEventListener('change', generarInforme);
  });

  // ─── Abrir modal ─────────────────────────────────────────────────────────
  async function abrirModal() {
    const now = new Date();
    selAnio.value = now.getFullYear();
    selMes.value  = now.getMonth() + 1;

    resetTabla('Seleccione año, mes y formato para generar el informe');
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

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
      const token            = localStorage.getItem('authToken');
      const modalidadPrograma = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';

      const res = await fetch(
        `${API_URL}/api/creditos?anio=${anio}&mes=${mes}&modalidad_programa=${encodeURIComponent(modalidadPrograma)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const creditos = Array.isArray(data.data) ? data.data : [];

      selFormato.innerHTML = '<option value="">— Seleccione un formato —</option>';

      if (creditos.length === 0) {
        const opt = document.createElement('option');
        opt.disabled    = true;
        opt.textContent = 'No hay formatos en este periodo';
        selFormato.appendChild(opt);
        return;
      }

      creditos.forEach(c => {
        const horasDisp  = Math.max(0, c.cantidad_horas - c.horas_consumidas);
        const horasTotal = parseFloat(c.cantidad_horas) || 0;
        const opt        = document.createElement('option');
        opt.value       = c.id;
        opt.textContent = `${c.consecutivo} (${horasDisp.toFixed(1)}h disp.) de ${Number.isInteger(horasTotal) ? horasTotal : horasTotal.toFixed(1)} totales`;
        selFormato.appendChild(opt);
      });

    } catch (err) {
      console.error('❌ Error al cargar formatos:', err);
      selFormato.innerHTML = '<option value="">Error al cargar formatos</option>';
    }
  }

  // ─── Generar informe desde la BD ──────────────────────────────────────────
  async function generarInforme() {
    const creditoId = selFormato.value;
    if (!creditoId) {
      resetTabla('Seleccione un formato para generar el informe');
      return;
    }

    loading.style.display      = 'block';
    empty.style.display        = 'none';
    tabla.style.display        = 'none';
    tbody.innerHTML            = '';
    spanTotal.textContent      = '0';
    spanTotalHoras.textContent = '0';

    try {
      const token = localStorage.getItem('authToken');

      // ── Consultar asignaciones directamente desde la BD ──────────────────
      const res = await fetch(
        `${API_URL}/api/creditos/${creditoId}/asignaciones`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      loading.style.display = 'none';

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data        = await res.json();
      const asignaciones = Array.isArray(data.data) ? data.data : [];

      if (asignaciones.length === 0) {
        empty.style.display  = 'block';
        emptyMsg.textContent = 'No hay trabajadores asignados a este formato';
        return;
      }

      renderizarInforme(asignaciones);

    } catch (err) {
      console.error('❌ Error al generar informe:', err);
      loading.style.display = 'none';
      empty.style.display   = 'block';
      emptyMsg.textContent  = 'Error al generar el informe';
    }
  }

  // ─── Renderizar tabla del informe ─────────────────────────────────────────
  function renderizarInforme(filas) {
    // Ordenar por fecha de sesión ascendente
    filas.sort((a, b) => {
      if (!a.fecha_sesion) return 1;
      if (!b.fecha_sesion) return -1;
      return new Date(a.fecha_sesion) - new Date(b.fecha_sesion);
    });

    tbody.innerHTML = '';
    let totalHoras  = 0;

    filas.forEach(fila => {
      const horas = parseFloat(fila.horas_asignadas) || 1;
      totalHoras += horas;

      // Mostrar nombre desde la BD (guardado al momento de asignar)
      const profesionalNombre = fila.profesional_nombre || `Profesional #${fila.profesional_id}`;
      const trabajadorNombre  = fila.trabajador_nombre  || `Trabajador #${fila.trabajador_id}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:12px;font-weight:600;color:#6d28d9;">
          <i class="fas fa-user-md" style="margin-right:6px;font-size:12px;"></i>
          ${escHtml(profesionalNombre)}
        </td>
        <td style="padding:12px;color:#374151;">
          <i class="fas fa-user" style="color:#9ca3af;margin-right:6px;font-size:11px;"></i>
          ${escHtml(trabajadorNombre)}
        </td>
        <td style="padding:12px;font-weight:600;color:#374151;">
          ${formatearFecha(fila.fecha_sesion)}
        </td>
        <td style="padding:12px;text-align:center;">
          <span style="background:#ede9fe;color:#4c1d95;font-weight:700;
                       padding:3px 12px;border-radius:20px;font-size:13px;">
            ${horas % 1 === 0 ? horas : horas.toFixed(1)}
            ${horas === 1 ? 'hora' : 'horas'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tabla.style.display        = 'table';
    empty.style.display        = 'none';
    spanTotal.textContent      = filas.length;
    const horasDisplay         = totalHoras % 1 === 0 ? totalHoras : totalHoras.toFixed(1);
    spanTotalHoras.textContent = `${horasDisplay} ${totalHoras === 1 ? 'hora' : 'horas'}`;
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