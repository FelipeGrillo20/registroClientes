// frontend/js/agendamiento.js
// Módulo de Agendamiento de Citas

(function() {
  'use strict';

  // ========== VARIABLES GLOBALES ==========
  let calendar;
  let citaSeleccionada = null;
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';
  const modalidadPrograma = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';
  
  // ✅ NUEVO: Obtener usuario actual y su rol
  const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
  const userRol = currentUser.rol || '';
  const userId = currentUser.id;
  const isProfesional = userRol === 'profesional';
  
  console.log('👤 Usuario actual:', currentUser.nombre, '- Rol:', userRol, '- ID:', userId);

  // Elementos del DOM
  const elements = {
    // Modales
    modalCita: document.getElementById('modalCita'),
    modalDetalle: document.getElementById('modalDetalle'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Formulario
    formCita: document.getElementById('formCita'),
    citaId: document.getElementById('citaId'),
    trabajadorId: document.getElementById('trabajadorId'),       // input hidden
    profesionalId: document.getElementById('profesionalId'),
    fecha: document.getElementById('fecha'),
    horaInicio: document.getElementById('horaInicio'),
    horaFin: document.getElementById('horaFin'),
    modalidadCita: document.getElementById('modalidadCita'),
    estado: document.getElementById('estado'),
    observacionesInternas: document.getElementById('observacionesInternas'),
    observacionesInforme: document.getElementById('observacionesInforme'),

    // Buscador de trabajador
    trabWrapper: document.getElementById('trabWrapper'),
    trabDisplay: document.getElementById('trabDisplay'),
    trabDisplayText: document.getElementById('trabDisplayText'),
    trabDropdown: document.getElementById('trabDropdown'),
    trabBuscador: document.getElementById('trabBuscador'),
    trabClearBtn: document.getElementById('trabClearBtn'),
    trabOptions: document.getElementById('trabOptions'),
    
    // Filtros
    filtroProfesional: document.getElementById('filtroProfesional'),
    filtroEstado: document.getElementById('filtroEstado'),
    
    // Botones
    btnNuevaCita: document.getElementById('btnNuevaCita'),
    btnVolver: document.getElementById('btnVolver'),
    btnCerrarModal: document.getElementById('btnCerrarModal'),
    btnCancelar: document.getElementById('btnCancelar'),
    btnGuardarCita: document.getElementById('btnGuardarCita'),
    btnCerrarDetalle: document.getElementById('btnCerrarDetalle'),
    btnCerrarDetalleBtn: document.getElementById('btnCerrarDetalleBtn'),
    btnEditarCita: document.getElementById('btnEditarCita'),
    btnEliminarCita: document.getElementById('btnEliminarCita'),
    
    // Botones de acciones calendario (solo admin)
    calendarActions: document.getElementById('calendarActions'),
    btnInformeAgendamiento: document.getElementById('btnInformeAgendamiento'),
    btnAsignacionCreditos: document.getElementById('btnAsignacionCreditos'),
    
    // Estadísticas
    statConfirmadas: document.getElementById('statConfirmadas'),
    statProgramadas: document.getElementById('statProgramadas'),
    statRealizadas: document.getElementById('statRealizadas'),
    statCanceladas: document.getElementById('statCanceladas'),
    
    // Detalle
    detalleContent: document.getElementById('detalleContent'),
    modalTitle: document.getElementById('modalTitle'),
  };

  // ========== INICIALIZACIÓN ==========
  function init() {
    console.log('🚀 Inicializando módulo de agendamiento...');
    console.log('📋 Modalidad:', modalidadPrograma);
    console.log('👤 Rol:', userRol, '- Profesional?', isProfesional);
    
    initCalendar();
    configurarFormularioSegunRol();  // ✅ NUEVO: Configurar según rol
    loadProfesionales();
    loadTrabajadores();
    attachEventListeners();
    loadEstadisticas();
  }

  // ✅ NUEVO: Configurar formulario según el rol del usuario
  function configurarFormularioSegunRol() {
    if (isProfesional) {
      console.log('🔒 [ROL] Usuario es profesional, ocultando selector y auto-asignando');
      
      // Ocultar el grupo de profesional (label + select)
      const profesionalGroup = elements.profesionalId.closest('.form-group');
      if (profesionalGroup) {
        profesionalGroup.style.display = 'none';
      }
      
      // ✅ CRÍTICO: Remover required del campo oculto para que el form se pueda enviar
      elements.profesionalId.removeAttribute('required');
      
      // Pre-seleccionar al profesional actual
      elements.profesionalId.value = userId;
      
      // Aplicar filtro automático en el calendario
      elements.filtroProfesional.value = userId;
      elements.filtroProfesional.disabled = true;
      
      // ✅ Ocultar botones de acción (solo admin)
      if (elements.calendarActions) {
        elements.calendarActions.style.display = 'none';
      }
      
      console.log('✅ [ROL] Profesional auto-asignado:', userId);
    } else {
      console.log('👨‍💼 [ROL] Usuario es administrador, mostrando todas las opciones');
      // Para admin, asegurar que tenga el required
      elements.profesionalId.setAttribute('required', 'required');
      
      // ✅ Asegurar que los botones de acción estén visibles
      if (elements.calendarActions) {
        elements.calendarActions.style.display = 'flex';
      }
    }
  }

  // ========== FULLCALENDAR ==========
  function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'es',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
      },
      buttonText: {
        today: 'Hoy',
        month: 'Mes',
        week: 'Semana',
        day: 'Día',
        list: 'Lista'
      },
      // ✅ NUEVO: Ocultar días de otros meses
      fixedWeekCount: false,        // No forzar 6 semanas siempre
      showNonCurrentDates: false,   // Ocultar fechas fuera del mes actual
      slotMinTime: '06:00:00',
      slotMaxTime: '19:00:00',
      slotDuration: '00:30:00',
      allDaySlot: false,
      height: 750,  // ✅ Altura fija suficiente para mostrar todas las casillas completas
      expandRows: true,
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        meridiem: false
      },
      events: function(info, successCallback, failureCallback) {
        loadCitasCalendario(info.start, info.end, successCallback, failureCallback);
      },
      eventClick: function(info) {
        mostrarDetalleCita(info.event.id);
      },
      dateClick: function(info) {
        // ✅ Al hacer clic en una fecha del calendario, abrir modal con esa fecha
        abrirModalNuevaCita(info.dateStr);
      },
      eventDidMount: function(info) {
        console.log('🎨 [RENDER] Renderizando evento:', info.event.title);
        // Tooltip con información adicional
        const tooltip = `
          <strong>${info.event.title}</strong><br>
          ${info.event.extendedProps.profesional_nombre}<br>
          ${info.event.extendedProps.modalidad_cita}<br>
          Estado: ${info.event.extendedProps.estado}
        `;
        info.el.setAttribute('title', tooltip);
      },
      eventContent: function(info) {
        const vista       = info.view.type;
        const props       = info.event.extendedProps;
        const modalidad   = props.modalidad_cita;
        const icono       = modalidad === 'presencial' ? '🏢' : '💻';
        const trabajador  = props.trabajador_nombre  || '';
        const profesional = props.profesional_nombre || '';

        // Solo personalizar en vista Lista — las demás vistas usan el render nativo de FullCalendar
        if (vista === 'listWeek' || vista === 'listDay' || vista === 'listMonth') {
          return {
            html: `<span style="font-size:13px;color:#374151;">
                     ${icono} ${trabajador}
                     <span style="color:#6b7280;margin-left:8px;">· ${profesional}</span>
                   </span>`
          };
        }

        // Mes / Semana / Día: render nativo (sin eventContent personalizado)
        return true;
      }
    });
    
    calendar.render();
    console.log('✅ Calendario inicializado');
  }

  // ========== CARGAR DATOS ==========
  async function loadCitasCalendario(start, end, successCallback, failureCallback) {
    try {
      console.log('📅 [CALENDARIO] Cargando eventos...');
      console.log('📅 [CALENDARIO] Rango:', start.toISOString().split('T')[0], 'a', end.toISOString().split('T')[0]);
      
      // ✅ MODIFICADO: Si es profesional, forzar su ID. Si es admin, usar el filtro seleccionado
      let profesionalId;
      if (isProfesional) {
        profesionalId = userId;  // Forzar ID del profesional logueado
        console.log('🔒 [CALENDARIO] Usuario profesional, filtrando solo sus citas:', profesionalId);
      } else {
        profesionalId = elements.filtroProfesional.value;  // Admin puede filtrar o ver todos
      }
      
      const estadoSeleccionado = elements.filtroEstado.value;
      
      const params = new URLSearchParams({
        fecha_inicio: start.toISOString().split('T')[0],
        fecha_fin: end.toISOString().split('T')[0],
        modalidad_programa: modalidadPrograma
      });
      
      if (profesionalId) {
        params.append('profesional_id', profesionalId);
      }
      
      // ✅ NUEVO: Agregar filtro de estado si no es "Todos"
      if (estadoSeleccionado && estadoSeleccionado !== '') {
        params.append('estado', estadoSeleccionado);
        console.log('🔍 [CALENDARIO] Filtro de estado:', estadoSeleccionado);
      }
      
      const token = window.getAuthToken();
      const url = `${API_URL}/api/citas/calendario?${params}`;
      console.log('📡 [CALENDARIO] URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📥 [CALENDARIO] Respuesta HTTP:', response.status, response.statusText);
      
      if (!response.ok) throw new Error('Error al cargar citas');
      
      const data = await response.json();
      console.log('📦 [CALENDARIO] Datos recibidos:', data);
      console.log('📊 [CALENDARIO] Total eventos:', data.data ? data.data.length : 0);
      
      if (data.data && data.data.length > 0) {
        console.log('🎨 [CALENDARIO] Primer evento:', data.data[0]);
        console.log('🎨 [CALENDARIO] Enviando a FullCalendar...');
      }
      
      successCallback(data.data);
      console.log('✅ [CALENDARIO] Eventos enviados a FullCalendar');
      
    } catch (error) {
      console.error('❌ [CALENDARIO] Error:', error);
      failureCallback(error);
      mostrarNotificacion('Error al cargar citas', 'error');
    }
  }

  async function loadProfesionales() {
    // ✅ Profesional: NO llamar a /api/auth/users (403 Forbidden para este rol)
    // Configurar todo desde los datos del usuario en localStorage
    if (isProfesional) {
      console.log('🔒 [ROL] Profesional - configurando sin llamada API');

      // Select del formulario (oculto, solo necesita tener el valor)
      elements.profesionalId.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = userId;
      opt.textContent = currentUser.nombre || '';
      opt.selected = true;
      elements.profesionalId.appendChild(opt);

      // Filtro del sidebar: asignar valor y ocultar
      elements.filtroProfesional.innerHTML = '';
      const optF = document.createElement('option');
      optF.value = userId;
      optF.textContent = currentUser.nombre || '';
      optF.selected = true;
      elements.filtroProfesional.appendChild(optF);
      elements.filtroProfesional.value = userId;
      elements.filtroProfesional.disabled = true;
      const filtroGroup = elements.filtroProfesional.closest('.filtro-item');
      if (filtroGroup) filtroGroup.style.display = 'none';

      console.log('✅ [ROL] Profesional configurado desde localStorage — ID:', userId, 'Nombre:', currentUser.nombre);
      return; // ← Sale aquí, sin tocar la API
    }

    // ✅ Solo admin llega aquí
    try {
      const token = window.getAuthToken();
      const response = await fetch(`${API_URL}/api/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar profesionales');

      const data = await response.json();
      const profesionales = data.users || [];

      // Llenar select del formulario
      elements.profesionalId.innerHTML = '<option value="">Seleccione un profesional</option>';
      profesionales.forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.id;
        option.textContent = prof.nombre;
        elements.profesionalId.appendChild(option);
      });

      // Llenar filtro del sidebar
      elements.filtroProfesional.innerHTML = '<option value="">Todos los profesionales</option>';
      profesionales.forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.id;
        option.textContent = prof.nombre;
        elements.filtroProfesional.appendChild(option);
      });

      console.log('✅ Profesionales cargados:', profesionales.length);

    } catch (error) {
      console.error('Error al cargar profesionales:', error);
      mostrarNotificacion('Error al cargar lista de profesionales', 'error');
    }
  }

  // ========== BUSCADOR DE TRABAJADOR ==========
  let _listaTrabajadores = [];

  function _trabAbrirDropdown() {
    if (elements.trabDisplay.classList.contains('disabled')) return;
    elements.trabDisplay.classList.add('open');
    elements.trabDropdown.classList.add('open');
    elements.trabBuscador.value = '';
    _trabRenderOpciones(_listaTrabajadores, '');
    elements.trabBuscador.focus();
  }

  function _trabCerrarDropdown() {
    elements.trabDisplay.classList.remove('open');
    elements.trabDropdown.classList.remove('open');
  }

  function _trabToggle() {
    elements.trabDropdown.classList.contains('open') ? _trabCerrarDropdown() : _trabAbrirDropdown();
  }

  function _trabRenderOpciones(lista, query) {
    elements.trabOptions.innerHTML = '';
    if (lista.length === 0) {
      const div = document.createElement('div');
      div.className = 'trab-option no-results';
      div.textContent = query ? 'Sin resultados' : 'Sin trabajadores disponibles';
      elements.trabOptions.appendChild(div);
      return;
    }
    const selectedId = String(elements.trabajadorId.value);
    lista.forEach(trab => {
      const div = document.createElement('div');
      div.className = 'trab-option' + (String(trab.id) === selectedId ? ' selected' : '');
      if (query) {
        const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        div.innerHTML = trab.nombre.replace(re, '<mark>$1</mark>');
      } else {
        div.textContent = trab.nombre;
      }
      div.addEventListener('click', () => _trabSeleccionar(trab));
      elements.trabOptions.appendChild(div);
    });
  }

  function _trabSeleccionar(trab) {
    elements.trabajadorId.value = trab.id;
    elements.trabDisplayText.textContent = trab.nombre;
    elements.trabDisplayText.classList.remove('placeholder');
    _trabCerrarDropdown();
    console.log('✅ [BUSCADOR] Trabajador seleccionado:', trab.nombre, 'ID:', trab.id);
  }

  function _trabReset(placeholder = 'Seleccione un trabajador') {
    // Solo limpia la selección visual, NO borra _listaTrabajadores
    elements.trabajadorId.value = '';
    elements.trabDisplayText.textContent = placeholder;
    elements.trabDisplayText.classList.add('placeholder');
    _trabCerrarDropdown();
  }

  function _trabDeshabilitar(placeholder = 'Primero seleccione un profesional') {
    _listaTrabajadores = [];          // Admin: limpiar lista al cambiar profesional
    elements.trabOptions.innerHTML = '';
    _trabReset(placeholder);
    elements.trabDisplay.classList.add('disabled');
  }

  function _trabHabilitar() {
    elements.trabDisplay.classList.remove('disabled');
  }

  function _trabCargarLista(trabajadores) {
    _listaTrabajadores = trabajadores;
    _trabHabilitar();
    _trabRenderOpciones(trabajadores, '');
    console.log('✅ [BUSCADOR] Lista cargada:', trabajadores.length, 'trabajadores');
  }

  function _trabIniciarListeners() {
    elements.trabDisplay.addEventListener('click', _trabToggle);
    elements.trabDisplay.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _trabToggle(); }
    });
    elements.trabBuscador.addEventListener('input', () => {
      const q = elements.trabBuscador.value.toLowerCase().trim();
      const filtrados = q ? _listaTrabajadores.filter(t => t.nombre.toLowerCase().includes(q)) : _listaTrabajadores;
      _trabRenderOpciones(filtrados, q);
    });
    elements.trabClearBtn.addEventListener('click', () => {
      elements.trabBuscador.value = '';
      _trabRenderOpciones(_listaTrabajadores, '');
      elements.trabBuscador.focus();
    });
    document.addEventListener('click', e => {
      if (!elements.trabWrapper.contains(e.target)) _trabCerrarDropdown();
    });
  }

  // ========== CARGA DE TRABAJADORES ==========
  async function loadTrabajadores() {
    try {
      const token = window.getAuthToken();
      let url = `${API_URL}/api/clients?modalidad=${encodeURIComponent(modalidadPrograma)}`;

      if (isProfesional) {
        url += `&profesional_id=${userId}`;
        console.log('🔒 [ROL] Filtrando trabajadores del profesional:', userId);
      }

      console.log('📡 loadTrabajadores:', url);
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) throw new Error('Error al cargar trabajadores');

      const trabajadores = await response.json();
      if (!Array.isArray(trabajadores)) throw new Error('Formato de respuesta inválido');

      console.log('📦 Trabajadores recibidos:', trabajadores.length);
      _trabCargarLista(trabajadores);

    } catch (error) {
      console.error('❌ Error al cargar trabajadores:', error);
      mostrarNotificacion('Error al cargar lista de trabajadores', 'error');
    }
  }

  // Cascada profesional → trabajadores (solo admin)
  async function cargarTrabajadoresPorProfesional() {
    const profesionalId = elements.profesionalId.value;

    if (!profesionalId) {
      _trabDeshabilitar('Primero seleccione un profesional');
      return;
    }

    try {
      const token = window.getAuthToken();
      const url = `${API_URL}/api/clients?modalidad=${encodeURIComponent(modalidadPrograma)}&profesional_id=${profesionalId}`;
      console.log('📡 [CASCADA] Petición a:', url);

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Error al cargar trabajadores del profesional');

      const trabajadores = await response.json();
      console.log('✅ [CASCADA] Trabajadores:', trabajadores.length);
      _trabCargarLista(trabajadores);

    } catch (error) {
      console.error('❌ [CASCADA] Error:', error);
      _trabCargarLista([]);
    }
  }

  async function loadEstadisticas() {
    try {
      const token = window.getAuthToken();
      const now = new Date();
      const primerDia = new Date(now.getFullYear(), now.getMonth(), 1);
      const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const params = new URLSearchParams({
        fecha_inicio: primerDia.toISOString().split('T')[0],
        fecha_fin: ultimoDia.toISOString().split('T')[0],
        modalidad_programa: modalidadPrograma
      });
      
      // ✅ MODIFICADO: Si es profesional, filtrar solo sus estadísticas
      if (isProfesional) {
        params.append('profesional_id', userId);
        console.log('🔒 [ESTADÍSTICAS] Filtrando por profesional:', userId);
      }
      
      const response = await fetch(`${API_URL}/api/citas/estadisticas?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      
      const data = await response.json();
      const stats = data.data;
      
      elements.statConfirmadas.textContent = stats.confirmadas || 0;
      elements.statProgramadas.textContent = stats.programadas || 0;
      elements.statRealizadas.textContent  = stats.realizadas  || 0;
      elements.statCanceladas.textContent  = stats.canceladas  || 0;

      // Actualizar "No asistió" si el elemento existe en el DOM
      const statNoAsistio = document.getElementById('statNoAsistio');
      if (statNoAsistio) statNoAsistio.textContent = stats.no_asistio || 0;

      console.log('✅ Estadísticas actualizadas:', stats);
      
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  // ========== EVENT LISTENERS ==========
  function attachEventListeners() {
    // Botones principales
    elements.btnNuevaCita.addEventListener('click', abrirModalNuevaCita);
    elements.btnVolver.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    
    // Modal cita
    elements.btnCerrarModal.addEventListener('click', cerrarModalCita);
    elements.btnCancelar.addEventListener('click', cerrarModalCita);
    elements.formCita.addEventListener('submit', guardarCita);
    
    // Modal detalle
    elements.btnCerrarDetalle.addEventListener('click', cerrarModalDetalle);
    elements.btnCerrarDetalleBtn.addEventListener('click', cerrarModalDetalle);
    elements.btnEditarCita.addEventListener('click', editarCitaDesdeDetalle);
    elements.btnEliminarCita.addEventListener('click', eliminarCitaDesdeDetalle);
    
    // Filtros
    elements.filtroProfesional.addEventListener('change', () => {
      calendar.refetchEvents();
      loadEstadisticas();
    });
    elements.filtroEstado.addEventListener('change', () => calendar.refetchEvents());

    // ✅ Botones de leyenda — filtran el calendario por estado
    document.querySelectorAll('.legend-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        // Marcar activo
        document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Sincronizar con el select oculto y refrescar calendario
        const estado = this.dataset.estado;
        elements.filtroEstado.value = estado;
        calendar.refetchEvents();
      });
    });
    
    // ✅ Botones de acción (solo admin)
    if (elements.btnInformeAgendamiento) {
      elements.btnInformeAgendamiento.addEventListener('click', () => {
        console.log('📊 Informe Agendamiento - Función pendiente');
        mostrarNotificacion('Función en desarrollo', 'info');
      });
    }
    if (elements.btnAsignacionCreditos) {
      elements.btnAsignacionCreditos.addEventListener('click', () => {
        console.log('💰 Redirigiendo a Asignación de Créditos...');
        window.location.href = 'creditos.html';
      });
    }
    
    // ✅ NUEVO: Listener para cascada Profesional → Trabajadores (solo para admin)
    if (!isProfesional) {
      elements.profesionalId.addEventListener('change', cargarTrabajadoresPorProfesional);
    }
    
    // ✅ NUEVO: Actualizar hora fin automáticamente cuando cambie hora inicio
    elements.horaInicio.addEventListener('change', function() {
      if (this.value) {
        const [horas, minutos] = this.value.split(':');
        const horaInicioNum = parseInt(horas);
        const horaFinNum = horaInicioNum + 1;
        elements.horaFin.value = `${horaFinNum.toString().padStart(2, '0')}:${minutos}`;
        console.log('🕐 Hora inicio cambiada a:', this.value);
        console.log('🕑 Hora fin actualizada a:', elements.horaFin.value);
      }
    });
    
    // Cerrar modales al hacer clic fuera
    elements.modalCita.addEventListener('click', (e) => {
      if (e.target === elements.modalCita) cerrarModalCita();
    });
    elements.modalDetalle.addEventListener('click', (e) => {
      if (e.target === elements.modalDetalle) cerrarModalDetalle();
    });

    // Iniciar listeners del buscador de trabajador
    _trabIniciarListeners();
  }

  // ========== FUNCIONES DE MODAL ==========
  function abrirModalNuevaCita(fechaPreseleccionada = null) {
    citaSeleccionada = null;
    elements.modalTitle.innerHTML = '<i class="fas fa-calendar-plus"></i> Nueva Cita';
    elements.formCita.reset();
    elements.citaId.value = '';
    
    // Para admin, deshabilitar buscador hasta seleccionar profesional
    if (!isProfesional) {
      _trabDeshabilitar('Primero seleccione un profesional');
      console.log('🔒 [CASCADA] Buscador de trabajador deshabilitado');
    } else {
      // Para profesionales: limpiar selección, habilitar y recargar su lista
      _trabReset('Seleccione un trabajador');
      _trabHabilitar();
      elements.profesionalId.value = userId;
      console.log('✅ [ROL] Profesional re-asignado en modal:', userId);
      // Recargar lista fresca del servidor
      loadTrabajadores();
    }
    
    // ✅ OPCIÓN 1: Si se pasa una fecha preseleccionada (clic en calendario), usar esa
    // ✅ OPCIÓN 2: Si no, usar la fecha de hoy
    const hoy = new Date();
    const fechaAUsar = fechaPreseleccionada || hoy.toISOString().split('T')[0];
    
    // Establecer fecha mínima (hoy)
    elements.fecha.setAttribute('min', hoy.toISOString().split('T')[0]);
    
    // ✅ Establecer la fecha en el campo
    elements.fecha.value = fechaAUsar;
    
    // ✅ Calcular hora de inicio (hora actual en punto)
    const horaActual = hoy.getHours();
    const horaInicio = `${horaActual.toString().padStart(2, '0')}:00`;
    
    // ✅ Calcular hora de fin (1 hora después)
    const horaFin = `${(horaActual + 1).toString().padStart(2, '0')}:00`;
    
    // ✅ Establecer las horas en los campos
    elements.horaInicio.value = horaInicio;
    elements.horaFin.value = horaFin;
    
    // ✅ Cambio 3: Valor por defecto de Modalidad = Virtual
    elements.modalidadCita.value = 'virtual';
    
    console.log('📅 Nueva cita - Fecha:', fechaAUsar);
    console.log('🕐 Hora inicio:', horaInicio);
    console.log('🕑 Hora fin:', horaFin);
    
    elements.modalCita.classList.add('active');
  }

  function cerrarModalCita() {
    elements.modalCita.classList.remove('active');
    citaSeleccionada = null;
  }

  function cerrarModalDetalle() {
    elements.modalDetalle.classList.remove('active');
  }

  // ========== CRUD DE CITAS ==========
  async function guardarCita(e) {
    e.preventDefault();
    
    console.log('💾 [guardarCita] Iniciando...');
    console.log('👤 [guardarCita] Usuario:', currentUser.nombre, '- Rol:', userRol, '- ID:', userId);
    console.log('📋 [guardarCita] profesionalId value:', elements.profesionalId.value);
    
    // ✅ Para profesionales, usar directamente userId; para admin, leer del campo
    const profesionalIdValue = isProfesional ? userId : parseInt(elements.profesionalId.value);
    
    const citaData = {
      trabajador_id: parseInt(elements.trabajadorId.value),
      profesional_id: profesionalIdValue,
      fecha: elements.fecha.value,
      hora_inicio: elements.horaInicio.value,
      hora_fin: elements.horaFin.value,
      modalidad_cita: elements.modalidadCita.value,
      estado: elements.estado.value,
      // observaciones_internas: elements.observacionesInternas.value, // ⚠️ COMENTADO (campo oculto)
      observaciones_internas: null,  // ✅ Enviar como null
      observaciones_informe: elements.observacionesInforme.value,
      modalidad_programa: modalidadPrograma
    };
    
    console.log('📤 [guardarCita] Datos a enviar:', citaData);
    
    // Validar que hora fin sea mayor que hora inicio
    if (citaData.hora_fin <= citaData.hora_inicio) {
      mostrarNotificacion('La hora de fin debe ser posterior a la hora de inicio', 'error');
      return;
    }
    
    // Validar campos obligatorios
    if (!citaData.trabajador_id || isNaN(citaData.profesional_id)) {
      console.error('❌ [guardarCita] Faltan datos obligatorios');
      console.error('trabajador_id:', citaData.trabajador_id);
      console.error('profesional_id:', citaData.profesional_id);
      mostrarNotificacion('Por favor complete todos los campos obligatorios', 'error');
      return;
    }
    
    try {
      mostrarLoading(true);
      const token = window.getAuthToken();
      const citaId = elements.citaId.value;
      const method = citaId ? 'PUT' : 'POST';
      const url = citaId ? `${API_URL}/api/citas/${citaId}` : `${API_URL}/api/citas`;
      
      console.log('📡 [guardarCita] URL:', url);
      console.log('📡 [guardarCita] Method:', method);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(citaData)
      });
      
      console.log('📥 [guardarCita] Response status:', response.status);
      
      const data = await response.json();
      console.log('📥 [guardarCita] Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al guardar la cita');
      }
      
      mostrarNotificacion(data.message || 'Cita guardada exitosamente', 'success');
      cerrarModalCita();
      calendar.refetchEvents();
      loadEstadisticas();
      
    } catch (error) {
      console.error('❌ [guardarCita] Error:', error);
      mostrarNotificacion(error.message, 'error');
    } finally {
      mostrarLoading(false);
    }
  }

  async function mostrarDetalleCita(citaId) {
    try {
      mostrarLoading(true);
      const token = window.getAuthToken();
      const response = await fetch(`${API_URL}/api/citas/${citaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar detalle de la cita');
      
      const data = await response.json();
      const cita = data.data;
      citaSeleccionada = cita;
      
      // Renderizar detalle
      elements.detalleContent.innerHTML = `
        <div class="detalle-grid">
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-user"></i> Trabajador:
            </div>
            <div class="detalle-value">
              ${cita.trabajador_nombre} - ${cita.trabajador_cedula}
            </div>
          </div>
          
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-user-md"></i> Profesional:
            </div>
            <div class="detalle-value">${cita.profesional_nombre}</div>
          </div>
          
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-calendar-alt"></i> Fecha:
            </div>
            <div class="detalle-value">${formatearFecha(cita.fecha)}</div>
          </div>
          
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-clock"></i> Horario:
            </div>
            <div class="detalle-value">${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}</div>
          </div>
          
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-laptop-house"></i> Modalidad:
            </div>
            <div class="detalle-value">${cita.modalidad_cita === 'presencial' ? 'Presencial' : 'Virtual'}</div>
          </div>
          
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-info-circle"></i> Estado:
            </div>
            <div class="detalle-value">
              <span class="badge-estado badge-${cita.estado}">${formatearEstado(cita.estado)}</span>
            </div>
          </div>
          
          ${cita.observaciones_internas ? `
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-sticky-note"></i> Obs. Internas:
            </div>
            <div class="detalle-value">${cita.observaciones_internas}</div>
          </div>
          ` : ''}
          
          ${cita.observaciones_informe ? `
          <div class="detalle-item">
            <div class="detalle-label">
              <i class="fas fa-file-alt"></i> Obs. Informe:
            </div>
            <div class="detalle-value">${cita.observaciones_informe}</div>
          </div>
          ` : ''}
        </div>
      `;
      
      elements.modalDetalle.classList.add('active');
      
    } catch (error) {
      console.error('Error al mostrar detalle:', error);
      mostrarNotificacion('Error al cargar el detalle de la cita', 'error');
    } finally {
      mostrarLoading(false);
    }
  }

  function editarCitaDesdeDetalle() {
    if (!citaSeleccionada) return;
    
    cerrarModalDetalle();
    
    // ✅ Convertir fecha a formato YYYY-MM-DD para el input
    let fechaFormateada;
    if (citaSeleccionada.fecha instanceof Date) {
      // Si es objeto Date, convertir a ISO y tomar solo la parte de la fecha
      fechaFormateada = citaSeleccionada.fecha.toISOString().split('T')[0];
    } else if (typeof citaSeleccionada.fecha === 'string') {
      // Si es string, limpiar y tomar solo YYYY-MM-DD
      fechaFormateada = citaSeleccionada.fecha.split('T')[0];
    } else {
      fechaFormateada = '';
    }
    
    // Llenar formulario con datos de la cita
    elements.citaId.value = citaSeleccionada.id;
    
    // ✅ Asignar trabajador en el buscador
    const trabExistente = _listaTrabajadores.find(t => String(t.id) === String(citaSeleccionada.trabajador_id));
    if (trabExistente) {
      _trabSeleccionar(trabExistente);
    } else {
      // Si no está en la lista cargada, asignar directamente ID y nombre desde la cita
      elements.trabajadorId.value = citaSeleccionada.trabajador_id;
      elements.trabDisplayText.textContent = citaSeleccionada.trabajador_nombre || `Trabajador #${citaSeleccionada.trabajador_id}`;
      elements.trabDisplayText.classList.remove('placeholder');
    }
    
    elements.profesionalId.value = citaSeleccionada.profesional_id;
    elements.fecha.value = fechaFormateada;  // ✅ Usar fecha formateada
    elements.horaInicio.value = citaSeleccionada.hora_inicio;
    elements.horaFin.value = citaSeleccionada.hora_fin;
    elements.modalidadCita.value = citaSeleccionada.modalidad_cita;
    elements.estado.value = citaSeleccionada.estado;
    // elements.observacionesInternas.value = citaSeleccionada.observaciones_internas || '';  // ⚠️ COMENTADO (campo oculto)
    elements.observacionesInforme.value = citaSeleccionada.observaciones_informe || '';
    
    elements.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Cita';
    elements.modalCita.classList.add('active');
  }

  async function eliminarCitaDesdeDetalle() {
    if (!citaSeleccionada) return;
    
    if (!confirm('¿Está seguro de que desea eliminar esta cita?')) {
      return;
    }
    
    try {
      mostrarLoading(true);
      const token = window.getAuthToken();
      const response = await fetch(`${API_URL}/api/citas/${citaSeleccionada.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al eliminar la cita');
      
      mostrarNotificacion('Cita eliminada exitosamente', 'success');
      cerrarModalDetalle();
      calendar.refetchEvents();
      loadEstadisticas();
      
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      mostrarNotificacion('Error al eliminar la cita', 'error');
    } finally {
      mostrarLoading(false);
    }
  }

  // ========== UTILIDADES ==========
  function mostrarLoading(show) {
    if (show) {
      elements.loadingOverlay.classList.add('active');
    } else {
      elements.loadingOverlay.classList.remove('active');
    }
  }

  function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear notificación personalizada
    const notif = document.createElement('div');
    notif.className = `notificacion notificacion-${tipo}`;
    notif.innerHTML = `
      <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${mensaje}</span>
    `;
    
    notif.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${tipo === 'success' ? '#28A745' : tipo === 'error' ? '#DC3545' : '#17A2B8'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      animation: slideInRight 0.3s;
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
      notif.style.animation = 'slideOutRight 0.3s';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  function formatearFecha(fecha) {
    // Construir la fecha por partes para evitar conversión de zona horaria.
    // new Date('YYYY-MM-DD') o new Date('YYYY-MM-DDT00:00:00') son ambiguas
    // respecto a UTC vs local y producen desfase en servidores fuera de Colombia.
    let anio, mes, dia;

    if (fecha instanceof Date) {
      // Objeto Date: leer partes locales directamente
      anio = fecha.getFullYear();
      mes  = fecha.getMonth() + 1;
      dia  = fecha.getDate();
    } else if (typeof fecha === 'string') {
      // Tomar solo la parte de fecha (antes de 'T') y separar por '-'
      const soloFecha = fecha.split('T')[0];
      const partes    = soloFecha.split('-').map(Number);
      if (partes.length < 3 || partes.some(isNaN)) return 'Fecha inválida';
      [anio, mes, dia] = partes;
    } else {
      return 'Fecha inválida';
    }

    // Construir con hora 12:00 local para evitar cualquier desfase por DST
    const f = new Date(anio, mes - 1, dia, 12, 0, 0);

    if (isNaN(f.getTime())) return 'Fecha inválida';

    return f.toLocaleDateString('es-CO', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric'
    });
  }

  // ✅ NUEVA: Función para formatear hora con AM/PM
  function formatearHora(hora) {
    if (!hora) return '';
    
    const [horas, minutos] = hora.split(':');
    let h = parseInt(horas);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // Convertir 0 a 12
    
    return `${h}:${minutos} ${ampm}`;
  }

  function formatearEstado(estado) {
    const estados = {
      'programada': 'Programada',
      'confirmada': 'Confirmada',
      'realizada': 'Realizada',
      'cancelada': 'Cancelada',
      'no_asistio': 'No asistió'
    };
    return estados[estado] || estado;
  }

  // ========== ANIMACIONES CSS ==========
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes slideOutRight {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100px);
      }
    }
  `;
  document.head.appendChild(style);

  // ========== AUTO-ACTUALIZACIÓN DEL CALENDARIO ==========
  /**
   * Sistema de auto-actualización para reflejar cambios de estado
   * (confirmada/cancelada) sin necesidad de recargar la página
   */
  let autoRefreshInterval = null;
  let lastRefreshTime = Date.now();
  
  function startAutoRefresh() {
    // Actualizar cada 30 segundos
    const REFRESH_INTERVAL = 30000; // 30 segundos
    
    autoRefreshInterval = setInterval(() => {
      if (calendar) {
        console.log('🔄 Auto-actualizando calendario y estadísticas...');
        calendar.refetchEvents();
        loadEstadisticas();
        lastRefreshTime = Date.now();
      }
    }, REFRESH_INTERVAL);
    
    console.log('✅ Auto-actualización del calendario activada (cada 30 seg)');
  }
  
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      console.log('⏸️ Auto-actualización del calendario pausada');
    }
  }
  
  // Pausar auto-refresh cuando la pestaña está oculta (ahorro de recursos)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      // Si la página vuelve a estar visible, actualizar inmediatamente
      if (calendar) {
        console.log('👁️ Pestaña visible - Actualizando calendario y estadísticas...');
        calendar.refetchEvents();
        loadEstadisticas();
      }
      startAutoRefresh();
    }
  });

  // ========== INICIAR AL CARGAR EL DOM ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // ========== INICIAR AUTO-REFRESH DESPUÉS DE QUE EL CALENDARIO ESTÉ LISTO ==========
  // Esperar 2 segundos después de init para asegurar que el calendario esté listo
  setTimeout(() => {
    if (calendar) {
      startAutoRefresh();
    }
  }, 2000);

})();