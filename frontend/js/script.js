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
    
    this.init();
  }

  init() {
    // Evento al escribir en el input
    this.input.addEventListener('input', () => this.filterOptions());
    
    // Evento al hacer clic en el input o en la flecha (abrir dropdown)
    const wrapper = this.input.closest('.searchable-select-wrapper');
    const trigger = wrapper.querySelector('.searchable-select-trigger');
    
    trigger.addEventListener('mousedown', (e) => {
      e.preventDefault();      // Evita que el input reciba focus antes de tiempo
      e.stopPropagation();     // Evita que el evento llegue al document y cierre el dropdown

  if (this.dropdown.style.display === 'block') {
    // Si ya está abierto, lo cerramos
    this.hideDropdown();
    this.input.setAttribute('readonly', 'readonly');
  } else {
    // Abrir correctamente
    this.input.removeAttribute('readonly');
    this.input.focus();        // Enfocar el input manualmente
    this.filterOptions();      // Actualizar lista filtrada
    this.showDropdown();       // Mostrar el dropdown
  }
  });

    
    // Evento al hacer focus en el input (habilitar escritura)
    this.input.addEventListener('focus', () => {
      this.input.removeAttribute('readonly');
      this.filterOptions();
      this.showDropdown();
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        this.hideDropdown();
        this.input.setAttribute('readonly', 'readonly');
      }
    });
    
    // Navegación con teclado
    this.input.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  filterOptions() {
    const searchTerm = this.input.value.toLowerCase().trim();
    
    this.filteredOptions = this.options.filter(option => {
      const text = this.displayFn(option).toLowerCase();
      return text.includes(searchTerm);
    });
    
    this.selectedIndex = -1;
    this.renderDropdown();
  }

  renderDropdown() {
    this.dropdown.innerHTML = '';
    
    if (this.filteredOptions.length === 0) {
      this.dropdown.innerHTML = '<div class="searchable-option no-results">No se encontraron resultados</div>';
      this.showDropdown();
      return;
    }
    
    this.filteredOptions.forEach((option, index) => {
      const div = document.createElement('div');
      div.className = 'searchable-option';
      div.textContent = this.displayFn(option);
      div.dataset.index = index;
      
      div.addEventListener('click', () => {
        this.selectOption(option);
      });
      
      this.dropdown.appendChild(div);
    });
    
    this.showDropdown();
  }

  selectOption(option) {
    const displayText = this.displayFn(option);
    const value = this.valueFn(option);
    
    this.input.value = displayText;
    this.hidden.value = value;
    this.hideDropdown();
    this.input.setAttribute('readonly', 'readonly');
    
    // Disparar evento change en el campo oculto
    const event = new Event('change', { bubbles: true });
    this.hidden.dispatchEvent(event);
  }

  handleKeyboard(e) {
    const options = this.dropdown.querySelectorAll('.searchable-option:not(.no-results)');
    
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
      if (this.selectedIndex >= 0 && options[this.selectedIndex]) {
        const index = parseInt(options[this.selectedIndex].dataset.index);
        this.selectOption(this.filteredOptions[index]);
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
  }

  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.selectedIndex = -1;
    this.input.setAttribute('readonly', 'readonly');
  }

  setOptions(newOptions) {
    this.options = newOptions;
    this.filteredOptions = [...newOptions];
    this.renderDropdown();
  }

  setValue(value, displayText) {
    this.hidden.value = value;
    this.input.value = displayText;
  }

  reset() {
    this.input.value = '';
    this.hidden.value = '';
    this.input.setAttribute('readonly', 'readonly');
    this.hideDropdown();
  }
}

// Variables globales para los selectores con búsqueda
let sedeSelector;
let empresaSelector;
let entidadEspecificaSelector;

// Esperar a que el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  initializeForm();
  loadClientsForCache();
  loadEmpresas(); // Cargar empresas desde la BD
  setupEntidadPagadoraDinamica(); // Configurar campo dinámico
  setupCancelarEdicion(); // Configurar botón cancelar edición
  initializeSearchableSelects(); // Inicializar selectores con búsqueda
});

