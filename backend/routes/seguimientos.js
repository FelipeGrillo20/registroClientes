// backend/routes/seguimientos.js
const express = require("express");
const router  = express.Router();
const seguimientoController = require("../controllers/seguimientoController");

// ============================================
// RUTAS ESPECIALES — deben ir ANTES de /:id
// ============================================

// Obtener todos los seguimientos de una consulta
// GET /api/seguimientos/:cliente_id/:consulta_number
router.get("/:cliente_id/:consulta_number", seguimientoController.getSeguimientosByConsulta);

// ============================================
// RUTAS ESTÁNDAR
// ============================================

// Crear nuevo seguimiento
// POST /api/seguimientos
router.post("/", seguimientoController.createSeguimiento);

// Operaciones por ID de seguimiento
// GET    /api/seguimientos/:id
// PUT    /api/seguimientos/:id
// DELETE /api/seguimientos/:id
router.get("/:id",    seguimientoController.getSeguimientoById);
router.put("/:id",    seguimientoController.updateSeguimiento);
router.delete("/:id", seguimientoController.deleteSeguimiento);

module.exports = router;