const express = require("express");
const router = express.Router();
const ordersController = require("../controllers/ordersController");

// 👉 Obtener todas las órdenes
router.get("/", ordersController.getAllOrders);

// 👉 Crear una nueva orden
router.post("/", ordersController.createOrder);

// 👉 Obtener una orden por ID
router.get("/:id", ordersController.getOrderById);

// 👉 Actualizar una orden
router.put("/:id", ordersController.updateOrder);

// 👉 Eliminar una orden
router.delete("/:id", ordersController.deleteOrder);

module.exports = router;
