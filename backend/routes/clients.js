// backend/routes/clients.js
const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clientsController");

// Crear un nuevo cliente
router.post("/", clientsController.createClient);

// ⭐ NUEVO: Obtener clientes con filtros avanzados (debe ir ANTES de "/:id")
router.get("/filters", clientsController.getClientsWithFilters);

// Obtener todos los clientes
router.get("/", clientsController.getClients);

// Obtener un cliente por ID
router.get("/:id", clientsController.getClientById);

// Actualizar un cliente
router.put("/:id", clientsController.updateClient);

// Eliminar un cliente
router.delete("/:id", clientsController.deleteClient);

module.exports = router;

