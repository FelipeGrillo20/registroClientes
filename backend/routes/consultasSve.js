// backend/routes/consultasSve.js
const express = require("express");
const router = express.Router();
const consultaSveController = require("../controllers/consultaSveController");

// ⭐ NOTA: El middleware de autenticación se aplica en server.js
// No es necesario aplicarlo aquí de nuevo

// Crear una nueva consulta SVE
router.post("/", consultaSveController.createConsultaSve);

// Obtener todas las consultas SVE (filtradas según rol)
router.get("/", consultaSveController.getAllConsultasSve);

// Obtener estadísticas SVE (filtradas según rol)
router.get("/estadisticas", consultaSveController.getEstadisticasSve);

// Obtener consultas SVE de un cliente específico
router.get("/cliente/:cliente_id", consultaSveController.getConsultasSveByCliente);

// Obtener una consulta SVE por ID
router.get("/:id", consultaSveController.getConsultaSveById);

// Actualizar una consulta SVE
router.put("/:id", consultaSveController.updateConsultaSve);

// Eliminar una consulta SVE
router.delete("/:id", consultaSveController.deleteConsultaSve);

// ⭐ NUEVAS RUTAS PARA DASHBOARD SVE

// Obtener estadísticas completas del Dashboard SVE
router.get("/dashboard/estadisticas", consultaSveController.getEstadisticasDashboardSVE);

// Obtener estadísticas por criterios de inclusión
router.get("/dashboard/criterios-inclusion", consultaSveController.getEstadisticasCriteriosInclusion);

// Obtener evolución temporal de consultas SVE
router.get("/dashboard/evolucion", consultaSveController.getEvolucionConsultasSVE);

module.exports = router;