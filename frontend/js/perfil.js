// frontend/js/perfil.js
// Script para manejar el perfil del usuario y gestión de usuarios (admin)

(function() {
  const API_URL = window.API_CONFIG.BASE_URL + "/api";
  
  // Elementos del DOM - Perfil
  const btnBack = document.getElementById("btnBack");
  const avatarImage = document.getElementById("avatarImage");
  const avatarPlaceholder = document.getElementById("avatarPlaceholder");
  const uploadAvatar = document.getElementById("uploadAvatar");
  const userCedula = document.getElementById("userCedula");
  const userNombre = document.getElementById("userNombre");
  const userEmail = document.getElementById("userEmail");
  const userRol = document.getElementById("userRol");
  const rolBadge = document.getElementById("rolBadge");
  
  // Modal de contraseña
  const modalPassword = document.getElementById("modalPassword");
  const btnChangePassword = document.getElementById("btnChangePassword");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnCancelModal = document.getElementById("btnCancelModal");
  const formPassword = document.getElementById("formPassword");
  
  // Gestión de usuarios (admin)
  const usersManagementSection = document.getElementById("usersManagementSection");
  const btnAddUser = document.getElementById("btnAddUser");
  const loadingUsers = document.getElementById("loadingUsers");
  const usersTableContent = document.getElementById("usersTableContent");
  
  // Modal de usuario
  const modalUser = document.getElementById("modalUser");
  const btnCloseUserModal = document.getElementById("btnCloseUserModal");
  const btnCancelUserModal = document.getElementById("btnCancelUserModal");
  const formUser = document.getElementById("formUser");
  const modalUserTitle = document.getElementById("modalUserTitle");
  const btnSaveUser = document.getElementById("btnSaveUser");
  const passwordFieldContainer = document.getElementById("passwordFieldContainer");
  
  // Modal de cambio de contraseña por admin
  const modalAdminPassword = document.getElementById("modalAdminPassword");
  const btnCloseAdminPasswordModal = document.getElementById("btnCloseAdminPasswordModal");
  const btnCancelAdminPasswordModal = document.getElementById("btnCancelAdminPasswordModal");
  const formAdminPassword = document.getElementById("formAdminPassword");
  const adminPasswordUserName = document.getElementById("adminPasswordUserName");
  
  // Variable para controlar modo edición
  let editingUserId = null;
  let changingPasswordUserId = null;
  
  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  function init() {
    cargarDatosUsuario();
    cargarAvatar();
    configurarEventos();
    verificarPermisosAdmin();
  }
  
  // ============================================
  // VERIFICAR SI ES ADMIN
  // ============================================
  
  function verificarPermisosAdmin() {
    const userData = getUserData();
    
    if (userData && userData.rol === 'admin') {
      // Mostrar sección de gestión de usuarios
      if (usersManagementSection) {
        usersManagementSection.style.display = 'block';
      }
      // Cargar lista de usuarios
      cargarUsuarios();
    }
  }
  
  // ============================================
  // CARGAR DATOS DEL USUARIO
  // ============================================
  
  function cargarDatosUsuario() {
    const userData = getUserData();
    
    if (!userData) {
      console.error("No se encontraron datos del usuario");
      return;
    }
    
    // Actualizar datos en la interfaz
    userCedula.textContent = userData.cedula || "-";
    userNombre.textContent = userData.nombre || "-";
    userEmail.textContent = userData.email || "-";
    rolBadge.textContent = userData.rol || "-";
    
    // Aplicar color al badge según el rol
    aplicarColorRol(userData.rol);
  }
  
  // Aplicar color al badge según el rol
  function aplicarColorRol(rol) {
    const badge = document.querySelector(".role-badge");
    
    if (!badge) return;
    
    // Colores según el rol
    const colores = {
      "admin": "linear-gradient(135deg, #e74c3c, #c0392b)",
      "usuario": "linear-gradient(135deg, #3498db, #2980b9)",
      "profesional": "linear-gradient(135deg, #27ae60, #229954)",
      "moderador": "linear-gradient(135deg, #f39c12, #e67e22)"
    };
    
    const rolLower = rol ? rol.toLowerCase() : "";
    badge.style.background = colores[rolLower] || "linear-gradient(135deg, #667eea, #764ba2)";
  }
  
  // ============================================
  // MANEJO DE AVATAR
  // ============================================
  
  function cargarAvatar() {
    const userData = getUserData();
    if (!userData || !userData.id) return;
    
    // Cargar avatar específico del usuario usando su ID
    const avatarKey = `userAvatar_${userData.id}`;
    const avatarData = localStorage.getItem(avatarKey);
    
    if (avatarData) {
      avatarImage.src = avatarData;
      avatarImage.classList.add("active");
      avatarPlaceholder.classList.add("hidden");
    }
  }
  
  function guardarAvatar(imageData) {
    const userData = getUserData();
    if (!userData || !userData.id) {
      console.error("No se puede guardar el avatar sin ID de usuario");
      return;
    }
    
    // Guardar avatar con el ID del usuario
    const avatarKey = `userAvatar_${userData.id}`;
    localStorage.setItem(avatarKey, imageData);
  }
  
  // ============================================
  // GESTIÓN DE USUARIOS - CARGAR LISTA
  // ============================================
  
  async function cargarUsuarios() {
    if (!loadingUsers || !usersTableContent) return;
    
    loadingUsers.style.display = 'flex';
    usersTableContent.innerHTML = '';
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }
      
      const data = await response.json();
      
      if (data.success && data.users) {
        renderizarTablaUsuarios(data.users);
      }
      
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      usersTableContent.innerHTML = `
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <p>Error al cargar la lista de usuarios</p>
        </div>
      `;
    } finally {
      loadingUsers.style.display = 'none';
    }
  }
  
  // ============================================
  // RENDERIZAR TABLA DE USUARIOS
  // ============================================
  
  function renderizarTablaUsuarios(users) {
    if (!users || users.length === 0) {
      usersTableContent.innerHTML = `
        <div class="no-users-message">
          <span class="no-users-icon">🔭</span>
          <p>No hay usuarios registrados</p>
        </div>
      `;
      return;
    }
    
    // Ordenar usuarios: administradores primero, luego profesionales
    const usuariosOrdenados = [...users].sort((a, b) => {
      const rolPrioridad = { 'admin': 1, 'profesional': 2 };
      const prioridadA = rolPrioridad[a.rol.toLowerCase()] || 3;
      const prioridadB = rolPrioridad[b.rol.toLowerCase()] || 3;
      
      if (prioridadA !== prioridadB) {
        return prioridadA - prioridadB;
      }
      
      // Si tienen el mismo rol, ordenar alfabéticamente por nombre
      return a.nombre.localeCompare(b.nombre);
    });
    
    const currentUserId = getUserData()?.id;
    
    const tableHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>Cédula</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuariosOrdenados.map(user => {
            const isCurrentUser = user.id === currentUserId;
            const estadoClass = user.activo ? 'activo' : 'inactivo';
            const estadoText = user.activo ? '✅ Activo' : '❌ Inactivo';
            const rolClass = user.rol.toLowerCase();
            const disabledSelf = isCurrentUser ? 'disabled' : '';
            
            return `
              <tr class="user-row ${!user.activo ? 'user-inactive' : ''}">
                <td>${user.cedula}</td>
                <td>
                  ${user.nombre}
                  ${isCurrentUser ? '<span class="badge-you">(Tú)</span>' : ''}
                </td>
                <td>${user.email}</td>
                <td><span class="badge-rol badge-${rolClass}">${user.rol}</span></td>
                <td><span class="badge-estado badge-${estadoClass}">${estadoText}</span></td>
                <td class="actions-cell">
                  <button class="btn-action btn-edit" onclick="window.editarUsuario(${user.id})" title="Editar">
                    ✏️
                  </button>
                  <button class="btn-action btn-change-pwd" onclick="window.abrirModalCambiarPasswordUsuario(${user.id}, '${user.nombre}')" title="Cambiar Contraseña">
                    🔑
                  </button>
                  <button class="btn-action btn-toggle ${disabledSelf}" 
                          onclick="window.toggleUsuarioEstado(${user.id}, ${user.activo})" 
                          title="${user.activo ? 'Desactivar' : 'Activar'}"
                          ${isCurrentUser ? 'disabled' : ''}>
                    ${user.activo ? '🔒' : '🔓'}
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    usersTableContent.innerHTML = tableHTML;
  }
  
  // ============================================
  // CONFIGURAR EVENTOS
  // ============================================
  
  function configurarEventos() {
    // Botón volver
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    }
    
    // Upload de avatar
    if (uploadAvatar) {
      uploadAvatar.addEventListener("change", handleAvatarUpload);
    }
    
    // Modal de contraseña
    if (btnChangePassword) {
      btnChangePassword.addEventListener("click", abrirModalPassword);
    }
    
    if (btnCloseModal) {
      btnCloseModal.addEventListener("click", cerrarModalPassword);
    }
    
    if (btnCancelModal) {
      btnCancelModal.addEventListener("click", cerrarModalPassword);
    }
    
    // Cerrar modal al hacer clic fuera
    if (modalPassword) {
      modalPassword.addEventListener("click", (e) => {
        if (e.target === modalPassword) {
          cerrarModalPassword();
        }
      });
    }
    
    // Form de cambio de contraseña
    if (formPassword) {
      formPassword.addEventListener("submit", handleChangePassword);
    }
    
    // Gestión de usuarios - Botón agregar
    if (btnAddUser) {
      btnAddUser.addEventListener("click", abrirModalNuevoUsuario);
    }
    
    // Modal de usuario
    if (btnCloseUserModal) {
      btnCloseUserModal.addEventListener("click", cerrarModalUsuario);
    }
    
    if (btnCancelUserModal) {
      btnCancelUserModal.addEventListener("click", cerrarModalUsuario);
    }
    
    if (modalUser) {
      modalUser.addEventListener("click", (e) => {
        if (e.target === modalUser) {
          cerrarModalUsuario();
        }
      });
    }
    
    // Form de usuario
    if (formUser) {
      formUser.addEventListener("submit", handleGuardarUsuario);
    }
    
    // Modal de cambio de contraseña por admin
    if (btnCloseAdminPasswordModal) {
      btnCloseAdminPasswordModal.addEventListener("click", cerrarModalAdminPassword);
    }
    
    if (btnCancelAdminPasswordModal) {
      btnCancelAdminPasswordModal.addEventListener("click", cerrarModalAdminPassword);
    }
    
    if (modalAdminPassword) {
      modalAdminPassword.addEventListener("click", (e) => {
        if (e.target === modalAdminPassword) {
          cerrarModalAdminPassword();
        }
      });
    }
    
    // Form de cambio de contraseña por admin
    if (formAdminPassword) {
      formAdminPassword.addEventListener("submit", handleAdminChangePassword);
    }
    
    // Botones de toggle password (ojitos)
    configurarTogglePassword();
  }
  
  // ============================================
  // MODAL DE USUARIO - ABRIR/CERRAR
  // ============================================
  
  function abrirModalNuevoUsuario() {
    editingUserId = null;
    modalUserTitle.innerHTML = '➕ Registrar Usuario';
    btnSaveUser.textContent = 'Registrar Usuario';
    formUser.reset();
    
    // Mostrar campo de contraseña
    passwordFieldContainer.style.display = 'block';
    document.getElementById('userFormPassword').required = true;
    
    // Deshabilitar campo cédula (para nuevo usuario no)
    document.getElementById('userFormCedula').readOnly = false;
    
    modalUser.classList.add('show');
  }
  
  function cerrarModalUsuario() {
    modalUser.classList.remove('show');
    editingUserId = null;
    formUser.reset();
  }
  
  // ============================================
  // EDITAR USUARIO
  // ============================================
  
  window.editarUsuario = async function(userId) {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al obtener usuarios');
      
      const data = await response.json();
      const user = data.users.find(u => u.id === userId);
      
      if (!user) {
        mostrarMensaje('Usuario no encontrado', 'error');
        return;
      }
      
      // Configurar modo edición
      editingUserId = userId;
      modalUserTitle.innerHTML = '✏️ Editar Usuario';
      btnSaveUser.textContent = 'Actualizar Usuario';
      
      // Llenar formulario
      document.getElementById('userFormCedula').value = user.cedula;
      document.getElementById('userFormCedula').readOnly = true; // No permitir cambiar cédula
      document.getElementById('userFormNombre').value = user.nombre;
      document.getElementById('userFormEmail').value = user.email;
      document.getElementById('userFormRol').value = user.rol;
      
      // Ocultar campo de contraseña en edición
      passwordFieldContainer.style.display = 'none';
      document.getElementById('userFormPassword').required = false;
      
      modalUser.classList.add('show');
      
    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje('Error al cargar datos del usuario', 'error');
    }
  };
  
  // ============================================
  // GUARDAR USUARIO (CREAR O ACTUALIZAR)
  // ============================================
  
  async function handleGuardarUsuario(e) {
    e.preventDefault();
    
    const cedula = document.getElementById('userFormCedula').value.trim();
    const nombre = document.getElementById('userFormNombre').value.trim();
    const email = document.getElementById('userFormEmail').value.trim();
    const password = document.getElementById('userFormPassword').value;
    const rol = document.getElementById('userFormRol').value;
    
    // Validaciones
    if (!cedula || !nombre || !email || !rol) {
      mostrarMensaje('Todos los campos son obligatorios', 'error');
      return;
    }
    
    if (!/^\d+$/.test(cedula)) {
      mostrarMensaje('La cédula debe contener solo números', 'error');
      return;
    }
    
    if (!editingUserId && (!password || password.length < 6)) {
      mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    
    const token = getAuthToken();
    btnSaveUser.disabled = true;
    btnSaveUser.textContent = editingUserId ? 'Actualizando...' : 'Registrando...';
    
    try {
      let response;
      
      if (editingUserId) {
        // Actualizar usuario existente
        response = await fetch(`${API_URL}/auth/users/${editingUserId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nombre, email, rol })
        });
      } else {
        // Crear nuevo usuario
        response = await fetch(`${API_URL}/auth/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ cedula, nombre, email, password, rol })
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error al guardar usuario');
      }
      
      if (data.success) {
        mostrarMensaje(data.message, 'success');
        cerrarModalUsuario();
        cargarUsuarios();
      }
      
    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje(error.message || 'Error al guardar usuario', 'error');
    } finally {
      btnSaveUser.disabled = false;
      btnSaveUser.textContent = editingUserId ? 'Actualizar Usuario' : 'Registrar Usuario';
    }
  }
  
  // ============================================
  // ACTIVAR/DESACTIVAR USUARIO
  // ============================================
  
  window.toggleUsuarioEstado = async function(userId, estadoActual) {
    const accion = estadoActual ? 'desactivar' : 'activar';
    const mensaje = estadoActual 
      ? '¿Desactivar este usuario? No podrá iniciar sesión.' 
      : '¿Activar este usuario? Podrá iniciar sesión nuevamente.';
    
    if (!confirm(mensaje)) return;
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/auth/users/${userId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Error al ${accion} usuario`);
      }
      
      if (data.success) {
        mostrarMensaje(data.message, 'success');
        cargarUsuarios();
      }
      
    } catch (error) {
      console.error('Error:', error);
      mostrarMensaje(error.message || `Error al ${accion} usuario`, 'error');
    }
  };
  
  // ============================================
  // MODAL DE CAMBIO DE CONTRASEÑA POR ADMIN
  // ============================================
  
  window.abrirModalCambiarPasswordUsuario = function(userId, userName) {
    changingPasswordUserId = userId;
    adminPasswordUserName.textContent = userName;
    formAdminPassword.reset();
    modalAdminPassword.classList.add('show');
  };
  
  function cerrarModalAdminPassword() {
    modalAdminPassword.classList.remove('show');
    changingPasswordUserId = null;
    formAdminPassword.reset();
  }
  
  async function handleAdminChangePassword(e) {
    e.preventDefault();
    
    if (!changingPasswordUserId) {
      mostrarMensaje("Error: No se ha seleccionado un usuario", "error");
      return;
    }
    
    const newPassword = document.getElementById("adminNewPassword").value;
    const confirmPassword = document.getElementById("adminConfirmPassword").value;
    
    if (!newPassword || !confirmPassword) {
      mostrarMensaje("Por favor completa todos los campos", "error");
      return;
    }
    
    if (newPassword.length < 6) {
      mostrarMensaje("La nueva contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      mostrarMensaje("Las contraseñas no coinciden", "error");
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      mostrarMensaje("No se encontró sesión activa", "error");
      return;
    }
    
    try {
      const btnSubmit = formAdminPassword.querySelector('button[type="submit"]');
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Actualizando...";
      
      const response = await fetch(`${API_URL}/auth/admin/change-user-password/${changingPasswordUserId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Error al cambiar la contraseña del usuario");
      }
      
      if (data.success) {
        mostrarMensaje("Contraseña del usuario actualizada correctamente", "success");
        cerrarModalAdminPassword();
      } else {
        throw new Error(data.message || "Error al cambiar la contraseña del usuario");
      }
      
    } catch (error) {
      console.error("Error:", error);
      mostrarMensaje(error.message || "Error al cambiar la contraseña del usuario", "error");
    } finally {
      const btnSubmit = formAdminPassword.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Cambiar Contraseña";
      }
    }
  }
  
  // ============================================
  // TOGGLE PASSWORD VISIBILITY
  // ============================================
  
  function configurarTogglePassword() {
    const toggleButtons = document.querySelectorAll(".btn-toggle-password");
    
    toggleButtons.forEach(button => {
      button.addEventListener("click", function() {
        const targetId = this.getAttribute("data-target");
        const input = document.getElementById(targetId);
        const eyeIcon = this.querySelector(".eye-icon");
        
        if (input.type === "password") {
          input.type = "text";
          eyeIcon.textContent = "🙈";
          this.classList.add("active");
        } else {
          input.type = "password";
          eyeIcon.textContent = "👁️";
          this.classList.remove("active");
        }
      });
    });
  }
  
  // ============================================
  // MANEJO DE SUBIDA DE AVATAR
  // ============================================
  
  function handleAvatarUpload(e) {
    const file = e.target.files[0];
    
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5MB");
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(event) {
      const imageData = event.target.result;
      avatarImage.src = imageData;
      avatarImage.classList.add("active");
      avatarPlaceholder.classList.add("hidden");
      guardarAvatar(imageData);
      mostrarMensaje("Foto de perfil actualizada correctamente", "success");
    };
    
    reader.onerror = function() {
      alert("Error al cargar la imagen. Por favor intenta de nuevo.");
    };
    
    reader.readAsDataURL(file);
  }
  
  // ============================================
  // MODAL DE CONTRASEÑA
  // ============================================
  
  function abrirModalPassword() {
    if (modalPassword) {
      modalPassword.classList.add("show");
      if (formPassword) {
        formPassword.reset();
      }
    }
  }
  
  function cerrarModalPassword() {
    if (modalPassword) {
      modalPassword.classList.remove("show");
    }
  }
  
  // ============================================
  // CAMBIO DE CONTRASEÑA
  // ============================================
  
  async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      mostrarMensaje("Por favor completa todos los campos", "error");
      return;
    }
    
    if (newPassword.length < 6) {
      mostrarMensaje("La nueva contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      mostrarMensaje("Las contraseñas no coinciden", "error");
      return;
    }
    
    if (currentPassword === newPassword) {
      mostrarMensaje("La nueva contraseña debe ser diferente a la actual", "error");
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      mostrarMensaje("No se encontró sesión activa", "error");
      return;
    }
    
    try {
      const btnSubmit = formPassword.querySelector('button[type="submit"]');
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Actualizando...";
      
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Error al cambiar la contraseña");
      }
      
      if (data.success) {
        mostrarMensaje("Contraseña actualizada correctamente", "success");
        cerrarModalPassword();
        formPassword.reset();
      } else {
        throw new Error(data.message || "Error al cambiar la contraseña");
      }
      
    } catch (error) {
      console.error("Error:", error);
      mostrarMensaje(error.message || "Error al cambiar la contraseña", "error");
    } finally {
      const btnSubmit = formPassword.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Actualizar Contraseña";
      }
    }
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  
  function getUserData() {
    const userData = localStorage.getItem("userData");
    return userData ? JSON.parse(userData) : null;
  }
  
  function getAuthToken() {
    return localStorage.getItem("authToken");
  }
  
  function mostrarMensaje(mensaje, tipo = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${tipo}`;
    notification.textContent = mensaje;
    
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "16px 24px",
      borderRadius: "12px",
      color: "white",
      fontWeight: "600",
      fontSize: "14px",
      zIndex: "10000",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      animation: "slideInRight 0.3s ease",
      maxWidth: "400px"
    });
    
    if (tipo === "success") {
      notification.style.background = "linear-gradient(135deg, #27ae60, #229954)";
    } else if (tipo === "error") {
      notification.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)";
    } else {
      notification.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }
  
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  // ============================================
  // EJECUTAR AL CARGAR
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();