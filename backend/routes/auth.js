// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { isAdmin } = require("../middleware/adminMiddleware");

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Ruta de login
router.post("/login", authController.login);

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// Ruta para verificar token (validar sesión)
router.get("/verify", authController.verifyToken);

// Ruta de logout
router.post("/logout", authController.logout);

// Ruta para cambiar contraseña (requiere autenticación)
router.post("/change-password", authController.changePassword);

// ============================================
// RUTAS DE ADMINISTRACIÓN (solo admin)
// ============================================

// Listar todos los usuarios
router.get("/users", isAdmin, authController.getAllUsers);

// Registrar nuevo usuario
router.post("/users", isAdmin, authController.registerUser);

// Actualizar usuario
router.put("/users/:id", isAdmin, authController.updateUser);

// Activar/Desactivar usuario
router.patch("/users/:id/toggle-status", isAdmin, authController.toggleUserStatus);

// Cambiar contraseña de un usuario (solo admin)
router.post("/admin/change-user-password/:id", isAdmin, authController.adminChangeUserPassword);

// Eliminar usuario (opcional)
router.delete("/users/:id", isAdmin, authController.deleteUser);

module.exports = router;
