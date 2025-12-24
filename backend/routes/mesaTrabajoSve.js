// backend/routes/mesaTrabajoSve.js
const express = require("express");
const router = express.Router();
const mesaTrabajoSveController = require("../controllers/mesaTrabajoSveController");

// ⭐ NOTA: El middleware de autenticación se aplica en server.js
// No es necesario aplicarlo aquí de nuevo

// Crear una nueva Mesa de Trabajo SVE
router.post("/", mesaTrabajoSveController.createMesaTrabajo);

// Obtener todas las Mesas de Trabajo (filtradas según rol)
router.get("/", mesaTrabajoSveController.getAllMesasTrabajo);

// Obtener Mesa de Trabajo por ID de cliente
router.get("/cliente/:cliente_id", mesaTrabajoSveController.getMesaTrabajoByClienteId);

// Obtener Mesa de Trabajo por ID
router.get("/:id", mesaTrabajoSveController.getMesaTrabajoById);

// Actualizar Mesa de Trabajo
router.put("/:id", mesaTrabajoSveController.updateMesaTrabajo);

// Eliminar Mesa de Trabajo
router.delete("/:id", mesaTrabajoSveController.deleteMesaTrabajo);

module.exports = router;