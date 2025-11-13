// frontend/js/auth-check.js
// Script para proteger páginas que requieren autenticación

(function() {
  const API_URL = window.API_CONFIG.ENDPOINTS.AUTH.VERIFY.replace('/verify', '');
  
  // Verificar autenticación al cargar la página
  async function checkAuth() {
    const token = localStorage.getItem("authToken");
    
    if (!token) {
      redirectToLogin();
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/verify`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Token inválido");
      }
      
      const data = await response.json();
      
      if (!data.success) {
        clearAuth();
        redirectToLogin();
        return;
      }
      
      // Token válido, actualizar datos del usuario
      localStorage.setItem("userData", JSON.stringify(data.user));
      
      // Mostrar información del usuario
      displayUserInfo(data.user);
      
    } catch (err) {
      console.error("Error verificando autenticación:", err);
      clearAuth();
      redirectToLogin();
    }
  }
  
  // Redireccionar a login
  function redirectToLogin() {
    if (window.location.pathname !== "/login.html" && !window.location.pathname.includes("login.html")) {
      console.log("Redirigiendo a login...");
      window.location.href = "login.html";
    }
  }
  
  // Limpiar datos de autenticación
  function clearAuth() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
  }
  
  // Mostrar información del usuario en la página
  function displayUserInfo(user) {
    const userInfoElement = document.getElementById("userInfo");
    
    if (!userInfoElement) {
      console.warn("Elemento userInfo no existe en el DOM");
      return;
    }
    
    if (!user) {
      console.warn("No hay datos de usuario");
      return;
    }
    
    // Mostrar el elemento y actualizar contenido
    userInfoElement.style.display = "flex";
    userInfoElement.innerHTML = `
      <div class="user-left-section">
        <span class="user-name"> ${user.nombre}</span>
        <button type="button" id="btnMiPerfil" class="btn-mi-perfil">
          👤 Mi Perfil
        </button>
      </div>
      <button id="btnLogout" class="btn-logout">Cerrar sesión</button>
    `;
    
    // Agregar evento de logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", logout);
    }
    
    // Agregar evento al botón Mi Perfil
    const btnMiPerfil = document.getElementById("btnMiPerfil");
    if (btnMiPerfil) {
      btnMiPerfil.addEventListener("click", abrirMiPerfil);
    }
  }
  
  // Función para abrir Mi Perfil
  function abrirMiPerfil() {
    window.location.href = "perfil.html";
  }
  
  // Función de logout
  async function logout() {
    if (!confirm("¿Estás seguro que deseas cerrar sesión?")) {
      return;
    }
    
    const token = localStorage.getItem("authToken");
    
    // Llamar al endpoint de logout (opcional)
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Error en logout:", err);
    }
    
    // Limpiar localStorage
    clearAuth();
    
    // Redireccionar a login
    window.location.href = "login.html";
  }
  
  // Función para obtener el token (útil para otras llamadas)
  window.getAuthToken = function() {
    return localStorage.getItem("authToken");
  };
  
  // Función para obtener datos del usuario
  window.getUserData = function() {
    const userData = localStorage.getItem("userData");
    return userData ? JSON.parse(userData) : null;
  };
  
  // Función de logout global
  window.logout = logout;
  
  // Ejecutar verificación cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
})();