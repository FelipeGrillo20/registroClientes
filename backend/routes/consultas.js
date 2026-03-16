// backend/routes/consultas.js
const express = require("express");
const router = express.Router();
const consultasController = require("../controllers/consultasController");

// ============================================
// RUTAS ESPECIALES — deben ir ANTES de /:id
// para que Express no las interprete como IDs
// ============================================

// Cerrar una consulta completa
// PUT /api/consultas/cerrar
router.put("/cerrar", consultasController.cerrarConsulta);

// Reabrir una consulta
// PUT /api/consultas/reabrir
router.put("/reabrir", consultasController.reabrirConsulta);

// Guardar consultas sugeridas
// PUT /api/consultas/sugeridas
router.put("/sugeridas", consultasController.guardarConsultasSugeridas);

// Obtener datos de cierre de una consulta específica
// GET /api/consultas/cierre/:cliente_id/:consulta_number
router.get("/cierre/:cliente_id/:consulta_number", consultasController.getDatosCierreConsulta);

// Obtener consultas de un cliente específico
// GET /api/consultas/cliente/:cliente_id
router.get("/cliente/:cliente_id", consultasController.getConsultasByCliente);

// Obtener estadísticas detalladas por profesional (solo admin)
// GET /api/consultas/estadisticas/detalladas
router.get("/estadisticas/detalladas", consultasController.getEstadisticasDetalladasByProfesional);

// ============================================
// RUTAS ESTÁNDAR
// ============================================

// Obtener todas las consultas / Crear nueva consulta
router.get("/", consultasController.getAllConsultas);
router.post("/", consultasController.createConsulta);

// Obtener estadísticas generales
router.get("/estadisticas", consultasController.getEstadisticas);

// Operaciones por ID
router.get("/:id", consultasController.getConsultaById);
router.put("/:id", consultasController.updateConsulta);
router.delete("/:id", consultasController.deleteConsulta);

module.exports = router;