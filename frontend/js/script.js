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

// Esperar a que el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  initializeForm();
  loadClientsForCache();
  loadEmpresas(); // Cargar empresas desde la BD
  setupEntidadPagadoraDinamica(); // Configurar campo dinámico
  setupCancelarEdicion(); // Configurar botón cancelar edición
});

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
          document.getElementById("sede").value = clienteEncontrado.sede || "";
          
          // Cargar Entidad Pagadora
          if (clienteEncontrado.tipo_entidad_pagadora) {
            document.getElementById("entidadPagadora").value = clienteEncontrado.tipo_entidad_pagadora;
            
            // Disparar el evento change para cargar el segundo select si es ARL o CCF
            const event = new Event('change');
            document.getElementById("entidadPagadora").dispatchEvent(event);
            
            // Después de cargar las opciones, seleccionar la específica
            if (clienteEncontrado.entidad_pagadora_especifica) {
              setTimeout(() => {
                document.getElementById("entidadEspecifica").value = clienteEncontrado.entidad_pagadora_especifica;
              }, 100);
            }
          }
          
          document.getElementById("empresaUsuario").value = clienteEncontrado.empresa_id || "";
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
          document.getElementById("name").value = "";
          document.getElementById("vinculo").value = "";
          document.getElementById("sede").value = "";
          document.getElementById("entidadPagadora").value = "";
          document.getElementById("entidadEspecifica").value = "";
          document.getElementById("entidadEspecificaContainer").style.display = "none";
          document.getElementById("empresaUsuario").value = "";
          document.getElementById("email").value = "";
          document.getElementById("phone").value = "";
          
          editingId = null;
          form.querySelector("button[type='submit']").textContent = "Registrar Cliente";
          
          // Ocultar botón "Descartar cambios"
          document.getElementById("btnCancelarEdicion").style.display = "none";
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
    startEdit(parseInt(editId)); // IMPORTANTE: Convertir a número
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// === CONFIGURACIÓN DEL CAMPO DINÁMICO "ENTIDAD PAGADORA" ===
function setupEntidadPagadoraDinamica() {
  const selectTipo = document.getElementById("entidadPagadora");
  const containerEspecifica = document.getElementById("entidadEspecificaContainer");
  const selectEspecifica = document.getElementById("entidadEspecifica");
  const labelEspecifica = document.getElementById("labelEntidadEspecifica");

  selectTipo.addEventListener("change", function() {
    const tipoSeleccionado = this.value;

    // Limpiar select específica
    selectEspecifica.innerHTML = '<option value="">Seleccione...</option>';

    if (tipoSeleccionado === "Particular") {
      // Si es Particular, ocultar el segundo campo
      containerEspecifica.style.display = "none";
      selectEspecifica.removeAttribute("required");
      selectEspecifica.value = "";
    } else if (tipoSeleccionado === "ARL" || tipoSeleccionado === "CCF") {
      // Mostrar el segundo campo y cargar opciones
      containerEspecifica.style.display = "block";
      selectEspecifica.setAttribute("required", "required");
      
      // Cambiar el label según el tipo
      labelEspecifica.textContent = `Seleccione ${tipoSeleccionado}: `;
      
      // Cargar las opciones correspondientes
      const opciones = ENTIDADES[tipoSeleccionado];
      opciones.forEach(entidad => {
        const option = document.createElement("option");
        option.value = entidad;
        option.textContent = entidad;
        selectEspecifica.appendChild(option);
      });
    } else {
      // Si no hay selección, ocultar
      containerEspecifica.style.display = "none";
      selectEspecifica.removeAttribute("required");
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
    const selectEmpresa = document.getElementById("empresaUsuario");
    
    // Limpiar opciones existentes (excepto la primera)
    selectEmpresa.innerHTML = '<option value="">Seleccione...</option>';
    
    // Agregar opciones dinámicamente
    empresas.forEach(empresa => {
      const option = document.createElement("option");
      option.value = empresa.id;
      option.textContent = empresa.cliente_final;
      selectEmpresa.appendChild(option);
    });
    
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

  // Objeto con TODOS los datos (personales + entidad pagadora + empresa)
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
    // Campos de consulta/seguimiento en NULL (para uso futuro)
    actividad: null,
    modalidad: null,
    fecha: null,
    columna1: null,
    estado: null,
    // Contacto de emergencia en NULL (se registra desde consulta.html)
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
        document.getElementById("entidadEspecificaContainer").style.display = "none";
        form.querySelector("button[type='submit']").textContent = "Registrar Cliente";
        
        // Ocultar botón "Descartar cambios"
        document.getElementById("btnCancelarEdicion").style.display = "none";
        
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
        document.getElementById("entidadEspecificaContainer").style.display = "none";
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

    // IMPORTANTE: Actualizar el cache antes de editar
    await loadClientsForCache();

    // Llenamos los campos de DATOS PERSONALES
    document.getElementById("cedula").value = client.cedula || "";
    document.getElementById("name").value = client.nombre || "";
    document.getElementById("vinculo").value = client.vinculo || "";
    document.getElementById("sede").value = client.sede || "";
    
    // Cargar Entidad Pagadora
    if (client.tipo_entidad_pagadora) {
      document.getElementById("entidadPagadora").value = client.tipo_entidad_pagadora;
      
      // Disparar el evento change para cargar el segundo select si es ARL o CCF
      const event = new Event('change');
      document.getElementById("entidadPagadora").dispatchEvent(event);
      
      // Después de cargar las opciones, seleccionar la específica
      if (client.entidad_pagadora_especifica) {
        setTimeout(() => {
          document.getElementById("entidadEspecifica").value = client.entidad_pagadora_especifica;
        }, 100);
      }
    }
    
    document.getElementById("empresaUsuario").value = client.empresa_id || "";
    document.getElementById("email").value = client.email || "";
    document.getElementById("phone").value = client.telefono || "";

    editingId = id;
    form.querySelector("button[type='submit']").textContent = "Guardar cambios";
    
    // Mostrar botón "Descartar cambios"
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";
    
    console.log("Modo edición activado. ID:", editingId); // Debug
  } catch (err) {
    console.error("Error al cargar cliente para editar:", err);
    alert("Error al obtener datos de cliente");
  }
};

// ============================================
// CONFIGURAR BOTÓN "DESCARTAR CAMBIOS"
// ============================================
function setupCancelarEdicion() {
  const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
  
  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", function() {
      // Confirmar antes de descartar
      if (confirm("¿Estás seguro de descartar los cambios?\n\nLos datos del formulario se limpiarán y volverás al modo de registro.")) {
        // Limpiar formulario
        form.reset();
        
        // Ocultar campo específico de entidad pagadora
        document.getElementById("entidadEspecificaContainer").style.display = "none";
        
        // Resetear modo edición
        editingId = null;
        
        // Cambiar texto del botón submit
        form.querySelector("button[type='submit']").textContent = "Registrar Cliente";
        
        // Ocultar botón "Descartar cambios"
        btnCancelarEdicion.style.display = "none";
        
        // Opcionalmente, redirigir a clientes.html
        // window.location.href = "clientes.html";
        
        alert("✅ Cambios descartados. Formulario listo para nuevo registro.");
      }
    });
  }
}