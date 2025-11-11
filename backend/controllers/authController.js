// backend/controllers/authController.js
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");

// Clave secreta para JWT (en producción debe estar en .env)
const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_temporal_2024";
const JWT_EXPIRES_IN = "8h"; // Token válido por 8 horas

// Login de usuario
exports.login = async (req, res) => {
  try {
    const { cedula, password, captchaToken } = req.body;

    console.log("=== LOGIN REQUEST ===");
    console.log("Cédula recibida:", cedula);
    console.log("Contraseña recibida:", password ? "***" : "VACÍA");
    console.log("Captcha recibido:", captchaToken);

    // Validaciones básicas
    if (!cedula || !password) {
      console.log("ERROR: Campos vacíos");
      return res.status(400).json({ 
        success: false,
        message: "Cédula y contraseña son requeridos" 
      });
    }

    // Verificar captcha (por ahora solo validamos que exista)
    if (!captchaToken) {
      console.log("ERROR: Sin captcha");
      return res.status(400).json({ 
        success: false,
        message: "Por favor completa el captcha" 
      });
    }

    // Buscar usuario por cédula
    console.log("Buscando usuario en DB...");
    const user = await userModel.findByCedula(cedula);

    if (!user) {
      console.log("ERROR: Usuario no encontrado");
      return res.status(401).json({ 
        success: false,
        message: "Credenciales incorrectas" 
      });
    }

    console.log("Usuario encontrado:", user.nombre);
    console.log("Hash en DB:", user.password);

    // Verificar contraseña
    console.log("Verificando contraseña...");
    const isPasswordValid = await userModel.verifyPassword(password, user.password);
    console.log("Contraseña válida:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("ERROR: Contraseña incorrecta");
      return res.status(401).json({ 
        success: false,
        message: "Credenciales incorrectas" 
      });
    }

    console.log("Login exitoso, generando token...");

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        cedula: user.cedula, 
        rol: user.rol 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("Token generado exitosamente");

    // Respuesta exitosa
    res.json({
      success: true,
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        cedula: user.cedula,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });

  } catch (err) {
    console.error("ERROR FATAL en login:", err);
    res.status(500).json({ 
      success: false,
      message: "Error en el servidor" 
    });
  }
};

// Verificar token (para validar sesión)
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No hay token" 
      });
    }

    // Verificar y decodificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar usuario actualizado
    const user = await userModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        cedula: user.cedula,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });

  } catch (err) {
    console.error("Error verificando token:", err);
    res.status(401).json({ 
      success: false,
      message: "Token inválido o expirado" 
    });
  }
};

// Logout (por ahora solo confirma, el token se borra en frontend)
exports.logout = (req, res) => {
  res.json({
    success: true,
    message: "Sesión cerrada correctamente"
  });
};

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    console.log("=== CAMBIO DE CONTRASEÑA REQUEST ===");

    // Obtener token del header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("ERROR: No hay token");
      return res.status(401).json({ 
        success: false,
        message: "No autorizado" 
      });
    }

    // Verificar y decodificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Usuario ID:", decoded.id);

    // Validar datos
    if (!currentPassword || !newPassword) {
      console.log("ERROR: Campos vacíos");
      return res.status(400).json({
        success: false,
        message: "Contraseña actual y nueva contraseña son requeridas"
      });
    }

    // Validar longitud de nueva contraseña
    if (newPassword.length < 6) {
      console.log("ERROR: Contraseña muy corta");
      return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres"
      });
    }

    // Buscar usuario
    const user = await userModel.findById(decoded.id);
    
    if (!user) {
      console.log("ERROR: Usuario no encontrado");
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    console.log("Usuario encontrado:", user.nombre);

    // Verificar contraseña actual
    const isPasswordValid = await userModel.verifyPassword(currentPassword, user.password);
    
    if (!isPasswordValid) {
      console.log("ERROR: Contraseña actual incorrecta");
      return res.status(401).json({
        success: false,
        message: "La contraseña actual es incorrecta"
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await userModel.verifyPassword(newPassword, user.password);
    
    if (isSamePassword) {
      console.log("ERROR: Nueva contraseña igual a la actual");
      return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe ser diferente a la actual"
      });
    }

    console.log("Validaciones pasadas, actualizando contraseña...");

    // Actualizar contraseña
    await userModel.updatePassword(decoded.id, newPassword);

    console.log("Contraseña actualizada exitosamente");

    res.json({
      success: true,
      message: "Contraseña actualizada correctamente"
    });

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      console.error("ERROR: Token inválido");
      return res.status(401).json({ 
        success: false,
        message: "Token inválido" 
      });
    }
    
    console.error("ERROR FATAL al cambiar contraseña:", err);
    res.status(500).json({
      success: false,
      message: "Error al cambiar la contraseña"
    });
  }
};

// ============================================
// GESTIÓN DE USUARIOS (SOLO ADMIN)
// ============================================

// Listar todos los usuarios
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    
    res.json({
      success: true,
      users
    });
  } catch (err) {
    console.error("Error obteniendo usuarios:", err);
    res.status(500).json({
      success: false,
      message: "Error al obtener usuarios"
    });
  }
};

