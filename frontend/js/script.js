// frontend/js/script.js

const API_URL = window.API_CONFIG.ENDPOINTS.CLIENTS;

// Referencias al formulario
const form = document.getElementById("clientForm");

// Variable para controlar si estamos editando
let editingId = null;

// Guardamos clientes en memoria local para validar duplicados
let cachedClients = [];

// Variable para almacenar datos del contacto de emergencia
let contactoEmergencia = {
  nombre: null,
  parentesco: null,
  telefono: null
};

// ✅ FUNCIÓN: Convertir nombre a formato Title Case
// "ANDRES CASAS" → "Andres Casas" | "andres casas" → "Andres Casas"
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)         // Eliminar espacios dobles
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

// Catálogo de entidades según tipo
const ENTIDADES = {
  ARL: ['Sura', 'Positiva', 'Colpatria', 'Bolívar', 'Colmena'],
  CCF: ['Colsubsidio', 'Compensar', 'CAFAM', 'Comfama']
};

// Lista de sedes (todas las capitales de departamento de Colombia)
const SEDES = [
  'Neiva', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Pereira', 'Leticia',
  'Arauca', 'Cartagena de Indias', 'Tunja', 'Manizales', 'Florencia', 'Yopal',
  'Popayán', 'Valledupar', 'Quibdó', 'Montería', 'Inírida', 'San José del Guaviare',
  'Riohacha', 'Santa Marta', 'Villavicencio', 'San Juan de Pasto', 'Cúcuta',
  'Mocoa', 'Armenia', 'San Andrés', 'Bucaramanga', 'Sincelejo', 'Ibagué', 'Mitú',
  'Puerto Carreño'
].sort();

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Función para obtener headers con autenticación
function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getAuthToken()}`
  };
}

// ============================================
// ✅ NUEVA FUNCIÓN: Verificar y mostrar modalidad seleccionada
// ============================================
function verificarModalidadSeleccionada() {
  const modalidadSeleccionada = localStorage.getItem('modalidadSeleccionada');
  const indicador = document.getElementById('modalidadIndicador');
  const modalidadNombre = document.getElementById('modalidadNombre');
  
  if (!modalidadSeleccionada) {
    // Si no hay modalidad seleccionada, redirigir a la página de selección
    alert('⚠️ Debes seleccionar una modalidad antes de registrar trabajadores');
    window.location.href = 'modalidad.html';
    return null;
  }
  
  // Mostrar el indicador de modalidad
  if (indicador && modalidadNombre) {
    modalidadNombre.textContent = modalidadSeleccionada;
    indicador.style.display = 'flex';
  }
  
  return modalidadSeleccionada;
}

// ============================================
// ✅ NUEVA FUNCIÓN: Mostrar/ocultar campos exclusivos de SVE (Sexo y Cargo)
// En SVE: muestra Sexo y Cargo, agrega clase al form para ajustar el grid.
// En OP:  oculta todo con display:none — ningún elemento fantasma en el grid.
// ============================================
function setupCamposSVE() {
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  const esSVE = modalidad === 'Sistema de Vigilancia Epidemiológica';

  const form       = document.getElementById('clientForm');
  const campSexo   = document.getElementById('campSexo');
  const campCargo  = document.getElementById('campCargo');
  const sexoInput  = document.getElementById('sexo');
  const cargoInput = document.getElementById('cargo');
  const placeholderSexo  = document.getElementById('placeholderSexo');
  const placeholderCargo = document.getElementById('placeholderCargo');

  if (!campSexo || !campCargo) return;

  if (esSVE) {
    // SVE: activar campos reales, ocultar placeholders, marcar el form
    campSexo.style.display  = 'flex';
    campCargo.style.display = 'flex';
    if (placeholderSexo)  placeholderSexo.style.display  = 'none';
    if (placeholderCargo) placeholderCargo.style.display = 'none';
    form.classList.add('modalidad-sve');
    form.classList.remove('modalidad-op');
    if (sexoInput)  sexoInput.setAttribute('required', 'required');
    if (cargoInput) cargoInput.setAttribute('required', 'required');

  } else {
    // OP: TODO con display:none — no ocupan ninguna celda del grid
    campSexo.style.display  = 'none';
    campCargo.style.display = 'none';
    if (placeholderSexo)  placeholderSexo.style.display  = 'none';
    if (placeholderCargo) placeholderCargo.style.display = 'none';
    form.classList.add('modalidad-op');
    form.classList.remove('modalidad-sve');
    if (sexoInput)  { sexoInput.removeAttribute('required');  sexoInput.value  = ''; }
    if (cargoInput) { cargoInput.removeAttribute('required'); cargoInput.value = ''; }
  }
}

// ============================================
// ✅ MODAL: Datos de Familiar Trabajador
// Se abre automáticamente al seleccionar "Familiar Trabajador" en Vínculo
// ============================================

// Estado del modal — guarda si el usuario ya confirmó los datos
let familiarConfirmado = false;

function setupCamposFamiliarTrabajador() {
  const vinculoSelect  = document.getElementById('vinculo');
  const modalOverlay   = document.getElementById('modalFamiliarTrabajador');
  const modalCedula    = document.getElementById('modalCedulaTrabajador');
  const modalNombre    = document.getElementById('modalNombreTrabajador');
  const btnConfirmar   = document.getElementById('btnModalConfirmarFamiliar');
  const btnCancelar    = document.getElementById('btnModalCancelarFamiliar');

  // Campos hidden del form principal (los lee el submit)
  const hiddenCedula   = document.getElementById('cedulaTrabajador');
  const hiddenNombre   = document.getElementById('nombreTrabajador');

  if (!vinculoSelect || !modalOverlay) return;

  // ── Guardar el valor antes de que el usuario interactúe ───────────────
  // Esto permite detectar si ya estaba en "Familiar Trabajador" al hacer clic
  let valorAntesDeCambio = vinculoSelect.value;

  vinculoSelect.addEventListener('mousedown', function () {
    valorAntesDeCambio = this.value;
  });

  // ── Abrir modal al seleccionar "Familiar Trabajador" ──────────────────
  // El evento 'change' cubre el caso en que se cambia desde otra opción.
  // El evento 'click' cubre el caso en que ya estaba en "Familiar Trabajador"
  // y el usuario vuelve a hacer clic (change no se dispara en ese caso).
  vinculoSelect.addEventListener('change', function () {
    if (this.value === 'Familiar Trabajador') {
      abrirModalFamiliar();
    } else {
      // Al cambiar a otra opción, limpiar los datos guardados
      familiarConfirmado = false;
      if (hiddenCedula) hiddenCedula.value = '';
      if (hiddenNombre) hiddenNombre.value = '';
      vinculoSelect.classList.remove('vinculo-con-familiar');
    }
  });

  // ── Re-abrir modal si el usuario hace clic sobre la opción ya activa ──
  // 'change' no se dispara cuando el valor no cambia, así que usamos 'click'
  // junto con la comparación del valor previo para detectar ese caso.
  vinculoSelect.addEventListener('click', function () {
    if (this.value === 'Familiar Trabajador' && valorAntesDeCambio === 'Familiar Trabajador') {
      abrirModalFamiliar();
    }
  });

  // ── Confirmar datos en el modal ────────────────────────────────────────
  btnConfirmar.addEventListener('click', function () {
    const cedula = modalCedula.value.trim();
    const nombre = toTitleCase(modalNombre.value.trim());

    // Validaciones
    let hayError = false;

    if (!cedula || !/^\d+$/.test(cedula)) {
      modalCedula.classList.add('input-error');
      hayError = true;
    } else {
      modalCedula.classList.remove('input-error');
    }

    if (!nombre || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ'\s]+$/.test(nombre)) {
      modalNombre.classList.add('input-error');
      hayError = true;
    } else {
      modalNombre.classList.remove('input-error');
    }

    if (hayError) return;

    // Guardar en los campos hidden del formulario principal
    hiddenCedula.value = cedula;
    hiddenNombre.value = nombre;
    modalNombre.value  = nombre; // Actualizar con Title Case

    familiarConfirmado = true;
    vinculoSelect.classList.add('vinculo-con-familiar');
    cerrarModalFamiliar();
  });

  // ── Cancelar en el modal ───────────────────────────────────────────────
  btnCancelar.addEventListener('click', function () {
    // Volver vínculo a vacío si no había datos previos confirmados
    if (!familiarConfirmado) {
      vinculoSelect.value = '';
      vinculoSelect.classList.remove('vinculo-con-familiar');
    }
    cerrarModalFamiliar();
  });

  // ── Cerrar al hacer clic en el overlay (fondo oscuro) ─────────────────
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      if (!familiarConfirmado) {
        vinculoSelect.value = '';
        vinculoSelect.classList.remove('vinculo-con-familiar');
      }
      cerrarModalFamiliar();
    }
  });

  // ── Cerrar con Escape ──────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
      if (!familiarConfirmado) {
        vinculoSelect.value = '';
        vinculoSelect.classList.remove('vinculo-con-familiar');
      }
      cerrarModalFamiliar();
    }
  });
}

function abrirModalFamiliar() {
  const modalOverlay  = document.getElementById('modalFamiliarTrabajador');
  const modalCedula   = document.getElementById('modalCedulaTrabajador');
  const modalNombre   = document.getElementById('modalNombreTrabajador');
  const hiddenCedula  = document.getElementById('cedulaTrabajador');
  const hiddenNombre  = document.getElementById('nombreTrabajador');
  const modalTitle    = document.getElementById('modalFamiliarTitle');
  const modalSubtitle = modalOverlay.querySelector('.modal-subtitle');
  const btnConfirmar  = document.getElementById('btnModalConfirmarFamiliar');

  const hayDatosPrevios = hiddenCedula && hiddenCedula.value;

  // ── Adaptar textos según si es primera vez o edición ──────────────────
  if (hayDatosPrevios) {
    if (modalTitle)    modalTitle.textContent    = 'Editar Datos del Trabajador Titular';
    if (modalSubtitle) modalSubtitle.textContent = 'Puedes modificar los datos del trabajador antes de guardar';
    if (btnConfirmar)  btnConfirmar.innerHTML    = '✅ Actualizar datos';
  } else {
    if (modalTitle)    modalTitle.textContent    = 'Datos del Trabajador Titular';
    if (modalSubtitle) modalSubtitle.textContent = 'Ingresa los datos del trabajador al que pertenece este familiar';
    if (btnConfirmar)  btnConfirmar.innerHTML    = '✅ Confirmar datos';
  }

  // ── Pre-rellenar con los datos ya guardados ────────────────────────────
  if (hiddenCedula && hiddenCedula.value) modalCedula.value = hiddenCedula.value;
  if (hiddenNombre && hiddenNombre.value) modalNombre.value = hiddenNombre.value;

  // Limpiar errores visuales
  modalCedula.classList.remove('input-error');
  modalNombre.classList.remove('input-error');

  modalOverlay.style.display = 'flex';
  // Foco automático al primer campo
  setTimeout(() => modalCedula.focus(), 80);
}

function cerrarModalFamiliar() {
  const modalOverlay = document.getElementById('modalFamiliarTrabajador');
  modalOverlay.style.display = 'none';
}

// ============================================
// CLASE PARA SELECT CON BÚSQUEDA
// ============================================
class SearchableSelect {
  constructor(inputId, hiddenId, dropdownId, options, displayFn = null) {
    this.input = document.getElementById(inputId);
    this.hidden = document.getElementById(hiddenId);
    this.dropdown = document.getElementById(dropdownId);
    this.options = options;
    this.displayFn = displayFn || ((item) => typeof item === 'object' ? item.text : item);
    this.valueFn = (item) => typeof item === 'object' ? item.value : item;
    this.filteredOptions = [...options];
    this.selectedIndex = -1;
    this.searchInput = null;
    
    this.init();
  }

  init() {
    // Crear el input de búsqueda dentro del dropdown
    this.createSearchInput();
    
    // El input principal ahora es solo readonly y abre el dropdown
    this.input.setAttribute('readonly', 'readonly');
    this.input.style.cursor = 'pointer';
    
    // Evento al hacer clic en el input o en la flecha (abrir dropdown)
    const wrapper = this.input.closest('.searchable-select-wrapper');
    const trigger = wrapper.querySelector('.searchable-select-trigger');
    
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.dropdown.style.display === 'block') {
        this.hideDropdown();
      } else {
        this.showDropdown();
        // Enfocar el input de búsqueda
        setTimeout(() => {
          if (this.searchInput) {
            this.searchInput.focus();
          }
        }, 50);
      }
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        this.hideDropdown();
      }
    });
    
    // Navegación con teclado en el input de búsqueda
    this.searchInput.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  createSearchInput() {
    // Crear contenedor del input de búsqueda
    const searchContainer = document.createElement('div');
    searchContainer.className = 'searchable-search-container';
    
    // Crear el input de búsqueda
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'searchable-search-input';
    this.searchInput.placeholder = '🔍 Buscar...';
    this.searchInput.autocomplete = 'off';
    
    // Evento al escribir en el input de búsqueda
    this.searchInput.addEventListener('input', () => this.filterOptions());
    
    // Botón para limpiar búsqueda
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'searchable-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.title = 'Limpiar búsqueda';
    
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.searchInput.value = '';
      this.filterOptions();
      this.searchInput.focus();
    });
    
    searchContainer.appendChild(this.searchInput);
    searchContainer.appendChild(clearBtn);
    
    // Insertar al inicio del dropdown
    this.dropdown.insertBefore(searchContainer, this.dropdown.firstChild);
  }

  filterOptions() {
    const searchTerm = this.searchInput.value.toLowerCase().trim();
    
    this.filteredOptions = this.options.filter(option => {
      const text = this.displayFn(option).toLowerCase();
      return text.includes(searchTerm);
    });
    
    this.selectedIndex = -1;
    this.renderDropdown();
  }

  renderDropdown() {
    // Limpiar solo las opciones, no el input de búsqueda
    const optionsContainer = this.dropdown.querySelector('.searchable-options-list');
    if (optionsContainer) {
      optionsContainer.remove();
    }
    
    const newOptionsContainer = document.createElement('div');
    newOptionsContainer.className = 'searchable-options-list';
    
    if (this.filteredOptions.length === 0) {
      newOptionsContainer.innerHTML = '<div class="searchable-option no-results">No se encontraron resultados</div>';
    } else {
      this.filteredOptions.forEach((option, index) => {
        const div = document.createElement('div');
        div.className = 'searchable-option';
        div.textContent = this.displayFn(option);
        div.dataset.index = index;
        
        div.addEventListener('click', () => {
          this.selectOption(option);
        });
        
        newOptionsContainer.appendChild(div);
      });
    }
    
    this.dropdown.appendChild(newOptionsContainer);
  }

  selectOption(option) {
    const displayText = this.displayFn(option);
    const value = this.valueFn(option);
    
    this.input.value = displayText;
    this.hidden.value = value;
    this.searchInput.value = ''; // Limpiar búsqueda
    this.hideDropdown();
    
    // Disparar evento change en el campo oculto
    const event = new Event('change', { bubbles: true });
    this.hidden.dispatchEvent(event);
  }

  handleKeyboard(e) {
    const optionsList = this.dropdown.querySelector('.searchable-options-list');
    if (!optionsList) return;
    
    const options = optionsList.querySelectorAll('.searchable-option:not(.no-results)');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, options.length - 1);
      this.highlightOption(options);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.highlightOption(options);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedIndex >= 0 && this.filteredOptions[this.selectedIndex]) {
        this.selectOption(this.filteredOptions[this.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      this.hideDropdown();
    }
  }

  highlightOption(options) {
    options.forEach((opt, idx) => {
      opt.classList.toggle('highlighted', idx === this.selectedIndex);
    });
    
    if (options[this.selectedIndex]) {
      options[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  showDropdown() {
    this.dropdown.style.display = 'block';
    this.filteredOptions = [...this.options];
    this.renderDropdown();
  }

  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.selectedIndex = -1;
    this.searchInput.value = ''; // Limpiar búsqueda al cerrar
  }

  setOptions(newOptions) {
    this.options = newOptions;
    this.filteredOptions = [...newOptions];
    if (this.dropdown.style.display === 'block') {
      this.renderDropdown();
    }
  }

  setValue(value, displayText) {
    this.hidden.value = value;
    this.input.value = displayText;
  }

  reset() {
    this.input.value = '';
    this.hidden.value = '';
    this.searchInput.value = '';
    this.hideDropdown();
  }
}

// Variables globales para los selectores con búsqueda
let sedeSelector;
let empresaSelector;
let entidadEspecificaSelector;
let subcontratistaSelector;

// Esperar a que el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  // ✅ NUEVO: Verificar modalidad seleccionada al cargar la página
  verificarModalidadSeleccionada();
  
  // ✅ NUEVO: Corregir formato de nombre en tiempo real al salir del campo
  document.getElementById("name")?.addEventListener("blur", function() {
    if (this.value.trim()) {
      this.value = toTitleCase(this.value);
    }
  });
  document.getElementById("nombreTrabajador")?.addEventListener("blur", function() {
    if (this.value.trim()) {
      this.value = toTitleCase(this.value);
    }
  });
  
  initializeForm();
  loadClientsForCache();
  loadEmpresas();
  setupEntidadPagadoraDinamica();
  setupCancelarEdicion();
  setupBotonAgendarCita(); // ✅ NUEVO: Inicializar botón Agendar Cita
  initializeSearchableSelects();
  setupCamposFamiliarTrabajador(); // ✅ NUEVO: Inicializar campos condicionales
  setupCamposSVE(); // ✅ NUEVO: Mostrar/ocultar campos SVE según modalidad
});

function initializeSearchableSelects() {
  // Inicializar selector de Sede
  sedeSelector = new SearchableSelect(
    'sedeSearch',
    'sede',
    'sedeDropdown',
    SEDES
  );
}

function initializeForm() {
  const btnBuscarCedula = document.getElementById("btnBuscarCedula");
  const cedulaInput = document.getElementById("cedula");

  // === BÚSQUEDA POR CÉDULA ===
  if (btnBuscarCedula) {
    btnBuscarCedula.addEventListener("click", async () => {
      const cedula = cedulaInput.value.trim();

      if (!cedula) {
        alert("Por favor ingresa una cédula para buscar");
        return;
      }

      if (!/^\d+$/.test(cedula)) {
        alert("La cédula debe contener solo números");
        return;
      }

      // ✅ NUEVO: Obtener modalidad seleccionada
      const modalidadActual = localStorage.getItem('modalidadSeleccionada');
      if (!modalidadActual) {
        alert("⚠️ Debes seleccionar una modalidad primero");
        window.location.href = 'modalidad.html';
        return;
      }

      // Deshabilitar botón mientras busca
      btnBuscarCedula.disabled = true;
      btnBuscarCedula.textContent = "⏳";

      try {
        // ✅ NUEVO: Agregar parámetro de modalidad a la búsqueda
        const res = await fetch(`${API_URL}?modalidad=${encodeURIComponent(modalidadActual)}`, {
          headers: {
            "Authorization": `Bearer ${getAuthToken()}`
          }
        });
        if (!res.ok) {
          alert("Error al buscar en el servidor");
          return;
        }

        const clients = await res.json();
        const clienteEncontrado = clients.find(c => c.cedula === cedula);

        if (clienteEncontrado) {
          // Pre-llenar el formulario con los datos encontrados
          document.getElementById("name").value = toTitleCase(clienteEncontrado.nombre || ""); // ✅ Title Case
          document.getElementById("vinculo").value = clienteEncontrado.vinculo || "";
          
          // ✅ Cargar datos de familiar trabajador si existen (sin abrir modal)
          if (clienteEncontrado.vinculo === 'Familiar Trabajador') {
            const hCedula = document.getElementById("cedulaTrabajador");
            const hNombre = document.getElementById("nombreTrabajador");
            if (hCedula && clienteEncontrado.cedula_trabajador) hCedula.value = clienteEncontrado.cedula_trabajador;
            if (hNombre && clienteEncontrado.nombre_trabajador) hNombre.value = clienteEncontrado.nombre_trabajador;
            document.getElementById("vinculo").classList.add("vinculo-con-familiar");
            familiarConfirmado = true;
          }
          
          if (clienteEncontrado.sede) {
            sedeSelector.setValue(clienteEncontrado.sede, clienteEncontrado.sede);
          }
          
          if (clienteEncontrado.tipo_entidad_pagadora) {
            document.getElementById("entidadPagadora").value = clienteEncontrado.tipo_entidad_pagadora;
            
            const event = new Event('change');
            document.getElementById("entidadPagadora").dispatchEvent(event);
            
            if (clienteEncontrado.entidad_pagadora_especifica) {
              setTimeout(() => {
                if (entidadEspecificaSelector) {
                  entidadEspecificaSelector.setValue(
                    clienteEncontrado.entidad_pagadora_especifica,
                    clienteEncontrado.entidad_pagadora_especifica
                  );
                }
              }, 100);
            }
          }
          
          if (clienteEncontrado.empresa_id && empresaSelector) {
            const empresas = empresaSelector.options;
            const empresaEncontrada = empresas.find(e => e.value === clienteEncontrado.empresa_id);
            if (empresaEncontrada) {
              empresaSelector.setValue(empresaEncontrada.value, empresaEncontrada.text);
            }
          }
          
          if (clienteEncontrado.subcontratista_id && subcontratistaSelector) {
            const subcontratistas = subcontratistaSelector.options;
            const subcontratistaEncontrado = subcontratistas.find(s => s.value === clienteEncontrado.subcontratista_id);
            if (subcontratistaEncontrado) {
              subcontratistaSelector.setValue(subcontratistaEncontrado.value, subcontratistaEncontrado.text);
            }
          }
          
          document.getElementById("email").value = clienteEncontrado.email || "";
          document.getElementById("phone").value = clienteEncontrado.telefono || "";

          // ✅ NUEVO: Cargar campos SVE si existen
          const modalidadActualSVE = localStorage.getItem('modalidadSeleccionada');
          if (modalidadActualSVE === 'Sistema de Vigilancia Epidemiológica') {
            const sexoInput = document.getElementById("sexo");
            const cargoInput = document.getElementById("cargo");
            if (sexoInput && clienteEncontrado.sexo) sexoInput.value = clienteEncontrado.sexo;
            if (cargoInput && clienteEncontrado.cargo) cargoInput.value = clienteEncontrado.cargo;
          }

          editingId = clienteEncontrado.id;
          form.querySelector("button[type='submit']").textContent = "Guardar cambios";
          
          document.getElementById("btnCancelarEdicion").style.display = "inline-block";

          alert("✅ Cliente encontrado. Los datos han sido cargados.");
        } else {
          alert("❌ No se encontró ningún cliente con esa cédula en la modalidad actual");
          resetForm();
        }
      } catch (err) {
        console.error("Error buscando cliente:", err);
        alert("Error de conexión al buscar cliente");
      } finally {
        btnBuscarCedula.disabled = false;
        btnBuscarCedula.textContent = "🔍";
      }
    });
  }

  // Detectar si hay un parámetro ?edit=<id> en la URL
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  if (editId) {
    startEdit(parseInt(editId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function resetForm() {
  document.getElementById("name").value = "";
  document.getElementById("vinculo").value = "";
  
  // ✅ Limpiar datos del modal Familiar Trabajador
  const hCedula = document.getElementById("cedulaTrabajador");
  const hNombre = document.getElementById("nombreTrabajador");
  if (hCedula) hCedula.value = "";
  if (hNombre) hNombre.value = "";
  familiarConfirmado = false;
  const vinculoSel = document.getElementById("vinculo");
  if (vinculoSel) vinculoSel.classList.remove("vinculo-con-familiar");
  // Limpiar también los inputs del modal por si quedaron abiertos
  const mCedula = document.getElementById("modalCedulaTrabajador");
  const mNombre = document.getElementById("modalNombreTrabajador");
  if (mCedula) { mCedula.value = ""; mCedula.classList.remove("input-error"); }
  if (mNombre) { mNombre.value = ""; mNombre.classList.remove("input-error"); }

  // ✅ NUEVO: Limpiar campos SVE (no se ocultan, sólo se limpian)
  const sexoInput = document.getElementById("sexo");
  const cargoInput = document.getElementById("cargo");
  if (sexoInput) sexoInput.value = "";
  if (cargoInput) cargoInput.value = "";  
  sedeSelector.reset();
  document.getElementById("entidadPagadora").value = "";
  if (entidadEspecificaSelector) entidadEspecificaSelector.reset();
  document.getElementById("entidadEspecificaContainer").style.display = "none";
  if (empresaSelector) empresaSelector.reset();
  if (subcontratistaSelector) subcontratistaSelector.reset();
  document.getElementById("email").value = "";
  document.getElementById("phone").value = "";
  
  editingId = null;
  form.querySelector("button[type='submit']").textContent = "Registrar Trabajador";
  document.getElementById("btnCancelarEdicion").style.display = "none";
}

function setupEntidadPagadoraDinamica() {
  const selectTipo = document.getElementById("entidadPagadora");
  const containerEspecifica = document.getElementById("entidadEspecificaContainer");

  selectTipo.addEventListener("change", function() {
    const tipoSeleccionado = this.value;

    if (tipoSeleccionado === "Particular") {
      containerEspecifica.style.display = "none";
      document.getElementById("entidadEspecifica").removeAttribute("required");
      if (entidadEspecificaSelector) entidadEspecificaSelector.reset();
    } else if (tipoSeleccionado === "ARL" || tipoSeleccionado === "CCF") {
      containerEspecifica.style.display = "block";
      document.getElementById("entidadEspecifica").setAttribute("required", "required");
      
      document.getElementById("labelEntidadEspecifica").innerHTML = `Seleccione ${tipoSeleccionado}: <span class="required">*</span>`;
      
      const opciones = ENTIDADES[tipoSeleccionado];
      
      if (!entidadEspecificaSelector) {
        entidadEspecificaSelector = new SearchableSelect(
          'entidadEspecificaSearch',
          'entidadEspecifica',
          'entidadEspecificaDropdown',
          opciones
        );
      } else {
        entidadEspecificaSelector.setOptions(opciones);
        entidadEspecificaSelector.reset();
      }
    } else {
      containerEspecifica.style.display = "none";
      document.getElementById("entidadEspecifica").removeAttribute("required");
    }
  });
}

async function loadEmpresas() {
  try {
    const res = await fetch(window.API_CONFIG.ENDPOINTS.EMPRESAS, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      console.error("Error cargando empresas - Status:", res.status);
      return;
    }
    
    const empresas = await res.json();
    
    const empresasFormateadas = empresas.map(empresa => ({
      value: empresa.id,
      text: empresa.cliente_final
    }));
    
    empresaSelector = new SearchableSelect(
      'empresaUsuarioSearch',
      'empresaUsuario',
      'empresaUsuarioDropdown',
      empresasFormateadas,
      (item) => item.text
    );
    
    const subcontratistasFormateados = [
      { value: null, text: 'No Aplica' },
      ...empresas.map(empresa => ({
        value: empresa.id,
        text: empresa.cliente_definitivo || empresa.cliente_final || 'Sin nombre'
      }))
    ];
    
    subcontratistaSelector = new SearchableSelect(
      'subcontratistaSearch',
      'subcontratista',
      'subcontratistaDropdown',
      subcontratistasFormateados,
      (item) => item.text
    );
    
  } catch (err) {
    console.error("❌ Error cargando empresas:", err);
  }
}

// ✅ ACTUALIZADO: Cargar clientes para cache CON filtro de modalidad
async function loadClientsForCache() {
  try {
    const modalidadActual = localStorage.getItem('modalidadSeleccionada');
    if (!modalidadActual) return;
    
    const res = await fetch(`${API_URL}?modalidad=${encodeURIComponent(modalidadActual)}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    if (res.ok) {
      const clients = await res.json();
      cachedClients = Array.isArray(clients) ? clients : [];
    }
  } catch (err) {
    console.error("Error cargando clientes para cache:", err);
  }
}

