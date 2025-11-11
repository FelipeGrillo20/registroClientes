// backend/routes/consultas.js
const express = require("express");
const router = express.Router();
const consultasController = require("../controllers/consultasController");

// Crear una nueva consulta
router.post("/", consultasController.createConsulta);

// Obtener todas las consultas
router.get("/", consultasController.getAllConsultas);

// Obtener estadísticas
router.get("/estadisticas", consultasController.getEstadisticas);

// Obtener consultas de un cliente específico
router.get("/cliente/:cliente_id", consultasController.getConsultasByCliente);

// Obtener una consulta por ID
router.get("/:id", consultasController.getConsultaById);

// Actualizar una consulta
router.put("/:id", consultasController.updateConsulta);

// Eliminar una consulta
router.delete("/:id", consultasController.deleteConsulta);

module.exports = router;