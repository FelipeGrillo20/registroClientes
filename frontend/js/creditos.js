// frontend/js/creditos.js
// Módulo de Asignación de Créditos

(function() {
  'use strict';

  // ========== VARIABLES GLOBALES ==========
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';
  const modalidadPrograma = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';

  let creditosAsignados = [];

  // ========== PERSISTENCIA DE ASIGNACIONES ==========
  // Clave: "profesionalId_clienteId_sesionId" → { credito_id, horas_asignadas }
  // Se guarda en localStorage para sobrevivir entre recargas de página

  const STORAGE_KEY = `creditos_asignaciones_${modalidadPrograma}`;

  function _cargarAsignaciones() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Map();
      return new Map(JSON.parse(raw));
    } catch (_) {
      return new Map();
    }
  }

  function _guardarAsignaciones() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([..._asignaciones]));
    } catch (_) {}
  }

  const _asignaciones = _cargarAsignaciones();

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
    btnListaAgendados:   document.getElementById('btnListaAgendados'),
    btnSinAsignacion:    document.getElementById('btnSinAsignacion'),
    // Modal Sin Asignación
    modalSA:             document.getElementById('modalSinAsignacion'),
    modalSAProfesional:  document.getElementById('modalSAProfesional'),
    modalSALoading:      document.getElementById('modalSALoading'),
    modalSAEmpty:        document.getElementById('modalSAEmpty'),
    modalSAEmptyMsg:     document.getElementById('modalSAEmptyMsg'),
    modalSATable:        document.getElementById('modalSATable'),
    modalSABody2:        document.getElementById('modalSABody2'),
    modalSATotal:        document.getElementById('modalSATotal'),
    // Modal
    modalOverlay:      document.getElementById('modalDetalleCredito'),
    modalCreditoInfo:  document.getElementById('modalCreditoInfo'),
    btnCerrarModal:    document.getElementById('btnCerrarModal'),
    btnCerrarModalFooter: document.getElementById('btnCerrarModalFooter'),
    modalLoading:      document.getElementById('modalLoading'),
    modalEmpty:        document.getElementById('modalEmpty'),
    modalEmptyMsg:     document.getElementById('modalEmptyMsg'),
    citasDetalleTable: document.getElementById('citasDetalleTable'),
    citasDetalleBody:  document.getElementById('citasDetalleBody'),
    totalCitasModal:   document.getElementById('totalCitasModal'),
    modalHeaderSubtitle: document.getElementById('modalHeaderSubtitle'),
    // Filtros del modal
    modalProfesional:         document.getElementById('modalProfesional'),

    modalAnio:                document.getElementById('modalAnio'),
    modalMes:                 document.getElementById('modalMes'),
    modalHoras:               document.getElementById('modalHoras'),
    btnGenerarSesiones:       document.getElementById('btnGenerarSesiones'),
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
    // Modal Sin Asignación
    if (elements.btnSinAsignacion) elements.btnSinAsignacion.addEventListener('click', abrirModalSinAsignacion);
    document.getElementById('btnCerrarModalSA')?.addEventListener('click', cerrarModalSA);
    document.getElementById('btnCerrarModalSAFooter')?.addEventListener('click', cerrarModalSA);
    document.getElementById('modalSinAsignacion')?.addEventListener('click', function(e) {
      if (e.target === this) cerrarModalSA();
    });
    // Botón Generar sesiones
    if (elements.btnGenerarSesiones) elements.btnGenerarSesiones.addEventListener('click', generarSesiones);
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

      // Editar: siempre habilitado
      // Eliminar: solo si no hay horas consumidas
      const puedeEliminar       = horasConsumidas === 0;
      const claseDeleteDis      = puedeEliminar ? '' : 'disabled';
      const tituloDeleteDis     = puedeEliminar ? 'Eliminar' : 'No se puede eliminar un crédito con horas consumidas';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="consecutivo">${credito.consecutivo}</td>
        <td class="horas">${cantidadHoras} ${cantidadHoras === 1 ? 'hora' : 'horas'}</td>
        <td class="horas-status">
          <span class="horas-usadas">${horasConsumidas.toFixed(1)}h</span> /
          <span class="horas-disponibles">${horasDisponibles.toFixed(1)}h</span>
        </td>
        <td class="actions">
          <button class="btn-edit" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete ${claseDeleteDis}" title="${tituloDeleteDis}"
                  ${puedeEliminar ? '' : 'disabled'}>
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;

      // Editar siempre disponible
      row.querySelector('.btn-edit').addEventListener('click', () => editarCredito(credito));
      // Eliminar solo si no hay horas consumidas
      if (puedeEliminar) {
        row.querySelector('.btn-delete').addEventListener('click', () => eliminarCredito(credito.id));
      }

      elements.creditosTableBody.appendChild(row);
    });
  }

  // ========== MODAL LISTA AGENDADOS (NUEVO FLUJO) ==========

  /**
   * Abrir el modal e inicializar filtros
   */
  async function abrirModalListaAgendados() {
    console.log('📋 Abriendo modal Detalle de uso del crédito...');

    // Ocultar resumen de crédito
    elements.modalCreditoInfo.style.display  = 'none';
    elements.modalHeaderSubtitle.textContent = 'Selecciona el formato para cada registro y presiona Asignar';

    // Resetear tabla y estados
    elements.modalLoading.style.display      = 'none';
    elements.modalEmpty.style.display        = 'block';
    elements.citasDetalleTable.style.display = 'none';
    elements.citasDetalleBody.innerHTML      = '';
    elements.totalCitasModal.textContent     = '0';

    // Inicializar selects de Año/Mes con valores actuales
    const now = new Date();
    elements.modalAnio.value = now.getFullYear();
    elements.modalMes.value  = now.getMonth() + 1;

    // Llenar select de horas (1 a 100, predeterminado 1)
    // Resetear profesional, tabla y botón Generar
    elements.modalProfesional.value           = '';
    elements.btnGenerarSesiones.disabled      = true;
    elements.btnGenerarSesiones.style.opacity = '0.45';
    elements.btnGenerarSesiones.innerHTML     = '<i class="fas fa-bolt"></i> Generar';


    // Mostrar modal
    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar lista de profesionales
    await cargarProfesionalesModal();
  }

  function cerrarModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Llenar el select de horas del modal (1-100, default 1)
   */
  function llenarSelectHorasModal() {
    elements.modalHoras.innerHTML = '';
    for (let i = 1; i <= 100; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} ${i === 1 ? 'hora' : 'horas'}`;
      if (i === 1) opt.selected = true;
      elements.modalHoras.appendChild(opt);
    }
  }

  /**
   * Cargar profesionales en el select del modal
   * Intenta múltiples endpoints conocidos del sistema
   */
  /**
   * Cargar profesionales — igual que agendamiento.js: GET /api/auth/users → data.users
   */
  async function cargarProfesionalesModal() {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const profesionales = data.users || [];

      elements.modalProfesional.innerHTML = '<option value="">Seleccione un profesional</option>';
      profesionales.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        elements.modalProfesional.appendChild(opt);
      });

      console.log(`✅ Profesionales cargados: ${profesionales.length}`);

      // Al cambiar profesional: habilitar/deshabilitar Generar, limpiar tabla
      elements.modalProfesional.onchange = () => {
        const hayProf = !!elements.modalProfesional.value;
        elements.btnGenerarSesiones.disabled      = !hayProf;
        elements.btnGenerarSesiones.style.opacity = hayProf ? '1' : '0.45';
        // Limpiar tabla al cambiar profesional
        elements.citasDetalleTable.style.display  = 'none';
        elements.citasDetalleBody.innerHTML       = '';
        elements.totalCitasModal.textContent      = '0';
        elements.modalEmpty.style.display         = 'block';
        document.getElementById('modalEmptyMsg').textContent =
          'Presiona "Generar" para cargar las sesiones del periodo seleccionado';
      };

    } catch (error) {
      console.error('❌ Error al cargar profesionales:', error);
      mostrarNotificacion('Error al cargar profesionales', 'error');
    }
  }

  /**
   * Generar sesiones: llama a GET /api/consultas/sesiones-creditos
   * filtrando por profesional + año + mes
   * Cada sesión = una fila en la tabla
   */
  async function generarSesiones() {
    const profesionalId     = elements.modalProfesional.value;
    const anio              = elements.modalAnio.value;
    const mes               = elements.modalMes.value;
    const horas             = elements.modalHoras.value;
    const profesionalNombre = elements.modalProfesional.options[elements.modalProfesional.selectedIndex].text;

    if (!profesionalId) {
      mostrarNotificacion('Selecciona un profesional primero', 'error');
      return;
    }

    // Limpiar tabla y mostrar loading
    elements.citasDetalleTable.style.display = 'none';
    elements.citasDetalleBody.innerHTML      = '';
    elements.totalCitasModal.textContent     = '0';
    elements.modalLoading.style.display      = 'block';
    elements.modalEmpty.style.display        = 'none';

    // Deshabilitar Generar mientras carga
    elements.btnGenerarSesiones.disabled     = true;
    elements.btnGenerarSesiones.innerHTML    = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    try {
      const token = localStorage.getItem('authToken');
      const url   = `${API_URL}/api/consultas/sesiones-creditos?profesional_id=${profesionalId}&anio=${anio}&mes=${mes}`;
      const res   = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      elements.modalLoading.style.display = 'none';

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const sesiones = await res.json();
      if (!Array.isArray(sesiones)) throw new Error('Formato de respuesta inválido');

      console.log(`✅ Sesiones encontradas: ${sesiones.length}`);

      if (sesiones.length === 0) {
        elements.modalEmpty.style.display = 'block';
        document.getElementById('modalEmptyMsg').textContent =
          `No hay sesiones registradas en ${nombreMes(mes)} ${anio} para este profesional`;
        return;
      }

      // Cargar créditos disponibles
      const creditos = await cargarCreditosParaModal();

      // Renderizar una fila por cada sesión
      sesiones.forEach(sesion => {
        // Clave de persistencia: profesional + trabajador + sesion.id
        const clave   = `${profesionalId}_${sesion.cliente_id}_${sesion.id}`;
        const guardado = _asignaciones.get(clave) || {};

        const registro = {
          id:                 `ses_${sesion.id}`,
          sesion_id:          sesion.id,
          profesional_id:     profesionalId,
          profesional_nombre: profesionalNombre,
          trabajador_id:      sesion.cliente_id,
          trabajador_nombre:  sesion.trabajador_nombre,
          fecha_sesion:       sesion.fecha,
          consulta_number:    sesion.consulta_number,
          anio, mes, horas,
          credito_id:      guardado.credito_id      || null,
          horas_asignadas: guardado.horas_asignadas || null,
          estado:          sesion.estado || 'Abierto'
        };
        renderizarRegistroModal(registro, creditos, anio, mes, horas, null);
      });

      elements.citasDetalleTable.style.display = 'table';
      elements.modalEmpty.style.display        = 'none';
      elements.totalCitasModal.textContent     = sesiones.length;

    } catch (error) {
      console.error('❌ Error al generar sesiones:', error);
      elements.modalLoading.style.display = 'none';
      elements.modalEmpty.style.display   = 'block';
      document.getElementById('modalEmptyMsg').textContent = 'Error al cargar sesiones';
      mostrarNotificacion('Error al cargar sesiones', 'error');
    } finally {
      elements.btnGenerarSesiones.disabled  = false;
      elements.btnGenerarSesiones.innerHTML = '<i class="fas fa-bolt"></i> Generar';
    }
  }

  /**
   * Agregar un registro manual al modal (nuevo flujo)
   */
  async function agregarRegistroModal() {
    const profesionalId  = elements.modalProfesional.value;
    const trabajadorId   = elements.modalTrabajador.value;
    const anio           = elements.modalAnio.value;
    const mes            = elements.modalMes.value;
    const horas          = elements.modalHoras.value;

    if (!profesionalId || !trabajadorId) {
      mostrarNotificacion('Selecciona profesional y trabajador', 'error');
      return;
    }

    // Obtener textos legibles
    const profesionalNombre = elements.modalProfesional.options[elements.modalProfesional.selectedIndex].text;
    const trabajadorNombre  = elements.modalTrabajadorNombre.value;
    const mesNombre         = nombreMes(mes);

    // Cargar créditos disponibles para el select Formato
    const creditos = await cargarCreditosParaModal();

    // Crear fila en la tabla
    const registroTemp = {
      id:                `tmp_${Date.now()}`,
      profesional_id:    profesionalId,
      profesional_nombre: profesionalNombre,
      trabajador_id:     trabajadorId,
      trabajador_nombre: trabajadorNombre,
      anio, mes, horas,
      credito_id:        null,
      estado:            'programada'
    };

    renderizarRegistroModal(registroTemp, creditos, anio, mes, horas, mesNombre);

    elements.citasDetalleTable.style.display = 'table';
    elements.modalEmpty.style.display        = 'none';

    const total = parseInt(elements.totalCitasModal.textContent) + 1;
    elements.totalCitasModal.textContent = total;
  }

  /**
   * Cargar los créditos disponibles del periodo actual (para el select Formato del modal)
   */
  async function cargarCreditosParaModal() {
    try {
      const token = localStorage.getItem('authToken');
      const anio  = elements.filtroAnio.value || new Date().getFullYear();
      const mes   = elements.filtroMes.value  || (new Date().getMonth() + 1);
      const res   = await fetch(
        `${API_URL}/api/creditos?anio=${anio}&mes=${mes}&modalidad_programa=${encodeURIComponent(modalidadPrograma)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.success && Array.isArray(data.data)) ? data.data : [];
    } catch (error) {
      console.error('❌ Error al cargar créditos para modal:', error);
      return [];
    }
  }

  /**
   * Renderizar un registro (fila) en la tabla del modal
   */
  function renderizarRegistroModal(registro, creditos, anio, mes, horas, mesNombre) {
    const sinFormatos = creditos.length === 0;

    // Select de estado
    const estadosOpts = ['programada','confirmada','realizada','cancelada','no_asistio']
      .map(e => `<option value="${e}" ${registro.estado === e ? 'selected' : ''}>${e.replace('_',' ')}</option>`)
      .join('');

    // Select de formato
    const opcionesCreditos = creditos.map(c => {
      const horasDisp = Math.max(0, parseFloat(c.cantidad_horas) - parseFloat(c.horas_consumidas));
      const selected  = String(registro.credito_id) === String(c.id) ? 'selected' : '';
      return `<option value="${c.id}" ${selected}>${c.consecutivo} (${horasDisp.toFixed(1)}h disp.)</option>`;
    }).join('');

    const selectFormatoHtml = sinFormatos
      ? `<span style="color:#9ca3af;font-size:12px;font-style:italic;">Sin formatos cargados</span>`
      : `<select class="select-formato" data-registro-id="${registro.id}">
           <option value="">— Seleccionar —</option>
           ${opcionesCreditos}
         </select>`;

    const yaAsignado = !!registro.credito_id;
    const btnAccionHtml = sinFormatos ? '' : yaAsignado
      ? `<div style="display:flex;gap:6px;align-items:center;">
           <button class="btn-asignar-fila asignado" disabled style="cursor:not-allowed;opacity:0.85;">
             <i class="fas fa-check"></i> Asignado
           </button>
           <button class="btn-quitar-fila" title="Quitar asignación y devolver horas"
                   style="background:none;border:1px solid #ef4444;color:#ef4444;
                          padding:6px 10px;border-radius:6px;font-size:12px;
                          font-weight:600;cursor:pointer;white-space:nowrap;
                          transition:all 0.2s;display:flex;align-items:center;gap:4px;">
             <i class="fas fa-unlink"></i> Quitar
           </button>
         </div>`
      : `<button class="btn-asignar-fila">
           <i class="fas fa-link"></i> Asignar
         </button>`;

    const horasIniciales = parseInt(registro.horas_asignadas) || 1;

    const tr = document.createElement('tr');
    tr.dataset.registroId = registro.id;
    tr.innerHTML = `
      <td>
        <i class="fas fa-user" style="color:#9ca3af;margin-right:4px;font-size:12px"></i>
        ${registro.trabajador_nombre}
      </td>
      <td class="td-fecha">
        <span class="fecha-dia" style="font-weight:600;color:#374151;">
          ${registro.fecha_sesion ? formatearFecha(registro.fecha_sesion) : anio}
        </span>
        ${!registro.fecha_sesion ? `<span class="fecha-hora" style="font-size:12px;color:#6b7280;">${mesNombre || ''}</span>` : ''}
      </td>
      <td style="min-width:90px;">
        <div class="horas-spinner">
          <button type="button" class="spinner-btn spinner-down" title="Decrementar">&#9660;</button>
          <span class="spinner-value">${horasIniciales}</span>
          <button type="button" class="spinner-btn spinner-up" title="Incrementar">&#9650;</button>
        </div>
      </td>
      <!-- <td class="td-estado-select">
        <select class="select-estado-modal">
          \${estadosOpts}
        </select>
      </td> -->
      <td style="min-width:160px;">${selectFormatoHtml}</td>
      <td style="min-width:110px;">${btnAccionHtml}</td>
    `;

    // Listeners spinner de horas
    const spinnerValue = tr.querySelector('.spinner-value');
    tr.querySelector('.spinner-up').addEventListener('click', () => {
      const v = parseInt(spinnerValue.textContent) || 1;
      spinnerValue.textContent = v + 1;
      registro.horas = String(v + 1);
    });
    tr.querySelector('.spinner-down').addEventListener('click', () => {
      const v = parseInt(spinnerValue.textContent) || 1;
      if (v > 1) {
        spinnerValue.textContent = v - 1;
        registro.horas = String(v - 1);
      }
    });
    // Inicializar horas en el registro
    registro.horas = String(horasIniciales);

    // Listener botón Asignar
    const btnAsignar = tr.querySelector('.btn-asignar-fila');
    if (btnAsignar && !btnAsignar.disabled) {
      btnAsignar.addEventListener('click', () => asignarCreditoFila(tr, registro, creditos));
    }

    // Listener botón Quitar
    const btnQuitar = tr.querySelector('.btn-quitar-fila');
    if (btnQuitar) {
      btnQuitar.addEventListener('click', () => quitarAsignacionFila(tr, registro, creditos));
    }

    elements.citasDetalleBody.appendChild(tr);
  }

  /**
   * Asignar el crédito seleccionado a un registro
   */
  /**
   * Asignar formato (consumir horas directamente del crédito)
   * Llama a PATCH /api/creditos/:id/consumir  — sin depender de citas
   */
  async function asignarCreditoFila(tr, registro, creditos) {
    const selectFormato = tr.querySelector('.select-formato');
    const btnAsignar    = tr.querySelector('.btn-asignar-fila');
    const creditoId     = selectFormato ? selectFormato.value : null;

    if (!creditoId) {
      mostrarNotificacion('Selecciona un formato antes de asignar', 'error');
      return;
    }

    // Leer horas desde el spinner de la fila
    const spinnerVal = tr.querySelector('.spinner-value');
    const horas = spinnerVal ? (parseInt(spinnerVal.textContent) || 1)
                             : (parseFloat(registro.horas) || 1);

    btnAsignar.disabled = true;
    btnAsignar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creditos/${creditoId}/consumir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ horas })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al asignar');

      console.log(`✅ Consumidas ${horas}h del crédito ${creditoId} para ${registro.trabajador_nombre}`);

      // Guardar en el registro y persistir en el Map
      registro.credito_id      = parseInt(creditoId);
      registro.horas_asignadas = horas;
      const claveAsig = `${registro.profesional_id}_${registro.trabajador_id}_${registro.sesion_id || registro.id}`;
      _asignaciones.set(claveAsig, { credito_id: parseInt(creditoId), horas_asignadas: horas });
      _guardarAsignaciones();

      // Actualizar horas disponibles en el objeto local y en todos los selects del modal
      const creditoObj = creditos.find(c => String(c.id) === String(creditoId));
      if (creditoObj) {
        creditoObj.horas_consumidas = (parseFloat(creditoObj.horas_consumidas) || 0) + horas;
        const horasDisp = Math.max(0, parseFloat(creditoObj.cantidad_horas) - creditoObj.horas_consumidas);
        document.querySelectorAll('.select-formato').forEach(sel => {
          const opt = sel.querySelector(`option[value="${creditoId}"]`);
          if (opt) opt.textContent = `${creditoObj.consecutivo} (${horasDisp.toFixed(1)}h disp.)`;
        });
      }

      // Cambiar celda Asignar → Asignado + Quitar
      const tdAccion = tr.querySelector('td:last-child');
      tdAccion.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-asignar-fila asignado" disabled style="cursor:not-allowed;opacity:0.85;">
            <i class="fas fa-check"></i> Asignado
          </button>
          <button class="btn-quitar-fila"
                  title="Quitar asignación y devolver horas"
                  style="background:none;border:1px solid #ef4444;color:#ef4444;
                         padding:6px 10px;border-radius:6px;font-size:12px;
                         font-weight:600;cursor:pointer;white-space:nowrap;
                         transition:all 0.2s;display:flex;align-items:center;gap:4px;">
            <i class="fas fa-unlink"></i> Quitar
          </button>
        </div>`;

      tdAccion.querySelector('.btn-quitar-fila')
        .addEventListener('click', () => quitarAsignacionFila(tr, registro, creditos));

      cargarCreditosFiltrados();
      // Si el modal Sin Asignación está abierto, refrescarlo para quitar la sesión asignada
      if (elements.modalSA.classList.contains('active') &&
          elements.modalSAProfesional.value === registro.profesional_id) {
        cargarSesionesSinAsignacion();
      }
      mostrarNotificacion(data.message || 'Formato asignado correctamente', 'success');

    } catch (error) {
      console.error('❌ Error al asignar:', error);
      btnAsignar.innerHTML = '<i class="fas fa-link"></i> Asignar';
      btnAsignar.disabled  = false;
      mostrarNotificacion(error.message || 'Error al asignar formato', 'error');
    }
  }

  /**
   * Quitar asignación — devolver horas al crédito
   * Llama a PATCH /api/creditos/:id/devolver
   */
  async function quitarAsignacionFila(tr, registro, creditos) {
    if (!confirm('¿Quitar la asignación de este formato? Las horas serán devueltas al crédito.')) return;

    const btnQuitar = tr.querySelector('.btn-quitar-fila');
    if (btnQuitar) { btnQuitar.disabled = true; btnQuitar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    const creditoAnteriorId  = registro.credito_id;
    const horasADevolver     = parseFloat(registro.horas_asignadas) || parseFloat(registro.horas) || 1;

    try {
      const token    = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creditos/${creditoAnteriorId}/devolver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ horas: horasADevolver })
      });

      const data = await response.json();

      // Si el crédito no existe en BD (fue eliminado manualmente),
      // igual limpiamos la asignación local para desbloquear la UI
      if (!response.ok) {
        if (response.status === 404 || (data.message && data.message.toLowerCase().includes('no encontrado'))) {
          console.warn('⚠️ Crédito no encontrado en BD — limpiando asignación local');
          // Limpiar Map y localStorage
          const claveF = `${registro.profesional_id}_${registro.trabajador_id}_${registro.sesion_id || registro.id}`;
          _asignaciones.delete(claveF);
          _guardarAsignaciones();
          // Restaurar UI
          registro.credito_id      = null;
          registro.horas_asignadas = null;
          const tdFmtF = tr.querySelector('td:nth-last-child(2)');
          if (tdFmtF) { const sf = tdFmtF.querySelector('.select-formato'); if (sf) sf.value = ''; }
          const tdAccF = tr.querySelector('td:last-child');
          tdAccF.innerHTML = `<button class="btn-asignar-fila"><i class="fas fa-link"></i> Asignar</button>`;
          tdAccF.querySelector('.btn-asignar-fila').addEventListener('click', () => asignarCreditoFila(tr, registro, creditos));
          if (elements.modalSA?.classList.contains('active') && elements.modalSAProfesional?.value === registro.profesional_id) {
            cargarSesionesSinAsignacion();
          }
          mostrarNotificacion('Asignación eliminada localmente (el crédito ya no existe en la base de datos)', 'info');
          return;
        }
        throw new Error(data.message || 'Error al quitar asignación');
      }

      registro.credito_id      = null;
      registro.horas_asignadas = null;
      const claveQuitar = `${registro.profesional_id}_${registro.trabajador_id}_${registro.sesion_id || registro.id}`;
      _asignaciones.delete(claveQuitar);
      _guardarAsignaciones();

      // Actualizar horas disponibles en objeto local y selects
      const creditoObj = creditos.find(c => String(c.id) === String(creditoAnteriorId));
      if (creditoObj) {
        creditoObj.horas_consumidas = Math.max(0,
          (parseFloat(creditoObj.horas_consumidas) || 0) - horasADevolver
        );
        const horasDisp = parseFloat(creditoObj.cantidad_horas) - creditoObj.horas_consumidas;
        document.querySelectorAll('.select-formato').forEach(sel => {
          const opt = sel.querySelector(`option[value="${creditoAnteriorId}"]`);
          if (opt) opt.textContent = `${creditoObj.consecutivo} (${horasDisp.toFixed(1)}h disp.)`;
        });
      }

      // Restaurar select de formato y botón Asignar
      const tdFormato = tr.querySelector('td:nth-last-child(2)');
      if (tdFormato) { const sel = tdFormato.querySelector('.select-formato'); if (sel) sel.value = ''; }

      const tdAccion = tr.querySelector('td:last-child');
      tdAccion.innerHTML = `
        <button class="btn-asignar-fila">
          <i class="fas fa-link"></i> Asignar
        </button>`;
      tdAccion.querySelector('.btn-asignar-fila')
        .addEventListener('click', () => asignarCreditoFila(tr, registro, creditos));

      cargarCreditosFiltrados();
      // Si el modal Sin Asignación está abierto, refrescarlo para mostrar la sesión devuelta
      if (elements.modalSA.classList.contains('active') &&
          elements.modalSAProfesional.value === registro.profesional_id) {
        cargarSesionesSinAsignacion();
      }
      mostrarNotificacion('Horas devueltas correctamente', 'success');

    } catch (error) {
      console.error('❌ Error al quitar asignación:', error);
      if (btnQuitar) { btnQuitar.disabled = false; btnQuitar.innerHTML = '<i class="fas fa-unlink"></i> Quitar'; }
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

  // ========== MODAL SIN ASIGNACIÓN ==========

  const MESES_SA = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  async function abrirModalSinAsignacion() {
    // Resetear estado
    elements.modalSAProfesional.innerHTML = '<option value="">Seleccione un profesional</option>';
    elements.modalSALoading.style.display = 'none';
    elements.modalSAEmpty.style.display   = 'block';
    elements.modalSAEmptyMsg.textContent  = 'Seleccione un profesional para ver sus sesiones pendientes';
    elements.modalSATable.style.display   = 'none';
    elements.modalSABody2.innerHTML       = '';
    elements.modalSATotal.textContent     = '0';

    // Mostrar modal
    elements.modalSA.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar profesionales (mismo endpoint que el otro modal)
    await cargarProfesionalesSA();
  }

  /**
   * Abrir modal "Detalle de uso del crédito" desde una fila del modal SA
   * Precarga el profesional y genera las sesiones del mes/año de esa sesión
   */
  async function abrirDetalleDesdeSA(sesion, profesionalId) {
    // Cerrar modal SA
    cerrarModalSA();

    // Abrir modal Detalle
    elements.modalCreditoInfo.style.display  = 'none';
    elements.modalHeaderSubtitle.textContent = 'Selecciona el formato para cada registro y presiona Asignar';
    elements.modalLoading.style.display      = 'none';
    elements.modalEmpty.style.display        = 'block';
    document.getElementById('modalEmptyMsg').textContent = 'Generando sesiones...';
    elements.citasDetalleTable.style.display = 'none';
    elements.citasDetalleBody.innerHTML      = '';
    elements.totalCitasModal.textContent     = '0';

    // Inicializar selects de año/mes con los de la sesión
    elements.modalAnio.value = sesion.anio;
    elements.modalMes.value  = sesion.mes;

    // Llenar select de horas si está vacío
    if (!elements.modalHoras.value) elements.modalHoras.value = '1';

    // Resetear y preseleccionar profesional
    elements.btnGenerarSesiones.disabled      = false;
    elements.btnGenerarSesiones.style.opacity = '1';
    elements.btnGenerarSesiones.innerHTML     = '<i class="fas fa-bolt"></i> Generar';

    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar profesionales si el select está vacío
    if (elements.modalProfesional.options.length <= 1) {
      await cargarProfesionalesModal();
    }

    // Preseleccionar el profesional de la sesión
    elements.modalProfesional.value = profesionalId;

    // Disparar Generar automáticamente
    await generarSesiones();
  }

  function cerrarModalSA() {
    elements.modalSA.classList.remove('active');
    document.body.style.overflow = '';
  }

  async function cargarProfesionalesSA() {
    try {
      const token = localStorage.getItem('authToken');
      const res   = await fetch(`${API_URL}/api/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profesionales = data.users || [];

      elements.modalSAProfesional.innerHTML = '<option value="">Seleccione un profesional</option>';
      profesionales.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        elements.modalSAProfesional.appendChild(opt);
      });

      elements.modalSAProfesional.onchange = () => cargarSesionesSinAsignacion();

    } catch (error) {
      console.error('❌ Error al cargar profesionales SA:', error);
      mostrarNotificacion('Error al cargar profesionales', 'error');
    }
  }

  async function cargarSesionesSinAsignacion() {
    const profesionalId = elements.modalSAProfesional.value;

    elements.modalSATable.style.display   = 'none';
    elements.modalSABody2.innerHTML       = '';
    elements.modalSATotal.textContent     = '0';

    if (!profesionalId) return;

    elements.modalSALoading.style.display = 'block';
    elements.modalSAEmpty.style.display   = 'none';

    try {
      const token = localStorage.getItem('authToken');
      const res   = await fetch(
        `${API_URL}/api/consultas/sesiones-sin-asignacion?profesional_id=${profesionalId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      elements.modalSALoading.style.display = 'none';

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const sesiones = await res.json();

      if (!Array.isArray(sesiones)) {
        elements.modalSAEmpty.style.display  = 'block';
        elements.modalSAEmptyMsg.textContent = 'Error al procesar las sesiones';
        return;
      }

      // Excluir sesiones que ya tienen asignación en el Map _asignaciones
      const sesionesPendientes = sesiones.filter(s => {
        const clave = `${profesionalId}_${s.cliente_id}_${s.id}`;
        return !_asignaciones.has(clave);
      });

      if (sesionesPendientes.length === 0) {
        elements.modalSAEmpty.style.display  = 'block';
        elements.modalSAEmptyMsg.textContent =
          '¡Este profesional no tiene sesiones pendientes de asignación!';
        return;
      }

      // Agrupar por mes para mostrar separadores
      let mesActual = null;
      sesionesPendientes.forEach(s => {
        const mesSesion = `${s.anio}-${s.mes}`;

        // Fila separadora de mes si cambia
        if (mesSesion !== mesActual) {
          mesActual = mesSesion;
          const trMes = document.createElement('tr');
          trMes.innerHTML = `
            <td colspan="4"
                style="background:#f5f3ff;color:#4c1d95;font-weight:700;
                       font-size:12px;padding:8px 12px;letter-spacing:0.5px;
                       text-transform:uppercase;border-top:2px solid #e5e7eb;">
              <i class="fas fa-calendar-alt" style="margin-right:6px;"></i>
              ${MESES_SA[s.mes]} ${s.anio}
            </td>`;
          elements.modalSABody2.appendChild(trMes);
        }

        // Fila de sesión
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f3f4f6';
        tr.innerHTML = `
          <td style="padding:10px 12px;color:#6b7280;font-size:12px;width:100px;">
            ${MESES_SA[s.mes]}
          </td>
          <td style="padding:10px 12px;font-weight:500;color:#374151;">
            <i class="fas fa-user" style="color:#9ca3af;margin-right:6px;font-size:11px;"></i>
            ${s.trabajador_nombre}
          </td>
          <td style="padding:10px 12px;font-weight:600;color:#374151;">
            ${formatearFecha(s.fecha)}
          </td>
          <td style="padding:10px 12px;text-align:center;">
            <button class="btn-ir-detalle"
                    title="Abrir en Detalle de uso del crédito"
                    style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                           color:#fff;border:none;width:32px;height:32px;border-radius:50%;
                           cursor:pointer;font-size:14px;display:inline-flex;
                           align-items:center;justify-content:center;
                           transition:opacity 0.2s;flex-shrink:0;">
              <i class="fas fa-arrow-right"></i>
            </button>
          </td>`;
        // Listener del botón flecha
        tr.querySelector('.btn-ir-detalle').addEventListener('click', () => {
          abrirDetalleDesdeSA(s, profesionalId);
        });
        elements.modalSABody2.appendChild(tr);
      });

      elements.modalSATable.style.display = 'table';
      elements.modalSATotal.textContent   = sesionesPendientes.length;

    } catch (error) {
      console.error('❌ Error al cargar sesiones sin asignación:', error);
      elements.modalSALoading.style.display = 'none';
      elements.modalSAEmpty.style.display   = 'block';
      elements.modalSAEmptyMsg.textContent  = 'Error al cargar las sesiones';
      mostrarNotificacion('Error al cargar sesiones', 'error');
    }
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