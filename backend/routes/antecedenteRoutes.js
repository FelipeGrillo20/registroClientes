// backend/routes/antecedenteRoutes.js
//
// Ya está protegido por authMiddleware.verifyToken en server.js.
// No se necesita middleware adicional aquí.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clientsController");

router.get(   "/:clienteId/antecedentes",      clientsController.getAntecedentes    );
router.post(  "/:clienteId/antecedentes",      clientsController.createAntecedente  );
router.put(   "/:clienteId/antecedentes/:id",  clientsController.updateAntecedente  );
router.delete("/:clienteId/antecedentes/:id",  clientsController.deleteAntecedente  );

module.exports = router;