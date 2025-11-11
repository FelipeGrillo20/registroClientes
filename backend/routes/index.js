// routes/index.js
const express = require("express");
const router = express.Router();

// Importamos las rutas de cada recurso
const clientsRoutes = require("./clients");
const ordersRoutes = require("./orders");

// Importamos controlador general
const indexController = require("../controllers/indexController");

// Rutas principales de la API
router.get("/", indexController.welcome);
router.get("/health", indexController.healthCheck);

// Conectamos las rutas específicas
router.use("/clients", clientsRoutes);
router.use("/orders", ordersRoutes);

module.exports = router;
