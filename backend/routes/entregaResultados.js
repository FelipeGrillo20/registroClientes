// backend/routes/entregaResultados.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/entregaResultadosController");

// Crear nuevo registro
router.post("/", ctrl.createEntrega);

// Obtener registros de un cliente
router.get("/cliente/:clientId", ctrl.getByCliente);

// Obtener registro por ID
router.get("/:id", ctrl.getById);

// Actualizar registro
router.put("/:id", ctrl.updateEntrega);

// Eliminar registro
router.delete("/:id", ctrl.deleteEntrega);

module.exports = router;