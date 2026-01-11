// frontend/js/auth-check.js
// Script para proteger páginas que requieren autenticación

(function() {
  // ✅ CORREGIDO: Esperar a que window.API_CONFIG esté disponible
  function getAuthApiUrl() {
    if (window.API_CONFIG && window.API_CONFIG.ENDPOINTS && window.API_CONFIG.ENDPOINTS.AUTH) {
      return window.API_CONFIG.ENDPOINTS.AUTH.VERIFY.replace('/verify', '');
    }
    // Fallback en caso de que config.js no esté cargado
    return 'http://localhost:5000/api/auth';
  }
  
  // Verificar autenticación al cargar la página
  async function checkAuth() {
    const token = localStorage.getItem("authToken");
    
    if (!token) {
      redirectToLogin();
      return;
    }
    
    try {
      const API_URL = getAuthApiUrl();
      
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
      
      // Mostrar información del usuario (solo si existe el elemento)
      displayUserInfo(data.user);
      
      // ⭐ NUEVO: Mostrar modalidad seleccionada
      displayModalidadIndicador();
      
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
  
  // ⭐ NUEVO: Mostrar modalidad seleccionada
  function displayModalidadIndicador() {
    const modalidadIndicador = document.getElementById("modalidadIndicador");
    
    if (!modalidadIndicador) {
      return; // Si no existe el elemento, salir
    }
    
    // Obtener la modalidad desde localStorage
    let modalidad = localStorage.getItem('modalidadSeleccionada');
    
    // ⚠️ IMPORTANTE: No establecer modalidad por defecto aquí
    // Dejar que el usuario la seleccione explícitamente
    if (!modalidad) {
      console.log("No hay modalidad seleccionada");
      return;
    }
    
    // Mostrar el indicador con la modalidad
    const modalidadNombre = document.getElementById("modalidadNombre");
    if (modalidadNombre) {
      modalidadNombre.textContent = modalidad;
    }
    
    modalidadIndicador.style.display = "flex";
  }
  
  // Mostrar información del usuario en la página
  function displayUserInfo(user) {
    const userInfoElement = document.getElementById("userInfo");
    
    // ⭐ MEJORA: Si no existe el elemento, simplemente retornar sin error
    if (!userInfoElement) {
      console.log("Página sin barra de usuario (ej: dashboard-stats)");
      return; // Salir silenciosamente
    }
    
    if (!user) {
      console.warn("No hay datos de usuario");
      return;
    }
    
    // Mostrar el elemento y actualizar contenido
    userInfoElement.style.display = "flex";
    userInfoElement.innerHTML = `
      <div class="user-left-section">
        <span class="user-name">🔹 ${user.nombre}</span>
        <button type="button" id="btnMiPerfil" class="btn-mi-perfil">
          👤 Mi Perfil
        </button>
        <button type="button" id="btnMapaSitio" class="btn-sitemap">
          🗺️ Mapa de Sitio
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
    
    // ⭐ NUEVO: Agregar evento al botón Mapa de Sitio
    const btnMapaSitio = document.getElementById("btnMapaSitio");
    if (btnMapaSitio) {
      btnMapaSitio.addEventListener("click", abrirMapaSitio);
    }
  }
  
  // Función para abrir Mi Perfil
  function abrirMiPerfil() {
    window.location.href = "perfil.html";
  }
  
  // ⭐ NUEVA: Función para abrir Mapa de Sitio
  function abrirMapaSitio() {
    window.location.href = "sitemap.html";
  }
  
  // Función de logout
  async function logout() {
    if (!confirm("¿Estás seguro que deseas cerrar sesión?")) {
      return;
    }
    
    const token = localStorage.getItem("authToken");
    const API_URL = getAuthApiUrl();
    
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
    
    // Limpiar localStorage (incluyendo modalidad)
    clearAuth();
    localStorage.removeItem('modalidadSeleccionada');
    
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
  
  // ✅ CORREGIDO: Esperar a que todo el DOM y scripts estén cargados
  function iniciarVerificacion() {
    // Dar un pequeño delay para asegurar que config.js se cargó
    setTimeout(checkAuth, 100);
  }
  
  // Ejecutar verificación cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarVerificacion);
  } else {
    iniciarVerificacion();
  }
})();