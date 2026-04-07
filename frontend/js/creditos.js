// frontend/js/creditos.js
// Módulo de Asignación de Créditos

(function() {
  'use strict';

  // ========== VARIABLES GLOBALES ==========
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';
  const modalidadPrograma = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';

  let creditosAsignados = [];

  // ========== ELEMENTOS DEL DOM ==========
  const elements = {
    // Formulario de créditos
    anio:              document.getElementById('anio'),
    mes:               document.getElementById('mes'),
    consecutivo:       document.getElementById('consecutivo'),
    cantidadHoras:     document.getElementById('cantidadHoras'),
    btnGuardar:        document.getElementById('btnGuardar'),
    btnCancelar:       document.getElementById('btnCancelar'),
    btnVolverAgendamiento: document.getElementById('btnVolverAgendamiento'),
    // Tabla de créditos
    creditosTableBody: document.getElementById('creditosTableBody'),
    emptyState:        document.getElementById('emptyState'),
    creditosCount:     document.getElementById('creditosCount'),
    filtroAnio:        document.getElementById('filtroAnio'),
    filtroMes:         document.getElementById('filtroMes'),
    // Botón Lista Agendados
    btnListaAgendados: document.getElementById('btnListaAgendados'),
    // Modal
    modalOverlay:      document.getElementById('modalDetalleCredito'),
    modalCreditoInfo:  document.getElementById('modalCreditoInfo'),
    btnCerrarModal:    document.getElementById('btnCerrarModal'),
    btnCerrarModalFooter: document.getElementById('btnCerrarModalFooter'),
    modalLoading:      document.getElementById('modalLoading'),
    modalEmpty:        document.getElementById('modalEmpty'),
    citasDetalleTable: document.getElementById('citasDetalleTable'),
    citasDetalleBody:  document.getElementById('citasDetalleBody'),
    totalCitasModal:   document.getElementById('totalCitasModal'),
    modalHeaderSubtitle: document.getElementById('modalHeaderSubtitle'),
    // Info resumen del crédito en el modal
    infoConsecutivo:   document.getElementById('infoConsecutivo'),
    infoTotal:         document.getElementById('infoTotal'),
    infoUsadas:        document.getElementById('infoUsadas'),
    infoDisponibles:   document.getElementById('infoDisponibles'),
  };

  // ========== INICIALIZACIÓN ==========
  function init() {
    console.log('🚀 Inicializando módulo de créditos...');
    console.log('📋 Modalidad:', modalidadPrograma);

    verificarAutenticacion();
    llenarSelectHoras();
    cargarCreditosGuardados();
    attachEventListeners();
  }

  // ========== AUTENTICACIÓN ==========
  function verificarAutenticacion() {
    const token    = localStorage.getItem('authToken');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (!token || !userData.id) {
      window.location.href = 'login.html';
      return;
    }
    if (userData.rol !== 'admin') {
      mostrarNotificacion('Acceso denegado: solo administradores', 'error');
      setTimeout(() => { window.location.href = 'agendamiento.html'; }, 2000);
      return;
    }
    console.log('✅ Usuario:', userData.nombre, '- Rol:', userData.rol);
  }

  // ========== SELECT DE HORAS ==========
  function llenarSelectHoras() {
    elements.cantidadHoras.innerHTML = '<option value="">Seleccione las horas</option>';
    for (let i = 1; i <= 100; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} ${i === 1 ? 'hora' : 'horas'}`;
      elements.cantidadHoras.appendChild(opt);
    }
  }

  // ========== CARGAR CRÉDITOS ==========
  function cargarCreditosGuardados() {
    const now = new Date();
    elements.filtroAnio.value = now.getFullYear();
    elements.filtroMes.value  = now.getMonth() + 1;
    cargarCreditosFiltrados();
  }

  async function cargarCreditosFiltrados() {
    try {
      const anio = elements.filtroAnio.value;
      const mes  = elements.filtroMes.value;

      if (!anio || !mes) {
        creditosAsignados = [];
        renderizarTabla();
        return;
      }

      const token    = localStorage.getItem('authToken');
      const url      = `${API_URL}/api/creditos?anio=${anio}&mes=${mes}&modalidad_programa=${encodeURIComponent(modalidadPrograma)}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      creditosAsignados = (data.success && Array.isArray(data.data)) ? data.data : [];
      renderizarTabla();

    } catch (error) {
      console.error('❌ Error al cargar créditos:', error);
      mostrarNotificacion('Error al cargar créditos', 'error');
      creditosAsignados = [];
      renderizarTabla();
    }
  }

  // ========== EVENT LISTENERS ==========
  function attachEventListeners() {
    elements.btnGuardar.addEventListener('click', agregarCredito);

    elements.btnCancelar.addEventListener('click', () => {
      restaurarBotonGuardar();
      elements.anio.value          = '';
      elements.mes.value           = '';
      elements.consecutivo.value   = '';
      elements.cantidadHoras.value = '';
    });

    elements.btnVolverAgendamiento.addEventListener('click', () => {
      window.location.href = 'agendamiento.html';
    });

    elements.consecutivo.addEventListener('input', function() {
      this.value = this.value.replace(/[^a-zA-Z0-9\-\s]/g, '');
    });

    // Filtros
    elements.filtroAnio.addEventListener('change', cargarCreditosFiltrados);
    elements.filtroMes.addEventListener('change',  cargarCreditosFiltrados);

    // Sincronizar filtros con formulario
    elements.anio.addEventListener('change', function() {
      elements.filtroAnio.value = this.value;
      cargarCreditosFiltrados();
    });
    elements.mes.addEventListener('change', function() {
      elements.filtroMes.value = this.value;
      cargarCreditosFiltrados();
    });

    // Modal Lista Agendados
    elements.btnListaAgendados.addEventListener('click', abrirModalListaAgendados);
    elements.btnCerrarModal.addEventListener('click', cerrarModal);
    elements.btnCerrarModalFooter.addEventListener('click', cerrarModal);
    elements.modalOverlay.addEventListener('click', function(e) {
      if (e.target === elements.modalOverlay) cerrarModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') cerrarModal();
    });
  }

  // ========== CRUD DE CRÉDITOS ==========

  async function agregarCredito() {
    const editandoId = elements.btnGuardar.dataset.editandoId;
    if (editandoId) { await actualizarCredito(editandoId); return; }

    const anio         = elements.anio.value;
    const mes          = elements.mes.value;
    const consecutivo  = elements.consecutivo.value.trim();
    const cantidadHoras = elements.cantidadHoras.value;

    if (!anio || !mes || !consecutivo || !cantidadHoras) {
      mostrarNotificacion('Por favor complete todos los campos', 'error');
      return;
    }

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creditos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          anio: parseInt(anio), mes: parseInt(mes),
          consecutivo, cantidad_horas: parseInt(cantidadHoras),
          modalidad_programa: modalidadPrograma
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al guardar');

      mostrarNotificacion('Crédito guardado correctamente', 'success');
      elements.consecutivo.value   = '';
      elements.cantidadHoras.value = '';
      elements.filtroAnio.value    = anio;
      elements.filtroMes.value     = mes;
      cargarCreditosFiltrados();

    } catch (error) {
      console.error('❌ Error al guardar crédito:', error);
      mostrarNotificacion(error.message || 'Error al guardar', 'error');
    }
  }

  function editarCredito(credito) {
    elements.anio.value          = credito.anio;
    elements.mes.value           = credito.mes;
    elements.consecutivo.value   = credito.consecutivo;
    elements.cantidadHoras.value = credito.cantidad_horas;
    elements.btnGuardar.dataset.editandoId = credito.id;
    elements.btnGuardar.innerHTML = '<i class="fas fa-save"></i> Actualizar';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    mostrarNotificacion('Editando crédito. Modifique los campos y presione Actualizar.', 'info');
  }

  async function actualizarCredito(creditoId) {
    const anio         = elements.anio.value;
    const mes          = elements.mes.value;
    const consecutivo  = elements.consecutivo.value.trim();
    const cantidadHoras = elements.cantidadHoras.value;

    if (!anio || !mes || !consecutivo || !cantidadHoras) {
      mostrarNotificacion('Por favor complete todos los campos', 'error');
      return;
    }

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creditos/${creditoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          anio: parseInt(anio), mes: parseInt(mes),
          consecutivo, cantidad_horas: parseInt(cantidadHoras),
          modalidad_programa: modalidadPrograma
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al actualizar');

      mostrarNotificacion('Crédito actualizado correctamente', 'success');
      restaurarBotonGuardar();
      elements.anio.value = elements.mes.value = elements.consecutivo.value = elements.cantidadHoras.value = '';
      cargarCreditosFiltrados();

    } catch (error) {
      console.error('❌ Error al actualizar:', error);
      mostrarNotificacion(error.message || 'Error al actualizar', 'error');
    }
  }

  function restaurarBotonGuardar() {
    elements.btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar';
    delete elements.btnGuardar.dataset.editandoId;
  }

  async function eliminarCredito(id) {
    if (!confirm('¿Está seguro de eliminar este crédito? Esta acción no se puede deshacer.')) return;

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creditos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al eliminar');

      mostrarNotificacion('Crédito eliminado correctamente', 'success');
      cargarCreditosFiltrados();

    } catch (error) {
      console.error('❌ Error al eliminar:', error);
      mostrarNotificacion(error.message || 'Error al eliminar', 'error');
    }
  }

  // ========== RENDERIZAR TABLA DE CRÉDITOS ==========
  function renderizarTabla() {
    elements.creditosTableBody.innerHTML = '';

    if (creditosAsignados.length === 0) {
      elements.emptyState.style.display = 'block';
      elements.creditosCount.textContent = '0';
      return;
    }

    elements.emptyState.style.display  = 'none';
    elements.creditosCount.textContent = creditosAsignados.length;

    creditosAsignados.forEach(credito => {
      const horasConsumidas  = parseFloat(credito.horas_consumidas)  || 0;
      const cantidadHoras    = parseFloat(credito.cantidad_horas)    || 0;
      const horasDisponibles = cantidadHoras - horasConsumidas;

      const deshabilitado       = horasConsumidas > 0;
      const claseDeshabilitado  = deshabilitado ? 'disabled' : '';
      const tituloDeshabilitado = deshabilitado ? 'No se puede modificar un crédito con horas consumidas' : '';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="consecutivo">${credito.consecutivo}</td>
        <td class="horas">${cantidadHoras} ${cantidadHoras === 1 ? 'hora' : 'horas'}</td>
        <td class="horas-status">
          <span class="horas-usadas">${horasConsumidas.toFixed(1)}h</span> /
          <span class="horas-disponibles">${horasDisponibles.toFixed(1)}h</span>
        </td>
        <td class="actions">
          <button class="btn-edit ${claseDeshabilitado}" title="${tituloDeshabilitado || 'Editar'}"
                  ${deshabilitado ? 'disabled' : ''}>
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete ${claseDeshabilitado}" title="${tituloDeshabilitado || 'Eliminar'}"
                  ${deshabilitado ? 'disabled' : ''}>
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;

      if (!deshabilitado) {
        row.querySelector('.btn-edit').addEventListener('click',   () => editarCredito(credito));
        row.querySelector('.btn-delete').addEventListener('click', () => eliminarCredito(credito.id));
      }

      elements.creditosTableBody.appendChild(row);
    });
  }

  // ========== MODAL LISTA AGENDADOS ==========

  /**
   * Abrir el modal y cargar todas las citas de la modalidad
   */
  async function abrirModalListaAgendados() {
    console.log('📋 Abriendo modal Lista Agendados...');

    // Ocultar resumen de crédito (se muestra solo si hay uno seleccionado en filtro)
    elements.modalCreditoInfo.style.display = 'none';
    elements.modalHeaderSubtitle.textContent = 'Selecciona el formato para cada cita y presiona Asignar';

    // Resetear tabla
    elements.modalLoading.style.display    = 'block';
    elements.modalEmpty.style.display      = 'none';
    elements.citasDetalleTable.style.display = 'none';
    elements.citasDetalleBody.innerHTML    = '';
    elements.totalCitasModal.textContent   = '0';

    // Mostrar modal
    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar datos en paralelo: citas + créditos disponibles
    await cargarDatosModal();
  }

  function cerrarModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Cargar citas y créditos disponibles en paralelo
   */
  async function cargarDatosModal() {
    try {
      const token = localStorage.getItem('authToken');

      const [resCitas, resCreditos] = await Promise.all([
        fetch(`${API_URL}/api/citas?modalidad_programa=${encodeURIComponent(modalidadPrograma)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/creditos?anio=${elements.filtroAnio.value || new Date().getFullYear()}&mes=${elements.filtroMes.value || (new Date().getMonth() + 1)}&modalidad_programa=${encodeURIComponent(modalidadPrograma)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!resCitas.ok)    throw new Error(`Error al cargar citas: HTTP ${resCitas.status}`);
      if (!resCreditos.ok) throw new Error(`Error al cargar créditos: HTTP ${resCreditos.status}`);

      const dataCitas    = await resCitas.json();
      const dataCreditos = await resCreditos.json();

      const citas    = (dataCitas.success    && Array.isArray(dataCitas.data))    ? dataCitas.data    : [];
      const creditos = (dataCreditos.success && Array.isArray(dataCreditos.data)) ? dataCreditos.data : [];

      console.log(`✅ Citas: ${citas.length}, Créditos disponibles: ${creditos.length}`);

      elements.modalLoading.style.display = 'none';
      elements.totalCitasModal.textContent = citas.length;

      if (citas.length === 0) {
        elements.modalEmpty.style.display = 'block';
        return;
      }

      renderizarCitasModal(citas, creditos);

    } catch (error) {
      console.error('❌ Error al cargar datos del modal:', error);
      elements.modalLoading.style.display = 'none';
      elements.modalEmpty.style.display   = 'block';
      elements.modalEmpty.querySelector('p').textContent = 'Error al cargar las citas';
    }
  }

  /**
   * Renderizar filas con select de formato + botón Asignar por fila
   */
  function renderizarCitasModal(citas, creditos) {
    elements.citasDetalleBody.innerHTML = '';

    citas.forEach(cita => {
      const fechaFormateada = formatearFecha(cita.fecha);
      const horaInicio      = formatearHora(cita.hora_inicio);
      const horaFin         = formatearHora(cita.hora_fin);
      const badgeClass      = `badge-${cita.estado || 'programada'}`;

      // Construir opciones del select — mostrar horas disponibles de cada formato
      const opcionesCreditos = creditos.map(c => {
        const horasDisp = Math.max(0, parseFloat(c.cantidad_horas) - parseFloat(c.horas_consumidas));
        const selected  = String(cita.credito_id) === String(c.id) ? 'selected' : '';
        return `<option value="${c.id}" ${selected}>${c.consecutivo} (${horasDisp.toFixed(1)}h disp.)</option>`;
      }).join('');

      const sinFormatos = creditos.length === 0;
      const selectHtml = sinFormatos
        ? `<span style="color:#9ca3af;font-size:12px;font-style:italic;">Sin formatos cargados</span>`
        : `<select class="select-formato" data-cita-id="${cita.id}">
             <option value="">— Seleccionar —</option>
             ${opcionesCreditos}
           </select>`;

      // Botón Asignar / estado Asignado + botón Quitar
      const yaAsignado     = !!cita.credito_id;
      const btnAsignarHtml = sinFormatos ? '' : yaAsignado
        ? `<!-- Asignado: botón deshabilitado + botón quitar -->
           <div style="display:flex;gap:6px;align-items:center;">
             <button class="btn-asignar-fila asignado" disabled
                     style="cursor:not-allowed;opacity:0.85;">
               <i class="fas fa-check"></i> Asignado
             </button>
             <button class="btn-quitar-fila"
                     data-cita-id="${cita.id}"
                     title="Quitar asignación y devolver horas"
                     style="background:none;border:1px solid #ef4444;color:#ef4444;
                            padding:6px 10px;border-radius:6px;font-size:12px;
                            font-weight:600;cursor:pointer;white-space:nowrap;
                            transition:all 0.2s;display:flex;align-items:center;gap:4px;">
               <i class="fas fa-unlink"></i> Quitar
             </button>
           </div>`
        : `<button class="btn-asignar-fila"
                   data-cita-id="${cita.id}">
             <i class="fas fa-link"></i> Asignar
           </button>`;

      const tr = document.createElement('tr');
      tr.dataset.citaId = cita.id;
      tr.innerHTML = `
        <td class="td-profesional">
          <i class="fas fa-user-md"></i> ${cita.profesional_nombre || '—'}
        </td>
        <td>
          <i class="fas fa-user" style="color:#9ca3af;margin-right:4px;font-size:12px"></i>
          ${cita.trabajador_nombre || '—'}
        </td>
        <td class="td-fecha">
          <span class="fecha-dia">${fechaFormateada}</span>
          <span class="fecha-hora">
            <i class="fas fa-clock" style="font-size:11px"></i> ${horaInicio} – ${horaFin}
          </span>
        </td>
        <td>
          <span class="badge-estado ${badgeClass}">
            ${(cita.estado || 'programada').replace('_', ' ')}
          </span>
        </td>
        <td style="min-width:160px;">${selectHtml}</td>
        <td style="min-width:100px;">${btnAsignarHtml}</td>
      `;

      // Listener del botón Asignar
      const btnAsignar = tr.querySelector('.btn-asignar-fila');
      if (btnAsignar && !btnAsignar.disabled) {
        btnAsignar.addEventListener('click', () => asignarCreditoFila(tr, cita, creditos));
      }

      // Listener del botón Quitar
      const btnQuitar = tr.querySelector('.btn-quitar-fila');
      if (btnQuitar) {
        btnQuitar.addEventListener('click', () => quitarAsignacionFila(tr, cita, creditos));
      }

      elements.citasDetalleBody.appendChild(tr);
    });

    elements.citasDetalleTable.style.display = 'table';
    console.log(`✅ Modal renderizado: ${citas.length} cita(s)`);
  }

  /**
   * Asignar el crédito seleccionado a una cita concreta
   */
  async function asignarCreditoFila(tr, cita, creditos) {
    const select     = tr.querySelector('.select-formato');
    const btnAsignar = tr.querySelector('.btn-asignar-fila');
    const creditoId  = select ? select.value : null;

    // ✅ Validación: no permitir asignar si la cita está cancelada
    if (cita.estado === 'cancelada') {
      mostrarNotificacion('Debes cambiar el estado de la cita', 'error');
      return;
    }

    if (!creditoId) {
      mostrarNotificacion('Selecciona un formato antes de asignar', 'error');
      return;
    }

    // Deshabilitar mientras procesa
    btnAsignar.disabled = true;
    btnAsignar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/citas/${cita.id}/asignar-credito`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ credito_id: parseInt(creditoId) })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al asignar');
      }

      console.log(`✅ Cita ${cita.id} asignada al crédito ${creditoId}`);

      // Actualizar celda de acción: Asignado (disabled) + botón Quitar
      const tdAccion = tr.querySelector('td:last-child');
      tdAccion.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-asignar-fila asignado" disabled
                  style="cursor:not-allowed;opacity:0.85;">
            <i class="fas fa-check"></i> Asignado
          </button>
          <button class="btn-quitar-fila"
                  data-cita-id="${cita.id}"
                  title="Quitar asignación y devolver horas"
                  style="background:none;border:1px solid #ef4444;color:#ef4444;
                         padding:6px 10px;border-radius:6px;font-size:12px;
                         font-weight:600;cursor:pointer;white-space:nowrap;
                         transition:all 0.2s;display:flex;align-items:center;gap:4px;">
            <i class="fas fa-unlink"></i> Quitar
          </button>
        </div>`;

      // Actualizar credito_id en el objeto local de la cita
      cita.credito_id = parseInt(creditoId);

      // Reasignar listener del nuevo botón Quitar
      tdAccion.querySelector('.btn-quitar-fila')
        .addEventListener('click', () => quitarAsignacionFila(tr, cita, creditos));

      // Recargar tabla de créditos para reflejar el consumo
      cargarCreditosFiltrados();

      mostrarNotificacion(data.message || 'Formato asignado correctamente', 'success');

    } catch (error) {
      console.error('❌ Error al asignar:', error);
      btnAsignar.innerHTML = '<i class="fas fa-link"></i> Asignar';
      btnAsignar.disabled  = false;
      mostrarNotificacion(error.message || 'Error al asignar formato', 'error');
    }
  }

  /**
   * Quitar la asignación de crédito de una cita y devolver las horas
   */
  async function quitarAsignacionFila(tr, cita, creditos) {
    if (!confirm('¿Quitar la asignación de este formato? Las horas serán devueltas al crédito.')) return;

    const btnQuitar = tr.querySelector('.btn-quitar-fila');
    if (btnQuitar) {
      btnQuitar.disabled = true;
      btnQuitar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/citas/${cita.id}/asignar-credito`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ credito_id: null })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al quitar asignación');

      console.log(`✅ Asignación quitada de la cita ${cita.id}`);

      // Guardar el credito anterior antes de limpiar
      const creditoAnteriorId = cita.credito_id;
      cita.credito_id = null;

      // Restaurar el select sin selección
      const tdFormato = tr.querySelector('td:nth-last-child(2)');
      const select = tdFormato ? tdFormato.querySelector('.select-formato') : null;
      if (select) select.value = '';

      // Restaurar celda de acción: botón Asignar activo
      const tdAccion = tr.querySelector('td:last-child');
      tdAccion.innerHTML = `
        <button class="btn-asignar-fila" data-cita-id="${cita.id}">
          <i class="fas fa-link"></i> Asignar
        </button>`;
      tdAccion.querySelector('.btn-asignar-fila')
        .addEventListener('click', () => asignarCreditoFila(tr, cita, creditos));

      // Recalcular horas en selects del modal y recargar tabla
      if (creditoAnteriorId) {
        const creditoObj = creditos.find(c => String(c.id) === String(creditoAnteriorId));
        if (creditoObj) {
          const horasDevueltas = data.data?.horas_devueltas || 0;
          creditoObj.horas_consumidas = Math.max(0,
            (parseFloat(creditoObj.horas_consumidas) || 0) - horasDevueltas
          );
          const horasDisp = parseFloat(creditoObj.cantidad_horas) - creditoObj.horas_consumidas;
          document.querySelectorAll('.select-formato').forEach(sel => {
            const opt = sel.querySelector(`option[value="${creditoAnteriorId}"]`);
            if (opt) opt.textContent = `${creditoObj.consecutivo} (${horasDisp.toFixed(1)}h disp.)`;
          });
        }
      }
      cargarCreditosFiltrados();
      mostrarNotificacion('Asignación quitada y horas devueltas correctamente', 'success');

    } catch (error) {
      console.error('❌ Error al quitar asignación:', error);
      if (btnQuitar) {
        btnQuitar.disabled = false;
        btnQuitar.innerHTML = '<i class="fas fa-unlink"></i> Quitar';
      }
      mostrarNotificacion(error.message || 'Error al quitar asignación', 'error');
    }
  }

  /**
   * Actualizar las horas disponibles en todos los selects del modal
   * después de consumir horas de un crédito
   */
  function actualizarHorasEnSelects(creditoId, horasConsumidasNuevas, creditos) {
    const credito = creditos.find(c => String(c.id) === String(creditoId));
    if (!credito) return;

    // Actualizar el objeto local
    credito.horas_consumidas = (parseFloat(credito.horas_consumidas) || 0) + horasConsumidasNuevas;
    const horasDisp = Math.max(0, parseFloat(credito.cantidad_horas) - credito.horas_consumidas);

    // Actualizar el texto de la opción en todos los selects visibles
    document.querySelectorAll('.select-formato').forEach(sel => {
      const opt = sel.querySelector(`option[value="${creditoId}"]`);
      if (opt) {
        opt.textContent = `${credito.consecutivo} (${horasDisp.toFixed(1)}h disp.)`;
      }
    });
  }

  // ========== NOTIFICACIONES ==========
  function mostrarNotificacion(mensaje, tipo = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${tipo}`;
    const icon = tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : 'info-circle';
    notif.innerHTML = `<i class="fas fa-${icon}"></i><span>${mensaje}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => {
      notif.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notif.remove(), 300);
    }, 3500);
  }

  // ========== UTILIDADES DE FECHA/HORA ==========

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const soloFecha = String(fechaStr).split('T')[0];
    const [anio, mes, dia] = soloFecha.split('-').map(Number);
    if (!anio || !mes || !dia) return '—';
    const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
    return fecha.toLocaleDateString('es-CO', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function formatearHora(horaStr) {
    if (!horaStr) return '—';
    const [h, m] = horaStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function nombreMes(num) {
    const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return meses[parseInt(num)] || num;
  }

  // ========== INICIAR ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();