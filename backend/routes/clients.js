// backend/routes/clients.js
const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clientsController");

// Crear un nuevo cliente
router.post("/", clientsController.createClient);

// Obtener todos los clientes
router.get("/", clientsController.getClients);

// Obtener un cliente por ID
router.get("/:id", clientsController.getClientById);

// Actualizar un cliente
router.put("/:id", clientsController.updateClient);

// Eliminar un cliente
router.delete("/:id", clientsController.deleteClient);

module.exports = router;


