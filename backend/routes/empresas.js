// backend/routes/empresas.js
const express = require("express");
const router = express.Router();
const empresasController = require("../controllers/empresasController");

// Obtener todas las empresas
router.get("/", empresasController.getEmpresas);

// Obtener una empresa por ID
router.get("/:id", empresasController.getEmpresaById);

module.exports = router;