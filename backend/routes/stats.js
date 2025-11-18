// backend/routes/stats.js
const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const { verifyToken } = require("../middleware/authMiddleware");

// Obtener estadísticas del dashboard (solo admin)
// verifyToken ya verifica el rol dentro del token
router.get("/dashboard", verifyToken, statsController.getDashboardStats);

module.exports = router;