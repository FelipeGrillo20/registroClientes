// frontend/js/login.js

const API_URL = "http://localhost:5000/api/auth";

// Variables del captcha
let captchaAnswer = 0;

// Referencias DOM
const loginForm = document.getElementById("loginForm");
const cedulaInput = document.getElementById("cedula");
const passwordInput = document.getElementById("password");
const captchaAnswerInput = document.getElementById("captchaAnswer");
const errorMessage = document.getElementById("errorMessage");
const loadingMessage = document.getElementById("loadingMessage");
const btnLogin = document.getElementById("btnLogin");
const btnCancel = document.getElementById("btnCancel");
const btnRefreshCaptcha = document.getElementById("btnRefreshCaptcha");
const btnTogglePassword = document.getElementById("btnTogglePassword");

// ============================================
// TOGGLE PASSWORD VISIBILITY
// ============================================
if (btnTogglePassword) {
  btnTogglePassword.addEventListener("click", function() {
    const eyeIcon = this.querySelector(".eye-icon");
    
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      eyeIcon.textContent = "🙈";
      this.classList.add("active");
    } else {
      passwordInput.type = "password";
      eyeIcon.textContent = "👁️";
      this.classList.remove("active");
    }
  });
}

// Generar captcha matemático simple
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  captchaAnswer = num1 + num2;
  
  document.getElementById("captchaQuestion").textContent = `${num1} + ${num2} = ?`;
  captchaAnswerInput.value = "";
}

// Mostrar mensaje de error
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.background = "#fee";
  errorMessage.style.color = "#c0392b";
  errorMessage.style.borderLeft = "4px solid #e74c3c";
  errorMessage.classList.add("show");
  
  setTimeout(() => {
    errorMessage.classList.remove("show");
  }, 5000);
}

// Mostrar/ocultar loading
function setLoading(isLoading) {
  if (isLoading) {
    loadingMessage.classList.add("show");
    btnLogin.disabled = true;
    btnLogin.style.cursor = "not-allowed";
  } else {
    loadingMessage.classList.remove("show");
    btnLogin.disabled = false;
    btnLogin.style.cursor = "pointer";
  }
}

// Validar captcha
function validateCaptcha() {
  const userAnswer = parseInt(captchaAnswerInput.value);
  return userAnswer === captchaAnswer;
}

// Manejar submit del formulario
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  console.log("=== INICIO DE LOGIN ===");
  
  // Limpiar errores previos
  errorMessage.classList.remove("show");
  
  // Obtener valores
  const cedula = cedulaInput.value.trim();
  const password = passwordInput.value.trim();
  
  console.log("Cédula ingresada:", cedula);
  console.log("Contraseña ingresada:", password);
  
  // Validaciones básicas
  if (!cedula || !password) {
    showError("Por favor completa todos los campos");
    return;
  }
  
  if (!/^\d+$/.test(cedula)) {
    showError("La cédula debe contener solo números");
    return;
  }
  
  // Validar captcha
  if (!validateCaptcha()) {
    showError("Captcha incorrecto. Por favor intenta de nuevo");
    generateCaptcha();
    return;
  }
  
  console.log("Validaciones pasadas, enviando al servidor...");
  
  // Realizar login
  setLoading(true);
  
  try {
    const requestBody = {
      cedula,
      password,
      captchaToken: "valid"
    };
    
    console.log("Request body:", requestBody);
    console.log("URL:", `${API_URL}/login`);
    
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log("Response status:", response.status);
    
    const data = await response.json();
    console.log("Response data:", data);
    
    if (!response.ok) {
      throw new Error(data.message || "Error al iniciar sesión");
    }
    
    // Login exitoso
    if (data.success && data.token) {
      console.log("Login exitoso! Token recibido");
      
      // Guardar token y datos del usuario en localStorage
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userData", JSON.stringify(data.user));
      
      console.log("Token guardado en localStorage");
      
      // Mostrar mensaje de éxito
      showSuccess("¡Bienvenido! Redirigiendo...");
      
      // Redireccionar después de 1 segundo
      setTimeout(() => {
        console.log("Redirigiendo a index.html");
        window.location.href = "index.html";
      }, 1000);
    } else {
      throw new Error("Respuesta inválida del servidor");
    }
    
  } catch (err) {
    console.error("Error en login:", err);
    showError(err.message || "Error de conexión. Verifica que el servidor esté activo");
    generateCaptcha(); // Regenerar captcha en caso de error
  } finally {
    setLoading(false);
  }
});

// Mostrar mensaje de éxito
function showSuccess(message) {
  errorMessage.textContent = message;
  errorMessage.style.background = "#d4edda";
  errorMessage.style.color = "#155724";
  errorMessage.style.borderLeft = "4px solid #28a745";
  errorMessage.classList.add("show");
}

// Botón cancelar - limpiar formulario
btnCancel.addEventListener("click", () => {
  loginForm.reset();
  generateCaptcha();
  errorMessage.classList.remove("show");
  
  // Resetear el toggle de contraseña
  if (btnTogglePassword) {
    passwordInput.type = "password";
    btnTogglePassword.querySelector(".eye-icon").textContent = "👁️";
    btnTogglePassword.classList.remove("active");
  }
});

// Botón refrescar captcha
btnRefreshCaptcha.addEventListener("click", () => {
  generateCaptcha();
  captchaAnswerInput.value = "";
  captchaAnswerInput.focus();
});

// Verificar si ya hay sesión activa
document.addEventListener("DOMContentLoaded", () => {
  console.log("Página de login cargada");
  console.log("API URL:", API_URL);
  
  const token = localStorage.getItem("authToken");
  
  if (token) {
    console.log("Token encontrado, verificando...");
    // Verificar si el token es válido
    fetch(`${API_URL}/verify`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) {
        throw new Error("Token inválido");
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        console.log("Token válido, redirigiendo...");
        // Token válido, redireccionar
        window.location.href = "index.html";
      } else {
        console.log("Token inválido, limpiando...");
        // Token inválido, limpiar localStorage
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        generateCaptcha();
      }
    })
    .catch((err) => {
      console.log("Error al verificar token:", err);
      // Error al verificar, limpiar y generar captcha
      localStorage.removeItem("authToken");
      localStorage.removeItem("userData");
      generateCaptcha();
    });
  } else {
    console.log("No hay token, generando captcha...");
    // No hay token, generar captcha
    generateCaptcha();
  }
});

// Permitir enter en el campo de captcha
captchaAnswerInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnLogin.click();
  }
});