function initializeSearchableSelects() {
  // Inicializar selector de Sede
  sedeSelector = new SearchableSelect(
    'sedeSearch',
    'sede',
    'sedeDropdown',
    SEDES
  );

  // El selector de Empresa Usuario se inicializará después de cargar las empresas
  // Ver función loadEmpresas()
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

      // Deshabilitar botón mientras busca
      btnBuscarCedula.disabled = true;
      btnBuscarCedula.textContent = "⏳";

      try {
        const res = await fetch(API_URL, {
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
          document.getElementById("name").value = clienteEncontrado.nombre || "";
          document.getElementById("vinculo").value = clienteEncontrado.vinculo || "";
          
          // Cargar Sede con el nuevo selector
          if (clienteEncontrado.sede) {
            sedeSelector.setValue(clienteEncontrado.sede, clienteEncontrado.sede);
          }
          
          // Cargar Entidad Pagadora
          if (clienteEncontrado.tipo_entidad_pagadora) {
            document.getElementById("entidadPagadora").value = clienteEncontrado.tipo_entidad_pagadora;
            
            // Disparar el evento change para cargar el segundo select si es ARL o CCF
            const event = new Event('change');
            document.getElementById("entidadPagadora").dispatchEvent(event);
            
            // Después de cargar las opciones, seleccionar la específica
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
          
          // Cargar Empresa Usuario
          if (clienteEncontrado.empresa_id && empresaSelector) {
            const empresas = empresaSelector.options;
            const empresaEncontrada = empresas.find(e => e.value === clienteEncontrado.empresa_id);
            if (empresaEncontrada) {
              empresaSelector.setValue(empresaEncontrada.value, empresaEncontrada.text);
            }
          }
          
          document.getElementById("email").value = clienteEncontrado.email || "";
          document.getElementById("phone").value = clienteEncontrado.telefono || "";

          // Marcar como edición
          editingId = clienteEncontrado.id;
          form.querySelector("button[type='submit']").textContent = "Guardar cambios";
          
          // Mostrar botón "Descartar cambios"
          document.getElementById("btnCancelarEdicion").style.display = "inline-block";

          alert("✅ Cliente encontrado. Los datos han sido cargados.");
        } else {
          alert("❌ No se encontró ningún cliente con esa cédula");
          
          // Limpiar campos excepto cédula
          resetForm();
        }
      } catch (err) {
        console.error("Error buscando cliente:", err);
        alert("Error de conexión al buscar cliente");
      } finally {
        // Reactivar botón
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
  sedeSelector.reset();
  document.getElementById("entidadPagadora").value = "";
  if (entidadEspecificaSelector) entidadEspecificaSelector.reset();
  document.getElementById("entidadEspecificaContainer").style.display = "none";
  if (empresaSelector) empresaSelector.reset();
  document.getElementById("email").value = "";
  document.getElementById("phone").value = "";
  
  editingId = null;
  form.querySelector("button[type='submit']").textContent = "Registrar Trabajador";
  document.getElementById("btnCancelarEdicion").style.display = "none";
}

// === CONFIGURACIÓN DEL CAMPO DINÁMICO "ENTIDAD PAGADORA" ===
function setupEntidadPagadoraDinamica() {
  const selectTipo = document.getElementById("entidadPagadora");
  const containerEspecifica = document.getElementById("entidadEspecificaContainer");

  selectTipo.addEventListener("change", function() {
    const tipoSeleccionado = this.value;

    if (tipoSeleccionado === "Particular") {
      // Si es Particular, ocultar el segundo campo
      containerEspecifica.style.display = "none";
      document.getElementById("entidadEspecifica").removeAttribute("required");
      if (entidadEspecificaSelector) entidadEspecificaSelector.reset();
    } else if (tipoSeleccionado === "ARL" || tipoSeleccionado === "CCF") {
      // Mostrar el segundo campo y cargar opciones
      containerEspecifica.style.display = "block";
      document.getElementById("entidadEspecifica").setAttribute("required", "required");
      
      // Cambiar el label según el tipo
      document.getElementById("labelEntidadEspecifica").innerHTML = `Seleccione ${tipoSeleccionado}: <span class="required">*</span>`;
      
      // Inicializar o actualizar el selector con búsqueda
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
      // Si no hay selección, ocultar
      containerEspecifica.style.display = "none";
      document.getElementById("entidadEspecifica").removeAttribute("required");
    }
  });
}

// Cargar empresas desde la BD
async function loadEmpresas() {
  try {
    const res = await fetch(window.API_CONFIG.ENDPOINTS.EMPRESAS, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      console.error("Error cargando empresas");
      return;
    }
    
    const empresas = await res.json();
    
    // Formatear empresas para el selector con búsqueda
    const empresasFormateadas = empresas.map(empresa => ({
      value: empresa.id,
      text: empresa.cliente_final
    }));
    
    // Inicializar selector de Empresa Usuario
    empresaSelector = new SearchableSelect(
      'empresaUsuarioSearch',
      'empresaUsuario',
      'empresaUsuarioDropdown',
      empresasFormateadas,
      (item) => item.text
    );
    
  } catch (err) {
    console.error("Error cargando empresas:", err);
  }
}

// Cargar clientes para cache (validación de duplicados)
async function loadClientsForCache() {
  try {
    const res = await fetch(API_URL, {
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

// Manejo único del submit (POST o PUT)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Captura de campos de DATOS PERSONALES
  const cedula = document.getElementById("cedula").value.trim();
  const nombre = document.getElementById("name").value.trim();
  const vinculo = document.getElementById("vinculo").value;
  const sede = document.getElementById("sede").value.trim();
  let email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("phone").value.trim();

  // Captura de Entidad Pagadora
  const tipoEntidadPagadora = document.getElementById("entidadPagadora").value;
  let entidadPagadoraEspecifica = null;

  if (tipoEntidadPagadora === "ARL" || tipoEntidadPagadora === "CCF") {
    entidadPagadoraEspecifica = document.getElementById("entidadEspecifica").value;
    if (!entidadPagadoraEspecifica) {
      alert("Debe seleccionar una entidad específica");
      return;
    }
  }

  // Captura de Empresa Usuario (solo el ID)
  const empresaId = document.getElementById("empresaUsuario").value;

  // Forzamos email a minúsculas
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
 
  if (telefono && !/^\d+$/.test(telefono)) {
    alert("El teléfono solo debe contener números.");
    return;
  }

  // Verificar duplicados antes de enviar
  if (!editingId) {
    // MODO CREACIÓN: Validar contra TODOS los clientes
    const duplicadoCedula = cachedClients.some((c) => c.cedula === cedula);
    if (duplicadoCedula) {
      alert("⚠️ Ya existe un cliente registrado con esa cédula");
      return;
    }
    
    const duplicadoEmail = cachedClients.some((c) => c.email === email);
    if (duplicadoEmail) {
      alert("⚠️ Ya existe un cliente registrado con ese email");
      return;
    }
  } else {
    // MODO EDICIÓN: Validar contra todos EXCEPTO el cliente actual
    const duplicadoCedula = cachedClients.some((c) => c.cedula === cedula && c.id !== editingId);
    if (duplicadoCedula) {
      alert("⚠️ Ya existe otro cliente registrado con esa cédula");
      return;
    }
    
    const duplicadoEmail = cachedClients.some((c) => c.email === email && c.id !== editingId);
    if (duplicadoEmail) {
      alert("⚠️ Ya existe otro cliente registrado con ese email");
      return;
    }
  }

  // Objeto con TODOS los datos
  const nuevoCliente = {
    cedula,
    nombre,
    vinculo,
    sede,
    tipo_entidad_pagadora: tipoEntidadPagadora,
    entidad_pagadora_especifica: entidadPagadoraEspecifica,
    empresa_id: parseInt(empresaId),
    email,
    telefono,
    actividad: null,
    modalidad: null,
    fecha: null,
    columna1: null,
    estado: null,
    contacto_emergencia_nombre: null,
    contacto_emergencia_parentesco: null,
    contacto_emergencia_telefono: null,
  };

  try {
    if (editingId) {
      // PUT - Actualizar cliente existente
      const res = await fetch(`${API_URL}/${editingId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(nuevoCliente),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Error desconocido" }));
        alert(`⚠️ ${errorData.message || "Error al actualizar cliente"}`);
      } else {
        alert("✅ Cliente actualizado exitosamente");
        editingId = null;
        form.reset();
        resetForm();
        loadClientsForCache();
      }
    } else {
      // POST - Crear nuevo cliente
      const res = await fetch(API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(nuevoCliente),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Error desconocido" }));
        alert(`⚠️ ${errorData.message || "Error al crear cliente"}`);
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

// Editar cliente
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

    // Actualizar el cache antes de editar
    await loadClientsForCache();

    // Llenar campos
    document.getElementById("cedula").value = client.cedula || "";
    document.getElementById("name").value = client.nombre || "";
    document.getElementById("vinculo").value = client.vinculo || "";
    
    // Cargar Sede
    if (client.sede) {
      sedeSelector.setValue(client.sede, client.sede);
    }
    
    // Cargar Entidad Pagadora
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
    
    // Cargar Empresa Usuario
    if (client.empresa_id && empresaSelector) {
      const empresas = empresaSelector.options;
      const empresaEncontrada = empresas.find(e => e.value === client.empresa_id);
      if (empresaEncontrada) {
        empresaSelector.setValue(empresaEncontrada.value, empresaEncontrada.text);
      }
    }
    
    document.getElementById("email").value = client.email || "";
    document.getElementById("phone").value = client.telefono || "";

    editingId = id;
    form.querySelector("button[type='submit']").textContent = "Guardar cambios";
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";
    
  } catch (err) {
    console.error("Error al cargar cliente para editar:", err);
    alert("Error al obtener datos de cliente");
  }
};

// Configurar botón "Descartar cambios"
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