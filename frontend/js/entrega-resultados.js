// js/entrega-resultados.js

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // CONFIG & ESTADO
  // ============================================================
  const API_URL = window.API_CONFIG?.ENDPOINTS?.BASE || 'http://localhost:5000';

  function getToken() {
    return (typeof window.getAuthToken === 'function')
      ? window.getAuthToken()
      : localStorage.getItem('token');
  }

  const currentUser   = JSON.parse(localStorage.getItem('userData') || '{}');
  const userRol       = currentUser.rol || '';
  const userId        = currentUser.id;
  const isProfesional = userRol === 'profesional';

  let todosLosProfesionales = [];
  let todosLosTrabajadores  = [];
  let trabajadorSeleccionado = null;
  let registroGuardadoId     = null;

  // ============================================================
  // REFERENCIAS DOM — elementos siempre presentes en la página
  // ============================================================
  const profWrapper  = document.getElementById('profesionalWrapper');
  const profTrigger  = document.getElementById('profesionalTrigger');
  const profText     = document.getElementById('profesionalText');
  const profDropdown = document.getElementById('profesionalDropdown');
  const profSearch   = document.getElementById('profesionalSearch');
  const profOptions  = document.getElementById('profesionalOptions');
  const profIdInput  = document.getElementById('profesionalId');

  const trabWrapper  = document.getElementById('trabajadorWrapper');
  const trabTrigger  = document.getElementById('trabajadorTrigger');
  const trabText     = document.getElementById('trabajadorText');
  const trabDropdown = document.getElementById('trabajadorDropdown');
  const trabSearch   = document.getElementById('trabajadorSearch');
  const trabOptions  = document.getElementById('trabajadorOptions');
  const trabIdInput  = document.getElementById('trabajadorId');

  const workerCard   = document.getElementById('workerCard');
  const workerName   = document.getElementById('workerName');
  const workerCedula = document.getElementById('workerCedula');
  const workerTel    = document.getElementById('workerTelefono');
  const actionsPanel = document.getElementById('actionsPanel');

  const btnGenerarPlant = document.getElementById('btnGenerarPlantilla');
  const btnDescargaPDF  = document.getElementById('btnDescargaPDF');
  const btnVerDoc       = document.getElementById('btnVerDoc');
  const btnEditar       = document.getElementById('btnEditar');
  const btnEliminar     = document.getElementById('btnEliminar');

  // Referencias del modal — se resuelven la primera vez que se abre
  let modalPlantilla, modalClose, modalNombre, fechaAplicacion, fechaRetro,
      tituloSeccion, editorContent, btnGuardar, btnCancelar;
  let modalIniciado = false;

  // ============================================================
  // HELPERS
  // ============================================================
  function formatearFecha(isoDate) {
    if (!isoDate) return '—';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    };
  }

  // ============================================================
  // CUSTOM SELECT — apertura / cierre
  // ============================================================
  function openSelect(wrapper, dropdown, searchInput) {
    wrapper.classList.add('open');
    dropdown.style.display = 'block';
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSelect(wrapper) {
    wrapper.classList.remove('open');
    const dropdown = wrapper.querySelector('.custom-select-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  function closeAllSelects() {
    closeSelect(profWrapper);
    closeSelect(trabWrapper);
  }

  document.addEventListener('click', (e) => {
    if (!profWrapper.contains(e.target)) closeSelect(profWrapper);
    if (!trabWrapper.contains(e.target)) closeSelect(trabWrapper);
  });

  // ============================================================
  // PROFESIONALES
  // ============================================================
  async function cargarProfesionales() {
    if (isProfesional) {
      todosLosProfesionales = [{ id: userId, nombre: currentUser.nombre || 'Mi cuenta' }];
      profIdInput.value    = userId;
      profText.textContent = currentUser.nombre || 'Mi cuenta';
      profWrapper.classList.add('selected', 'disabled');
      profTrigger.setAttribute('tabindex', '-1');
      habilitarTrabajador();
      cargarTrabajadores(userId);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/users`, { headers: headers() });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      todosLosProfesionales = data.users || (Array.isArray(data) ? data : []);
      renderProfesionales(todosLosProfesionales);
    } catch (err) {
      console.error('Error al cargar profesionales:', err);
      profOptions.innerHTML = `<div class="option-error">❌ Error al cargar profesionales</div>`;
    }
  }

  function renderProfesionales(lista) {
    if (!lista.length) {
      profOptions.innerHTML = `<div class="option-empty">No se encontraron profesionales</div>`;
      return;
    }
    profOptions.innerHTML = lista.map(p =>
      `<div class="option-item" data-id="${p.id}" data-nombre="${p.nombre}">${p.nombre}</div>`
    ).join('');
    profOptions.querySelectorAll('.option-item').forEach(item => {
      item.addEventListener('click', () => seleccionarProfesional(item));
    });
  }

  function seleccionarProfesional(item) {
    const id     = item.dataset.id;
    const nombre = item.dataset.nombre;
    profIdInput.value = id;
    profText.textContent = nombre;
    profWrapper.classList.add('selected');
    closeSelect(profWrapper);
    profSearch.value = '';
    renderProfesionales(todosLosProfesionales);
    resetTrabajador();
    habilitarTrabajador();
    cargarTrabajadores(id);
  }

  profSearch.addEventListener('input', () => {
    const q = profSearch.value.toLowerCase().trim();
    renderProfesionales(todosLosProfesionales.filter(p => p.nombre.toLowerCase().includes(q)));
  });

  profTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (profWrapper.classList.contains('disabled')) return;
    profWrapper.classList.contains('open') ? closeSelect(profWrapper) : (() => { closeAllSelects(); openSelect(profWrapper, profDropdown, profSearch); })();
  });

  profTrigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); profTrigger.click(); }
  });

  // ============================================================
  // TRABAJADORES
  // ============================================================
  async function cargarTrabajadores(profesionalId) {
    trabOptions.innerHTML = `<div class="option-loading"><span class="spinner"></span> Cargando trabajadores...</div>`;
    try {
      let trabajadores = [];

      if (isProfesional) {
        const modalidades = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];
        const peticiones = modalidades.map(m =>
          fetch(`${API_URL}/api/clients?profesional_id=${profesionalId}&modalidad=${encodeURIComponent(m)}`,
            { headers: { 'Authorization': `Bearer ${getToken()}` } })
            .then(r => r.ok ? r.json() : [])
        );
        const resultados = await Promise.all(peticiones);
        trabajadores = resultados.flat();
      } else {
        const res = await fetch(`${API_URL}/api/clients/filters?profesional_id=${profesionalId}`,
          { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        trabajadores = Array.isArray(data) ? data : [];
      }

      todosLosTrabajadores = trabajadores;
      renderTrabajadores(todosLosTrabajadores);
    } catch (err) {
      console.error('Error al cargar trabajadores:', err);
      trabOptions.innerHTML = `<div class="option-error">❌ Error al cargar trabajadores</div>`;
    }
  }

  function renderTrabajadores(lista) {
    if (!lista.length) {
      trabOptions.innerHTML = `<div class="option-empty">Este profesional no tiene trabajadores registrados</div>`;
      return;
    }
    trabOptions.innerHTML = lista.map(t =>
      `<div class="option-item" data-id="${t.id}" data-nombre="${t.nombre}"
            data-cedula="${t.cedula}" data-telefono="${t.telefono || ''}">
        ${t.nombre} <span style="color:#9aa3b5;font-size:0.85em;margin-left:6px">· ${t.cedula}</span>
      </div>`
    ).join('');
    trabOptions.querySelectorAll('.option-item').forEach(item => {
      item.addEventListener('click', () => seleccionarTrabajador(item));
    });
  }

  function seleccionarTrabajador(item) {
    const id       = item.dataset.id;
    const nombre   = item.dataset.nombre;
    const cedula   = item.dataset.cedula;
    const telefono = item.dataset.telefono;

    trabIdInput.value    = id;
    trabText.textContent = nombre;
    trabWrapper.classList.add('selected');
    closeSelect(trabWrapper);
    trabSearch.value = '';
    renderTrabajadores(todosLosTrabajadores);

    trabajadorSeleccionado = { id, nombre, cedula, telefono };
    registroGuardadoId = null;
    actionsPanel.style.display = 'none';
    mostrarTarjetaTrabajador(nombre, cedula, telefono);
    mostrarPerfilEstresCard();
    cargarRegistroExistente(id);
  }

  trabSearch.addEventListener('input', () => {
    const q = trabSearch.value.toLowerCase().trim();
    renderTrabajadores(todosLosTrabajadores.filter(t =>
      t.nombre.toLowerCase().includes(q) || t.cedula.toString().includes(q)
    ));
  });

  trabTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trabWrapper.classList.contains('disabled')) return;
    trabWrapper.classList.contains('open') ? closeSelect(trabWrapper) : (() => { closeAllSelects(); openSelect(trabWrapper, trabDropdown, trabSearch); })();
  });

  // ============================================================
  // TARJETA DEL TRABAJADOR
  // ============================================================
  function mostrarTarjetaTrabajador(nombre, cedula, telefono) {
    workerName.textContent   = nombre   || '—';
    workerCedula.textContent = cedula   || '—';
    workerTel.textContent    = telefono || '—';
    workerCard.style.display = 'block';
  }

  // Consulta si el trabajador ya tiene un registro guardado en entrega_resultados
  async function cargarRegistroExistente(clientId) {
    try {
      const res = await fetch(
        `${API_URL}/api/entrega-resultados/cliente/${clientId}`,
        { headers: headers() }
      );
      if (!res.ok) return;

      const data = await res.json();
      // El endpoint devuelve array ordenado por fecha desc — tomamos el más reciente
      if (Array.isArray(data) && data.length > 0) {
        registroGuardadoId = data[0].id;
        actionsPanel.style.display = 'block';
      }
    } catch (err) {
      console.error('Error al cargar registro existente:', err);
    }
  }

  function resetTrabajador() {
    trabIdInput.value     = '';
    trabText.textContent  = 'Seleccionar trabajador...';
    trabWrapper.classList.remove('selected');
    trabSearch.value      = '';
    trabOptions.innerHTML = `<div class="option-empty">Selecciona un profesional primero</div>`;
    todosLosTrabajadores  = [];
    trabajadorSeleccionado = null;
    workerCard.style.display = 'none';
    perfilEstresCard.style.display = 'none';
  }

  function habilitarTrabajador() {
    trabWrapper.classList.remove('disabled');
    trabTrigger.setAttribute('tabindex', '0');
    trabText.textContent = 'Seleccionar trabajador...';
  }

  // ============================================================
  // INIT MODAL — resuelve referencias y registra listeners UNA sola vez
  // ============================================================
  function initModal() {
    if (modalIniciado) return;
    modalIniciado = true;

    modalPlantilla  = document.getElementById('modalPlantilla');
    modalClose      = document.getElementById('modalClose');
    modalNombre     = document.getElementById('modalNombre');
    fechaAplicacion = document.getElementById('fechaAplicacion');
    fechaRetro      = document.getElementById('fechaRetroalimentacion');
    tituloSeccion   = document.getElementById('tituloSeccion');
    editorContent   = document.getElementById('recomendaciones');
    btnGuardar      = document.getElementById('btnGuardar');
    btnCancelar     = document.getElementById('btnCancelar');

    // Listeners del modal
    modalClose.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);
    btnGuardar.addEventListener('click', guardarRegistro);

    // Limpiar borde rojo al empezar a llenar cada campo
    fechaAplicacion.addEventListener('change', () => fechaAplicacion.style.borderColor = '');
    fechaRetro.addEventListener('change',      () => fechaRetro.style.borderColor = '');
    tituloSeccion.addEventListener('input',    () => tituloSeccion.style.borderColor = '');
    editorContent.addEventListener('input',    () => editorContent.style.borderColor = '');

    document.getElementById('btnLimpiarEditor')?.addEventListener('click', () => {
      if (confirm('¿Limpiar todo el contenido del editor?')) {
        editorContent.innerHTML = '';
        editorContent.focus();
      }
    });

    // Barra de herramientas
    document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        execCmd(btn.dataset.cmd);
      });
    });

    editorContent.addEventListener('keyup', actualizarEstadoBotones);
    editorContent.addEventListener('mouseup', actualizarEstadoBotones);
    editorContent.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); execCmd('bold'); }
        if (e.key === 'i') { e.preventDefault(); execCmd('italic'); }
        if (e.key === 'u') { e.preventDefault(); execCmd('underline'); }
      }
    });
    editorContent.addEventListener('paste', handlePaste);
  }

  // ============================================================
  // EDITOR — comandos de formato
  // ============================================================
  function execCmd(cmd, value = null) {
    editorContent.focus();
    document.execCommand(cmd, false, value);
    actualizarEstadoBotones();
  }

  function actualizarEstadoBotones() {
    const cmds = ['bold','italic','underline',
                  'justifyLeft','justifyCenter','justifyRight','justifyFull',
                  'insertUnorderedList','insertOrderedList'];
    cmds.forEach(cmd => {
      const btn = document.querySelector(`.toolbar-btn[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  // ============================================================
  // INTERCEPTAR PEGADO
  // ============================================================
  function handlePaste(e) {
    e.preventDefault();
    const textoPegado = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!textoPegado) return;

    const textoNormalizado = textoPegado
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/\t/g, ' ').replace(/[ \u00A0]{2,}/g, ' ');

    const bloques = textoNormalizado.split(/\n{2,}/);
    const seleccion = window.getSelection();
    if (!seleccion.rangeCount) return;
    const rango = seleccion.getRangeAt(0);
    rango.deleteContents();

    const fragmento = document.createDocumentFragment();
    bloques.forEach((bloque, idx) => {
      const textoBloque = bloque.trim();
      if (!textoBloque) return;
      const textoCombinado = textoBloque.split('\n').map(l => l.trim()).filter(l => l).join(' ');
      const div = document.createElement('div');
      div.textContent = textoCombinado;
      fragmento.appendChild(div);
      if (idx < bloques.length - 1) {
        const divVacio = document.createElement('div');
        divVacio.appendChild(document.createElement('br'));
        fragmento.appendChild(divVacio);
      }
    });

    rango.insertNode(fragmento);
    seleccion.collapseToEnd();
    actualizarEstadoBotones();
  }

  // ============================================================
  // MODAL — abrir / cerrar / limpiar
  // ============================================================
  btnGenerarPlant.addEventListener('click', () => {
    if (!trabajadorSeleccionado) return;
    initModal();
    modalNombre.textContent = trabajadorSeleccionado.nombre;
    if (!registroGuardadoId) limpiarModal();
    modalPlantilla.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => editorContent.focus(), 100);
  });

  function cerrarModal() {
    modalPlantilla.style.display = 'none';
    document.body.style.overflow = '';
  }

  function limpiarModal() {
    fechaAplicacion.value   = '';
    fechaRetro.value        = '';
    tituloSeccion.value     = 'RECOMENDACIONES PARA EL TRABAJADOR';
    editorContent.innerHTML = '';
  }

  // ============================================================
  // GUARDAR REGISTRO EN BD
  // ============================================================
  async function guardarRegistro() {
    if (!trabajadorSeleccionado) return;

    // ── Validación de campos obligatorios ──────────────────────
    const camposVacios = [];

    if (!fechaAplicacion.value)
      camposVacios.push('Fecha aplicación perfil del estrés');

    if (!fechaRetro.value)
      camposVacios.push('Fecha de retroalimentación');

    if (!tituloSeccion.value.trim())
      camposVacios.push('Título de la sección');

    if (!editorContent.innerText.trim())
      camposVacios.push('Recomendaciones / Mensaje');

    if (camposVacios.length > 0) {
      // Resaltar campos vacíos
      fechaAplicacion.style.borderColor  = !fechaAplicacion.value  ? '#dc2626' : '';
      fechaRetro.style.borderColor       = !fechaRetro.value       ? '#dc2626' : '';
      tituloSeccion.style.borderColor    = !tituloSeccion.value.trim() ? '#dc2626' : '';
      editorContent.style.borderColor    = !editorContent.innerText.trim() ? '#dc2626' : '';

      mostrarToast(
        `⚠️ Completa los campos: ${camposVacios.join(', ')}`,
        'error'
      );
      return;
    }

    // Limpiar resaltado si todo está bien
    fechaAplicacion.style.borderColor  = '';
    fechaRetro.style.borderColor       = '';
    tituloSeccion.style.borderColor    = '';
    editorContent.style.borderColor    = '';
    // ──────────────────────────────────────────────────────────

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Guardando...`;

    const payload = {
      client_id:               trabajadorSeleccionado.id,
      fecha_aplicacion:        fechaAplicacion.value  || null,
      fecha_retroalimentacion: fechaRetro.value       || null,
      titulo_seccion:          tituloSeccion.value.trim() || 'RECOMENDACIONES PARA EL TRABAJADOR',
      recomendaciones_html:    editorContent.innerHTML.trim(),
    };

    try {
      let res, data;
      if (registroGuardadoId) {
        res  = await fetch(`${API_URL}/api/entrega-resultados/${registroGuardadoId}`,
          { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
        data = await res.json();
      } else {
        res  = await fetch(`${API_URL}/api/entrega-resultados`,
          { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.message || 'Error al guardar');

      registroGuardadoId = data.data?.id || registroGuardadoId;
      mostrarToast('✅ Guardado exitosamente', 'success');
      cerrarModal();
      limpiarModal();
      actionsPanel.style.display = 'block';

    } catch (err) {
      console.error(err);
      mostrarToast('❌ ' + err.message, 'error');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar`;
    }
  }

  // ============================================================
  // TOAST
  // ============================================================
  function mostrarToast(mensaje, tipo = 'success') {
    const existing = document.getElementById('toast-notif');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toast-notif';
    toast.style.cssText = `
      position:fixed;bottom:28px;right:28px;z-index:9999;
      padding:14px 22px;border-radius:12px;font-size:0.93em;font-weight:600;
      color:white;box-shadow:0 8px 28px rgba(0,0,0,0.2);
      display:flex;align-items:center;gap:8px;
      background:${tipo==='success'?'linear-gradient(135deg,#43c585,#2d8a5e)':'linear-gradient(135deg,#e05252,#c02020)'};
      animation:toastIn 0.3s ease;
    `;
    toast.textContent = mensaje;
    if (!document.getElementById('toast-keyframes')) {
      const s = document.createElement('style');
      s.id = 'toast-keyframes';
      s.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.4s'; }, 2800);
    setTimeout(() => toast.remove(), 3300);
  }

  // ============================================================
  // BOTÓN EDITAR
  // ============================================================
  btnEditar.addEventListener('click', async () => {
    if (!registroGuardadoId) return;
    try {
      const res  = await fetch(`${API_URL}/api/entrega-resultados/${registroGuardadoId}`, { headers: headers() });
      const data = await res.json();
      initModal();
      modalNombre.textContent    = trabajadorSeleccionado.nombre;
      fechaAplicacion.value      = data.fecha_aplicacion?.slice(0,10) || '';
      fechaRetro.value           = data.fecha_retroalimentacion?.slice(0,10) || '';
      tituloSeccion.value        = data.titulo_seccion || 'RECOMENDACIONES PARA EL TRABAJADOR';
      editorContent.innerHTML    = data.recomendaciones_html || '';
      modalPlantilla.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    } catch (err) {
      mostrarToast('❌ Error al cargar el registro', 'error');
    }
  });

  // ============================================================
  // BOTÓN ELIMINAR
  // ============================================================
  btnEliminar.addEventListener('click', async () => {
    if (!registroGuardadoId) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
    try {
      const res = await fetch(`${API_URL}/api/entrega-resultados/${registroGuardadoId}`,
        { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error('Error al eliminar');
      registroGuardadoId = null;
      actionsPanel.style.display = 'none';
      mostrarToast('🗑️ Registro eliminado', 'success');
    } catch (err) {
      mostrarToast('❌ Error al eliminar el registro', 'error');
    }
  });

  // ============================================================
  // BOTÓN VER DOCUMENTO
  // ============================================================
  btnVerDoc.addEventListener('click', async () => {
    if (!registroGuardadoId) return;
    try {
      const res  = await fetch(`${API_URL}/api/entrega-resultados/${registroGuardadoId}`, { headers: headers() });
      const data = await res.json();
      initModal();
      fechaAplicacion.value   = data.fecha_aplicacion?.slice(0,10) || '';
      fechaRetro.value        = data.fecha_retroalimentacion?.slice(0,10) || '';
      tituloSeccion.value     = data.titulo_seccion || 'RECOMENDACIONES PARA EL TRABAJADOR';
      editorContent.innerHTML = data.recomendaciones_html || '';
      generarYDescargarPDF('ver');
    } catch (err) {
      mostrarToast('❌ Error al cargar el documento', 'error');
    }
  });

  // ============================================================
  // BOTÓN DESCARGAR PDF (panel de acciones)
  // ============================================================
  btnDescargaPDF.addEventListener('click', async () => {
    if (!registroGuardadoId) return;
    try {
      const res  = await fetch(`${API_URL}/api/entrega-resultados/${registroGuardadoId}`, { headers: headers() });
      const data = await res.json();
      initModal();
      fechaAplicacion.value   = data.fecha_aplicacion?.slice(0,10) || '';
      fechaRetro.value        = data.fecha_retroalimentacion?.slice(0,10) || '';
      tituloSeccion.value     = data.titulo_seccion || 'RECOMENDACIONES PARA EL TRABAJADOR';
      editorContent.innerHTML = data.recomendaciones_html || '';
      generarYDescargarPDF('descargar');
    } catch (err) {
      mostrarToast('❌ Error al cargar el documento', 'error');
    }
  });

  // ============================================================
  // GENERAR PDF
  // ============================================================
  function generarYDescargarPDF(modo = 'descargar') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Leer datos del profesional en el momento de generar (no al cargar la página)
    // para asegurar que auth-check.js ya haya actualizado el localStorage
    const profesional = JSON.parse(localStorage.getItem('userData') || '{}');

    const pageW   = doc.internal.pageSize.getWidth();
    const pageH   = doc.internal.pageSize.getHeight();
    const marginL = 25;
    const marginR = 25;
    const contentW = pageW - marginL - marginR;

    // Logo superior derecho
    if (logoBase64) {
      // Calcular dimensiones proporcionales (max ancho 45mm)
      const logoAncho = 45;
      const logoAlto  = 18; // proporción aproximada del logo
      doc.addImage(logoBase64, 'PNG', pageW - marginR - logoAncho, 8, logoAncho, logoAlto);
    } else {
      // Fallback texto si no cargó el logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(26, 60, 110);
      doc.text('St Consultores', pageW - marginR, 18, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('SALUD Y SEGURIDAD EN EL TRABAJO', pageW - marginR, 22, { align: 'right' });
    }
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.4);
    doc.line(marginL, 27, pageW - marginR, 27);

    // Datos del trabajador
    let y = 38;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(`Nombre: ${trabajadorSeleccionado.nombre}`, marginL, y);
    y += 7;

    const fecApl   = fechaAplicacion.value ? formatearFecha(fechaAplicacion.value)  : '_______________';
    const fecRetro = fechaRetro.value      ? formatearFecha(fechaRetro.value)        : '_______________';
    doc.text(`Fecha aplicación perfil del estrés: ${fecApl}`, marginL, y);
    y += 7;
    doc.text(`Fecha de retroalimentación: ${fecRetro}`, marginL, y);
    y += 18;

    // Título de sección
    const titulo = tituloSeccion.value.trim() || 'RECOMENDACIONES PARA EL TRABAJADOR';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(titulo, marginL, y);
    const tituloAncho = doc.getTextWidth(titulo);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.4);
    doc.line(marginL, y + 1.5, marginL + tituloAncho, y + 1.5);
    y += 10;

    // Recomendaciones
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    if (editorContent.innerHTML.trim()) {
      y = renderHTMLenPDF(doc, editorContent, marginL, y, contentW, pageH) + 10;
    } else {
      y += 10;
    }

    // Firma — imagen o línea de fallback
    if (y > pageH - 55) { doc.addPage(); y = 30; }
    y += 10;

    if (firmaBase64) {
      // Insertar imagen de firma (ancho 50mm, alto proporcional ~20mm)
      doc.addImage(firmaBase64, 'PNG', marginL, y, 50, 20);
      y += 22;
    } else {
      // Fallback: línea horizontal
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, marginL + 65, y);
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text(profesional.nombre || '', marginL, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Psicóloga Especialista en Seguridad y Salud en el Trabajo', marginL, y);
    y += 5.5;
    if (profesional.licencia) {
      doc.text(`Licencia N. ${profesional.licencia}`, marginL, y);
      y += 5.5;
    }
    if (profesional.telefono) {
      doc.text(`Tel: ${profesional.telefono}`, marginL, y);
    }

    const nombreArchivo = `Plantilla_${trabajadorSeleccionado.nombre.replace(/\s+/g, '_')}.pdf`;

    if (modo === 'ver') {
      // Abrir en el navegador sin descargar
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } else {
      // Descargar al equipo
      doc.save(nombreArchivo);
    }
  }

  // ============================================================
  // RENDER HTML → PDF
  // ============================================================
  const PDF_FONT_SIZE = 11;
  const PDF_LINE_H    = 6.5;
  const PDF_BLOCK_H   = 2;
  const PDF_BLANK_H   = 5.5;
  const PDF_COLOR     = [50, 50, 50];

  function renderHTMLenPDF(doc, editorEl, marginL, yStart, contentW, pageH) {
    let y = yStart;

    function resetFont(bold, italic) {
      const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      doc.setFontSize(PDF_FONT_SIZE);
      doc.setTextColor(...PDF_COLOR);
    }

    function nuevaPaginaSiNecesario() {
      if (y > pageH - 55) { doc.addPage(); y = 25; }
    }

    const parrafos = extraerParrafos(editorEl);

    parrafos.forEach(par => {
      nuevaPaginaSiNecesario();

      if (par.esBr || par.texto.trim() === '') {
        y += PDF_BLANK_H;
        return;
      }

      if (par.esLista) {
        const sangria    = 8;
        const anchoTexto = contentW - sangria;
        resetFont(false, false);

        // Pintar viñeta
        doc.text(par.viñeta, marginL, y);

        // Renderizar texto con la misma lógica de justificado que los párrafos normales
        const lineas = doc.splitTextToSize(par.texto.trim(), anchoTexto);
        const align  = par.align || 'justify';

        lineas.forEach((lineaTexto, lineaIdx) => {
          nuevaPaginaSiNecesario();
          const esUltima = lineaIdx === lineas.length - 1;
          const palabras = lineaTexto.split(' ');
          let xActual    = marginL + sangria;
          let espacioExtra = 0;

          if (align === 'justify' && !esUltima && palabras.length > 1) {
            resetFont(false, false);
            const anchoLinea = doc.getTextWidth(lineaTexto);
            espacioExtra = (anchoTexto - anchoLinea) / (palabras.length - 1);
          }

          // Pintar la viñeta solo en la primera línea (ya fue pintada arriba)
          // Pintar cada palabra con su formato
          const mapaSegs = construirMapaSegmentos(par.segmentos);
          let charGlobal = 0;
          palabras.forEach((palabra) => {
            const seg       = mapaSegs[Math.min(charGlobal, mapaSegs.length - 1)] || {};
            const bold      = !!seg.bold;
            const italic    = !!seg.italic;
            const underline = !!seg.underline;
            const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
            doc.setFont('helvetica', style);
            doc.setFontSize(PDF_FONT_SIZE);
            doc.setTextColor(...PDF_COLOR);
            doc.text(palabra, xActual, y);
            if (underline) {
              const w = doc.getTextWidth(palabra);
              doc.setDrawColor(...PDF_COLOR);
              doc.setLineWidth(0.3);
              doc.line(xActual, y + 0.9, xActual + w, y + 0.9);
            }
            xActual    += doc.getTextWidth(palabra) + doc.getTextWidth(' ') + espacioExtra;
            charGlobal += palabra.length + 1;
          });

          if (lineaIdx < lineas.length - 1) y += PDF_LINE_H;
        });

        y += PDF_LINE_H + 1;
        resetFont(false, false);
        return;
      }

      y = renderParrafoPDF(doc, par, marginL, y, contentW, pageH, resetFont, nuevaPaginaSiNecesario);
      y += PDF_BLOCK_H;
    });

    return y;
  }

  function renderParrafoPDF(doc, par, marginL, y, contentW, pageH, resetFont, nuevaPagina) {
    const textoCompleto = par.segmentos.map(s => s.texto).join('');
    if (!textoCompleto.trim()) return y;

    resetFont(false, false);
    const lineas = doc.splitTextToSize(textoCompleto, contentW);
    const align  = par.align || 'left';
    const mapaSegmentos = construirMapaSegmentos(par.segmentos);
    let charGlobal = 0;

    lineas.forEach((lineaTexto, lineaIdx) => {
      nuevaPagina();
      const esUltima = lineaIdx === lineas.length - 1;

      resetFont(false, false);
      const anchoLinea = doc.getTextWidth(lineaTexto);
      let xBase = marginL;
      if (align === 'center') xBase = marginL + (contentW - anchoLinea) / 2;
      else if (align === 'right') xBase = marginL + contentW - anchoLinea;

      const palabras = lineaTexto.split(' ');
      let espacioExtra = 0;
      if (align === 'justify' && !esUltima && palabras.length > 1) {
        espacioExtra = (contentW - doc.getTextWidth(lineaTexto)) / (palabras.length - 1);
        xBase = marginL;
      }

      let xActual = xBase;
      palabras.forEach((palabra) => {
        const seg       = mapaSegmentos[Math.min(charGlobal, mapaSegmentos.length - 1)] || {};
        const bold      = !!seg.bold;
        const italic    = !!seg.italic;
        const underline = !!seg.underline;

        resetFont(bold, italic);
        doc.text(palabra, xActual, y);

        if (underline) {
          const w = doc.getTextWidth(palabra);
          doc.setDrawColor(...PDF_COLOR);
          doc.setLineWidth(0.3);
          doc.line(xActual, y + 0.9, xActual + w, y + 0.9);
        }

        xActual    += doc.getTextWidth(palabra) + doc.getTextWidth(' ') + espacioExtra;
        charGlobal += palabra.length + 1;
      });

      y += PDF_LINE_H;
    });

    resetFont(false, false);
    return y;
  }

  function construirMapaSegmentos(segmentos) {
    const mapa = [];
    segmentos.forEach(seg => {
      for (let i = 0; i < seg.texto.length; i++) mapa.push(seg);
    });
    return mapa;
  }

  function extraerParrafos(editorEl) {
    const resultado = [];

    function procesarNodo(nodo, fmtPadre) {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const txt = nodo.textContent;
        if (txt) resultado.push({ texto: txt, align: 'left', segmentos: [{ ...fmtPadre, texto: txt }], esBr: false, esLista: false });
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;

      const tag = nodo.tagName.toLowerCase();

      if (tag === 'br') { resultado.push({ esBr: true, texto: '' }); return; }

      if (tag === 'ul' || tag === 'ol') {
        let contador = 1;
        nodo.querySelectorAll(':scope > li').forEach(li => {
          const viñeta = tag === 'ol' ? `${contador++}.` : '•';
          const segs   = extraerSegmentosInline(li, { bold: false, italic: false, underline: false });
          // Buscar alineación en li, luego en ol/ul, luego en el contenedor padre
          const align  = detectarAlign(li) || detectarAlign(nodo) || 'left';
          resultado.push({
            esLista: true,
            viñeta,
            texto:    segs.map(s => s.texto).join(''),
            segmentos: segs,
            align
          });
        });
        return;
      }

      if (['div','p','h1','h2','h3','h4','h5','h6'].includes(tag)) {
        // Si el div contiene una lista anidada, procesarla directamente
        const listaAnidada = nodo.querySelector('ul, ol');
        if (listaAnidada) {
          // Procesar los hijos para llegar a la lista
          nodo.childNodes.forEach(hijo => procesarNodo(hijo, fmtPadre));
          return;
        }

        const align = detectarAlign(nodo);
        const textoPlano = nodo.innerText || nodo.textContent || '';
        if (!textoPlano.trim()) { resultado.push({ esBr: true, texto: '' }); return; }
        const segs = extraerSegmentosInline(nodo, { bold: false, italic: false, underline: false });
        resultado.push({ texto: segs.map(s => s.texto).join(''), align, segmentos: segs, esBr: false, esLista: false });
        return;
      }

      nodo.childNodes.forEach(hijo => procesarNodo(hijo, fmtPadre));
    }

    editorEl.childNodes.forEach(n => procesarNodo(n, { bold: false, italic: false, underline: false }));
    return resultado;
  }

  function detectarAlign(nodo) {
    // Subir hasta 4 niveles buscando text-align explícito
    let el = nodo;
    for (let i = 0; i < 4 && el; i++) {
      if (el.style && el.style.textAlign) return el.style.textAlign;
      if (el.getAttribute && el.getAttribute('align')) return el.getAttribute('align');
      el = el.parentElement;
    }
    // Buscar también en hijos directos
    if (nodo.children) {
      for (const hijo of nodo.children) {
        if (hijo.style && hijo.style.textAlign) return hijo.style.textAlign;
        if (hijo.getAttribute && hijo.getAttribute('align')) return hijo.getAttribute('align');
      }
    }
    return 'left';
  }

  function extraerSegmentosInline(el, fmtPadre) {
    const segs = [];
    function recorrer(nodo, fmt) {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const t = nodo.textContent;
        if (t) segs.push({ ...fmt, texto: t });
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;
      const tag = nodo.tagName.toLowerCase();
      if (tag === 'br') { segs.push({ ...fmt, texto: ' ' }); return; }
      const est = nodo.style;
      const bold      = fmt.bold      || tag === 'b' || tag === 'strong' || est.fontWeight === 'bold';
      const italic    = fmt.italic    || tag === 'i' || tag === 'em'     || est.fontStyle === 'italic';
      const underline = fmt.underline || tag === 'u' || (est.textDecoration && est.textDecoration.includes('underline'));
      nodo.childNodes.forEach(hijo => recorrer(hijo, { bold, italic, underline }));
    }
    recorrer(el, fmtPadre);
    return segs;
  }

  // ============================================================
  // PERFIL ESTRÉS — subida independiente de PDF
  // ============================================================
  const perfilEstresCard   = document.getElementById('perfilEstresCard');
  const uploadZone         = document.getElementById('uploadZone');
  const uploadLink         = document.getElementById('uploadLink');
  const filePreview        = document.getElementById('filePreview');
  const fileName           = document.getElementById('fileName');
  const fileSize           = document.getElementById('fileSize');
  const btnRemoveFile      = document.getElementById('btnRemoveFile');
  const uploadBtnWrapper   = document.getElementById('uploadBtnWrapper');
  const btnSubirPerfil     = document.getElementById('btnSubirPerfil');
  const fileSaved          = document.getElementById('fileSaved');
  const fileSavedName      = document.getElementById('fileSavedName');
  const btnVerPerfil        = document.getElementById('btnVerPerfil');
  const btnDescargarPerfil  = document.getElementById('btnDescargarPerfil');
  const btnReemplazarPerfil = document.getElementById('btnReemplazarPerfil');
  const btnEliminarPerfil   = document.getElementById('btnEliminarPerfil');

  // Input file creado dinámicamente — NUNCA adjunto al DOM permanentemente
  // Esto evita que Chrome dispare beforeunload al tener un input[type=file] en el DOM
  let inputPerfilEstres = null;

  function crearInputFile() {
    const inp = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'application/pdf';
    inp.style.display = 'none';
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      const file = inp.files[0];
      if (file) procesarArchivo(file);
      // Remover del DOM inmediatamente tras la selección
      if (inp.parentNode) inp.parentNode.removeChild(inp);
    });
    return inp;
  }

  function abrirSelectorArchivo() {
    inputPerfilEstres = crearInputFile();
    document.body.appendChild(inputPerfilEstres);
    inputPerfilEstres.click();
  }

  let archivoSeleccionado = null;
  let urlPerfilGuardado   = null;

  // Mostrar tarjeta al seleccionar trabajador
  // Extrae el nombre original del archivo quitando el prefijo que agrega Multer
  // Formato Multer: timestamp_randomStr_nombreOriginal.ext
  function nombreOriginalArchivo(rutaCompleta) {
    const base = rutaCompleta.split('/').pop();
    // Eliminar los dos primeros segmentos separados por _ (timestamp y random)
    const partes = base.split('_');
    if (partes.length > 2) {
      return partes.slice(2).join('_');
    }
    return base;
  }

  function mostrarPerfilEstresCard() {
    perfilEstresCard.style.display = 'block';
    resetPerfilEstres();
    // Verificar si el trabajador ya tiene un Perfil Estrés cargado
    cargarPerfilEstresExistente();
  }

  async function cargarPerfilEstresExistente() {
    if (!trabajadorSeleccionado) return;
    try {
      const res = await fetch(
        `${API_URL}/api/clients/${trabajadorSeleccionado.id}/documentos`,
        { headers: { 'Authorization': `Bearer ${getToken()}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.perfil_estres) {
        urlPerfilGuardado = `${API_URL}/${data.perfil_estres}`;
        fileSavedName.textContent = nombreOriginalArchivo(data.perfil_estres);
        uploadZone.style.display  = 'none';
        fileSaved.style.display   = 'flex';
      }
    } catch (err) {
      console.error('Error al cargar Perfil Estrés existente:', err);
    }
  }

  function resetPerfilEstres() {
    archivoSeleccionado  = null;
    urlPerfilGuardado    = null;
    inputPerfilEstres    = null;
    uploadZone.style.display       = 'flex';
    filePreview.style.display      = 'none';
    fileSaved.style.display        = 'none';
    uploadBtnWrapper.style.display = 'none';
  }

  // Formatear tamaño
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Validar y mostrar archivo seleccionado
  function procesarArchivo(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      mostrarToast('❌ Solo se aceptan archivos PDF', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      mostrarToast('❌ El archivo supera los 10 MB', 'error');
      return;
    }
    archivoSeleccionado = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    uploadZone.style.display    = 'none';
    fileSaved.style.display     = 'none';
    filePreview.style.display   = 'flex';
    uploadBtnWrapper.style.display = 'flex';
  }

  // Click en zona de upload
  uploadZone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirSelectorArchivo();
  });
  uploadLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirSelectorArchivo();
  });

  // Drag & drop
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) procesarArchivo(e.dataTransfer.files[0]);
  });

  // Quitar archivo seleccionado
  btnRemoveFile.addEventListener('click', () => {
    archivoSeleccionado = null;
    filePreview.style.display      = 'none';
    uploadBtnWrapper.style.display = 'none';
    // Si había uno guardado, volver a mostrarlo; si no, mostrar zona upload
    if (urlPerfilGuardado) {
      fileSaved.style.display = 'flex';
    } else {
      uploadZone.style.display = 'flex';
    }
  });

  // Subir archivo al servidor
  btnSubirPerfil.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!archivoSeleccionado || !trabajadorSeleccionado) {
      return;
    }

    btnSubirPerfil.disabled = true;
    btnSubirPerfil.innerHTML = `<span class="spinner" style="width:15px;height:15px;border-width:2px;"></span> Subiendo...`;

    try {
      const formData = new FormData();
      formData.append('documento', archivoSeleccionado);
      formData.append('tipo', 'perfil_estres');

      const res = await fetch(
        `${API_URL}/api/clients/${trabajadorSeleccionado.id}/documentos`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: formData
        }
      );

      if (!res.ok) throw new Error('Error al subir el archivo');
      const data = await res.json();

      urlPerfilGuardado = data.perfil_estres
        ? `${API_URL}/${data.perfil_estres}`
        : data.url || data.ruta || data.path || '';
      fileSavedName.textContent = archivoSeleccionado.name;
      archivoSeleccionado = null;
      // No manipular el input[type=file] tras la subida —
      // Chrome dispara beforeunload al modificar/clonar un input file activo

      filePreview.style.display      = 'none';
      uploadBtnWrapper.style.display = 'none';
      uploadZone.style.display       = 'none';
      fileSaved.style.display        = 'flex';

      mostrarToast('✅ Perfil Estrés subido exitosamente', 'success');

    } catch (err) {
      console.error(err);
      mostrarToast('❌ Error al subir el archivo', 'error');
    } finally {
      btnSubirPerfil.disabled = false;
      btnSubirPerfil.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Subir Perfil Estrés`;
    }
  });

  // Ver PDF guardado
  btnVerPerfil.addEventListener('click', () => {
    if (urlPerfilGuardado) window.open(urlPerfilGuardado, '_blank');
  });

  btnDescargarPerfil.addEventListener('click', async () => {
    if (!urlPerfilGuardado) return;
    try {
      const nombreVisible = fileSavedName.textContent || 'perfil_estres.pdf';
      const res  = await fetch(urlPerfilGuardado, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error al descargar');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = nombreVisible;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error(err);
      mostrarToast('❌ Error al descargar el archivo', 'error');
    }
  });

  // Reemplazar: volver a zona de upload
  btnReemplazarPerfil.addEventListener('click', () => {
    fileSaved.style.display  = 'none';
    uploadZone.style.display = 'flex';
    setTimeout(() => abrirSelectorArchivo(), 50);
  });

  // Eliminar archivo guardado
  btnEliminarPerfil.addEventListener('click', async () => {
    if (!confirm('¿Eliminar el Perfil Estrés cargado?')) return;
    try {
      const res = await fetch(
        `${API_URL}/api/clients/${trabajadorSeleccionado.id}/documentos/perfil_estres`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } }
      );
      if (!res.ok) throw new Error('Error al eliminar');
      urlPerfilGuardado = null;
      fileSaved.style.display  = 'none';
      uploadZone.style.display = 'flex';
      mostrarToast('🗑️ Perfil Estrés eliminado', 'success');
    } catch (err) {
      mostrarToast('❌ Error al eliminar el archivo', 'error');
    }
  });

  // ============================================================
  // LOGO Y FIRMA — precarga al iniciar para usarlos en el PDF
  // ============================================================
  let logoBase64  = null;
  let firmaBase64 = null;

  async function precargarImagenes() {
    // Logo
    try {
      const res  = await fetch('img/logo/stconsultores.png');
      const blob = await res.blob();
      logoBase64 = await blobToBase64(blob);
    } catch (err) {
      console.warn('Logo no encontrado:', err);
    }

    // Firma del profesional logueado (img/firmas/firma_{cedula}.png)
    try {
      const cedula = currentUser.cedula;
      if (cedula) {
        const res  = await fetch(`img/firmas/firma_${cedula}.png`);
        if (res.ok) {
          const blob = await res.blob();
          firmaBase64 = await blobToBase64(blob);
        } else {
          console.warn(`Firma no encontrada para cédula: ${cedula}`);
        }
      }
    } catch (err) {
      console.warn('Error al cargar firma:', err);
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  precargarImagenes();
  cargarProfesionales();

});