// backend/routes/mesaTrabajoSve.js
const express = require("express");
const router = express.Router();
const mesaTrabajoSveController = require("../controllers/mesaTrabajoSveController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  uploadSoporte,
  subirSoporte,
  descargarSoporte,
  eliminarSoporte
} = require("../controllers/mesaTrabajoSveController");

// ⭐ NOTA: El middleware de autenticación se aplica en server.js
// para todas las rutas EXCEPTO GET /:id/soporte que también acepta
// token por query param (necesario para abrir en nueva pestaña)

// Middleware que permite token por header O por query param
const verifyTokenFlexible = (req, res, next) => {
  // Si ya fue autenticado por el middleware global (header), continuar
  if (req.user) return next();
  // Si viene token por query param, intentar verificarlo
  if (req.query.token) {
    req.headers['authorization'] = `Bearer ${req.query.token}`;
    return authMiddleware.verifyToken(req, res, next);
  }
  // Sin token — rechazar
  return res.status(401).json({ success: false, message: "No autorizado - Token no proporcionado" });
};

// Crear una nueva Mesa de Trabajo SVE
router.post("/", mesaTrabajoSveController.createMesaTrabajo);

// Obtener todas las Mesas de Trabajo (filtradas según rol)
router.get("/", mesaTrabajoSveController.getAllMesasTrabajo);

// Obtener Mesa de Trabajo por ID de cliente
router.get("/cliente/:cliente_id", mesaTrabajoSveController.getMesaTrabajoByClienteId);

// ── Soporte adjunto ──────────────────────────────────────────
// (deben ir ANTES de /:id para que Express no las confunda)
router.post("/:id/soporte", uploadSoporte, subirSoporte);
router.get("/:id/soporte", verifyTokenFlexible, descargarSoporte);
router.delete("/:id/soporte", eliminarSoporte);

// Obtener Mesa de Trabajo por ID
router.get("/:id", mesaTrabajoSveController.getMesaTrabajoById);

// Actualizar Mesa de Trabajo
router.put("/:id", mesaTrabajoSveController.updateMesaTrabajo);

// Eliminar Mesa de Trabajo
router.delete("/:id", mesaTrabajoSveController.deleteMesaTrabajo);


module.exports = router;