// ✅ ACTUALIZADO: Manejo del submit CON modalidad y campos de familiar trabajador
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ NUEVO: Obtener modalidad del localStorage
  const modalidad = localStorage.getItem('modalidadSeleccionada');
  if (!modalidad) {
    alert('⚠️ Debes seleccionar una modalidad antes de registrar');
    window.location.href = 'modalidad.html';
    return;
  }

  const cedula = document.getElementById("cedula").value.trim();
  const nombre = toTitleCase(document.getElementById("name").value.trim()); // ✅ Title Case
  const vinculo = document.getElementById("vinculo").value;
  const sede = document.getElementById("sede").value.trim();
  let email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("phone").value.trim();

  // ✅ NUEVO: Capturar campos SVE si corresponde
  let sexo = null;
  let cargo = null;
  if (modalidad === 'Sistema de Vigilancia Epidemiológica') {
    sexo = document.getElementById("sexo")?.value || null;
    cargo = document.getElementById("cargo")?.value.trim() || null;

    if (!sexo) {
      alert("El campo Sexo es obligatorio para la modalidad SVE.");
      return;
    }
    if (!cargo) {
      alert("El campo Cargo es obligatorio para la modalidad SVE.");
      return;
    }
  }

  // ✅ NUEVO: Obtener datos de familiar trabajador si aplica
  let cedulaTrabajador = null;
  let nombreTrabajador = null;
  
  if (vinculo === 'Familiar Trabajador') {
    cedulaTrabajador = document.getElementById("cedulaTrabajador").value.trim();
    nombreTrabajador = toTitleCase(document.getElementById("nombreTrabajador").value.trim()); // ✅ Title Case
    
    // Validar que estos campos estén llenos
    if (!cedulaTrabajador || !nombreTrabajador) {
      alert("Debes completar los datos del trabajador al que está vinculado el familiar");
      return;
    }
    
    // Validar formato de cédula del trabajador
    if (!/^\d+$/.test(cedulaTrabajador)) {
      alert("La cédula del trabajador debe contener solo números.");
      return;
    }
    
    // Validar formato de nombre del trabajador
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ'\s]+$/.test(nombreTrabajador)) {
      alert("El nombre del trabajador solo debe contener letras.");
      return;
    }
  }

  const tipoEntidadPagadora = document.getElementById("entidadPagadora").value;
  let entidadPagadoraEspecifica = null;

  if (tipoEntidadPagadora === "ARL" || tipoEntidadPagadora === "CCF") {
    entidadPagadoraEspecifica = document.getElementById("entidadEspecifica").value;
    if (!entidadPagadoraEspecifica) {
      alert("Debe seleccionar una entidad específica");
      return;
    }
  }

  const empresaId = document.getElementById("empresaUsuario").value;
  const subcontratistaId = document.getElementById("subcontratista").value;
  const subcontratistaIdFinal = (subcontratistaId && subcontratistaId !== 'null' && subcontratistaId.trim() !== '') ? parseInt(subcontratistaId) : null;

  email = email.toLowerCase();

  // === VALIDACIONES ===
  if (!cedula || !nombre || !vinculo || !sede || !tipoEntidadPagadora || !empresaId || !email || !telefono) {
    alert("Todos los campos obligatorios deben estar completos.");
    return;
  }
  
  if (!/^\d+$/.test(cedula)) {
    alert("La cédula debe contener solo números.");
    return;
  }
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ'\s]+$/.test(nombre)) {
    alert("El nombre solo debe contener letras.");
    return;
  }
 
  if (telefono && !/^\d+(-\d+)*$/.test(telefono)) {
    alert("El teléfono solo debe contener números, y puede usar un guion (-) para separar dos números.");
    return;
  }
  
  if (telefono && telefono.length > 30) {
    alert("El teléfono no puede superar los 30 caracteres.");
    return;
  }

  // Verificar duplicados
  if (!editingId) {
    const duplicadoCedula = cachedClients.some((c) => c.cedula === cedula);
    if (duplicadoCedula) {
      alert("⚠️ Ya existe un cliente registrado con esa cédula en esta modalidad");
      return;
    }
    
    const duplicadoEmail = cachedClients.some((c) => c.email === email);
    if (duplicadoEmail) {
      alert("⚠️ Ya existe un cliente registrado con ese email en esta modalidad");
      return;
    }
  } else {
    const duplicadoCedula = cachedClients.some((c) => c.cedula === cedula && c.id !== editingId);
    if (duplicadoCedula) {
      alert("⚠️ Ya existe otro cliente registrado con esa cédula en esta modalidad");
      return;
    }
    
    const duplicadoEmail = cachedClients.some((c) => c.email === email && c.id !== editingId);
    if (duplicadoEmail) {
      alert("⚠️ Ya existe otro cliente registrado con ese email en esta modalidad");
      return;
    }
  }

  // ✅ NUEVO: Incluir modalidad y datos de familiar trabajador en el objeto
  const nuevoCliente = {
    cedula,
    nombre,
    vinculo,
    cedula_trabajador: cedulaTrabajador, // ✅ NUEVO
    nombre_trabajador: nombreTrabajador, // ✅ NUEVO
    sede,
    tipo_entidad_pagadora: tipoEntidadPagadora,
    entidad_pagadora_especifica: entidadPagadoraEspecifica,
    empresa_id: parseInt(empresaId),
    subcontratista_id: subcontratistaIdFinal,
    email,
    telefono,
    sexo,   // ✅ NUEVO: Solo aplica para SVE
    cargo,  // ✅ NUEVO: Solo aplica para SVE
    modalidad, // ✅ NUEVO: Enviar modalidad al backend
    actividad: null,
    fecha: null,
    columna1: null,
    estado: null,
    contacto_emergencia_nombre: null,
    contacto_emergencia_parentesco: null,
    contacto_emergencia_telefono: null,
  };

  try {
    if (editingId) {
      const res = await fetch(`${API_URL}/${editingId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(nuevoCliente),
      });
      
      if (!res.ok) {
        // ✅ CORREGIDO: Leer el cuerpo como texto primero para no perder el mensaje
        const rawText = await res.text();
        let mensajeError = "Error al actualizar cliente";
        try {
          const errorData = JSON.parse(rawText);
          mensajeError = errorData.message || errorData.error || errorData.detail || mensajeError;
        } catch {
          if (rawText && rawText.length < 300) mensajeError = rawText;
        }
        alert(`⚠️ ${mensajeError}`);
      } else {
        alert("✅ Cliente actualizado exitosamente");
        editingId = null;
        form.reset();
        resetForm();
        loadClientsForCache();
      }
    } else {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(nuevoCliente),
      });
      
      if (!res.ok) {
        // ✅ CORREGIDO: Leer el cuerpo como texto primero para no perder el mensaje
        const rawText = await res.text();
        let mensajeError = "Ya existe un cliente registrado con esa cédula en esta modalidad";
        try {
          const errorData = JSON.parse(rawText);
          mensajeError = errorData.message || errorData.error || errorData.detail || mensajeError;
        } catch {
          // Usar mensaje amigable por defecto
        }
        alert(`⚠️ ${mensajeError}`);
      } else {
        alert("✅ Cliente registrado exitosamente");
        form.reset();
        resetForm();
        loadClientsForCache();
      }
    }
  } catch (err) {
    console.error("Error guardando cliente:", err);
    alert("No se pudo conectar con el servidor.");
  }
});

window.startEdit = async function (id) {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    if (!res.ok) {
      alert("Cliente no encontrado");
      return;
    }
    const client = await res.json();

    await loadClientsForCache();

    document.getElementById("cedula").value = client.cedula || "";
    document.getElementById("name").value = toTitleCase(client.nombre || ""); // ✅ Title Case
    document.getElementById("vinculo").value = client.vinculo || "";
    
    // ✅ Cargar datos de familiar trabajador en modo edición (sin abrir modal)
    if (client.vinculo === 'Familiar Trabajador') {
      const hCedula = document.getElementById("cedulaTrabajador");
      const hNombre = document.getElementById("nombreTrabajador");
      if (hCedula && client.cedula_trabajador) hCedula.value = client.cedula_trabajador;
      if (hNombre && client.nombre_trabajador) hNombre.value = client.nombre_trabajador;
      // Marcar vínculo con el check verde y marcar como confirmado
      document.getElementById("vinculo").classList.add("vinculo-con-familiar");
      familiarConfirmado = true;
    }
    
    if (client.sede) {
      sedeSelector.setValue(client.sede, client.sede);
    }
    
    if (client.tipo_entidad_pagadora) {
      document.getElementById("entidadPagadora").value = client.tipo_entidad_pagadora;
      
      const event = new Event('change');
      document.getElementById("entidadPagadora").dispatchEvent(event);
      
      if (client.entidad_pagadora_especifica) {
        setTimeout(() => {
          if (entidadEspecificaSelector) {
            entidadEspecificaSelector.setValue(
              client.entidad_pagadora_especifica,
              client.entidad_pagadora_especifica
            );
          }
        }, 100);
      }
    }
    
    if (client.empresa_id && empresaSelector) {
      const empresas = empresaSelector.options;
      const empresaEncontrada = empresas.find(e => e.value === client.empresa_id);
      if (empresaEncontrada) {
        empresaSelector.setValue(empresaEncontrada.value, empresaEncontrada.text);
      }
    }
    
    if (client.subcontratista_id && subcontratistaSelector) {
      const subcontratistas = subcontratistaSelector.options;
      const subcontratistaEncontrado = subcontratistas.find(s => s.value === client.subcontratista_id);
      if (subcontratistaEncontrado) {
        subcontratistaSelector.setValue(subcontratistaEncontrado.value, subcontratistaEncontrado.text);
      }
    } else if (subcontratistaSelector) {
      subcontratistaSelector.setValue(null, 'No Aplica');
    }
    
    document.getElementById("email").value = client.email || "";
    document.getElementById("phone").value = client.telefono || "";

    // ✅ NUEVO: Cargar campos SVE si la modalidad corresponde
    const modalidadEditSVE = localStorage.getItem('modalidadSeleccionada');
    if (modalidadEditSVE === 'Sistema de Vigilancia Epidemiológica') {
      const sexoInput = document.getElementById("sexo");
      const cargoInput = document.getElementById("cargo");
      if (sexoInput && client.sexo) sexoInput.value = client.sexo;
      if (cargoInput && client.cargo) cargoInput.value = client.cargo;
    }

    editingId = id;
    form.querySelector("button[type='submit']").textContent = "Guardar cambios";
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";
    
  } catch (err) {
    console.error("Error al cargar cliente para editar:", err);
    alert("Error al obtener datos de cliente");
  }
};

function setupCancelarEdicion() {
  const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
  
  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", function() {
      if (confirm("¿Estás seguro de descartar los cambios?\n\nLos datos del formulario se limpiarán y volverás al modo de registro.")) {
        form.reset();
        resetForm();
        alert("✅ Cambios descartados. Formulario listo para nuevo registro.");
      }
    });
  }
}

// ============================================
// ✅ NUEVO: Botón Agendar Cita
// ============================================
function setupBotonAgendarCita() {
  const btnAgendarCita = document.getElementById('btnAgendarCita');
  
  if (btnAgendarCita) {
    btnAgendarCita.addEventListener('click', function() {
      // Verificar que haya una modalidad seleccionada antes de ir a agendamiento
      const modalidadSeleccionada = localStorage.getItem('modalidadSeleccionada');
      
      if (!modalidadSeleccionada) {
        alert('⚠️ Debes seleccionar una modalidad antes de agendar citas');
        window.location.href = 'modalidad.html';
        return;
      }
      
      // Redirigir a la página de agendamiento
      window.location.href = 'agendamiento.html';
    });
  }
}