// Registrar nuevo usuario (solo admin)
exports.registerUser = async (req, res) => {
  try {
    const { cedula, nombre, email, password, rol } = req.body;

    console.log("=== REGISTRO DE USUARIO (ADMIN) ===");
    console.log("Cédula:", cedula);
    console.log("Nombre:", nombre);
    console.log("Rol:", rol);

    // Validaciones
    if (!cedula || !nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son requeridos"
      });
    }

    if (!/^\d+$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        message: "La cédula debe contener solo números"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email inválido"
      });
    }

    // Verificar si la cédula ya existe
    const existingCedula = await userModel.findByCedula(cedula);
    if (existingCedula) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un usuario con esa cédula"
      });
    }

    // Verificar si el email ya existe
    const existingEmail = await userModel.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un usuario con ese email"
      });
    }

    // Crear usuario
    const newUser = await userModel.createUser({
      cedula,
      nombre,
      email: email.toLowerCase(),
      password,
      rol: rol || 'profesional'
    });

    console.log("Usuario creado exitosamente:", newUser.id);

    res.status(201).json({
      success: true,
      message: "Usuario registrado exitosamente",
      user: {
        id: newUser.id,
        cedula: newUser.cedula,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        activo: newUser.activo,
        created_at: newUser.created_at
      }
    });

  } catch (err) {
    console.error("Error registrando usuario:", err);
    res.status(500).json({
      success: false,
      message: "Error al registrar usuario"
    });
  }
};

// Actualizar usuario (solo admin)
exports.updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { nombre, email, rol } = req.body;

    console.log("=== ACTUALIZACIÓN DE USUARIO ===");
    console.log("ID:", userId);

    if (!nombre || !email || !rol) {
      return res.status(400).json({
        success: false,
        message: "Nombre, email y rol son requeridos"
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email inválido"
      });
    }

    // Verificar que el usuario existe
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    // Verificar si el email está en uso por otro usuario
    const existingEmail = await userModel.findByEmail(email.toLowerCase());
    if (existingEmail && existingEmail.id !== userId) {
      return res.status(409).json({
        success: false,
        message: "El email ya está en uso por otro usuario"
      });
    }

    // Actualizar usuario
    const updatedUser = await userModel.updateUser(userId, {
      nombre,
      email: email.toLowerCase(),
      rol
    });

    res.json({
      success: true,
      message: "Usuario actualizado exitosamente",
      user: updatedUser
    });

  } catch (err) {
    console.error("Error actualizando usuario:", err);
    res.status(500).json({
      success: false,
      message: "Error al actualizar usuario"
    });
  }
};

// Activar/Desactivar usuario (solo admin)
exports.toggleUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    console.log("=== CAMBIO DE ESTADO DE USUARIO ===");
    console.log("ID:", userId);

    // Verificar que el usuario existe
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    // Prevenir que el admin se desactive a sí mismo
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "No puedes desactivar tu propia cuenta"
      });
    }

    // Cambiar estado
    const newStatus = !user.activo;
    const updatedUser = await userModel.toggleUserStatus(userId, newStatus);

    const mensaje = newStatus 
      ? "Usuario activado exitosamente" 
      : "Usuario desactivado exitosamente";

    res.json({
      success: true,
      message: mensaje,
      user: updatedUser
    });

  } catch (err) {
    console.error("Error cambiando estado de usuario:", err);
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado del usuario"
    });
  }
};

// Eliminar usuario (solo admin) - OPCIONAL
exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    console.log("=== ELIMINACIÓN DE USUARIO ===");
    console.log("ID:", userId);

    // Verificar que el usuario existe
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    // Prevenir que el admin se elimine a sí mismo
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "No puedes eliminar tu propia cuenta"
      });
    }

    // Eliminar usuario
    await userModel.deleteUser(userId);

    res.json({
      success: true,
      message: "Usuario eliminado exitosamente"
    });

  } catch (err) {
    console.error("Error eliminando usuario:", err);
    res.status(500).json({
      success: false,
      message: "Error al eliminar usuario"
    });
  }
};

// ============================================
// CAMBIAR CONTRASEÑA DE USUARIO (SOLO ADMIN)
// ============================================
exports.adminChangeUserPassword = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    console.log("=== CAMBIO DE CONTRASEÑA POR ADMIN ===");
    console.log("Usuario ID:", userId);

    // Validar que se proporcione la nueva contraseña
    if (!newPassword || newPassword.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña es requerida'
      });
    }

    // Validar longitud mínima
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Buscar el usuario a modificar
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log("Usuario encontrado:", user.nombre);
    console.log("Actualizando contraseña...");

    // Actualizar la contraseña usando el método del userModel
    await userModel.updatePassword(userId, newPassword);

    console.log("Contraseña actualizada exitosamente");

    res.json({
      success: true,
      message: `Contraseña de ${user.nombre} actualizada correctamente`
    });

  } catch (error) {
    console.error('Error al cambiar contraseña del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar la contraseña del usuario'
    });
  }
};
