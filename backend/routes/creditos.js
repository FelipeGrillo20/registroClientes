// backend/routes/creditos.js
const express = require('express');
const router = express.Router();
const CreditosController = require('../controllers/creditosController');

// Crear nuevo crédito
router.post('/', CreditosController.crear);

// Obtener crédito activo (sin importar año/mes)
router.get('/activo', CreditosController.obtenerCreditoActivo);

// Listar créditos por año y mes
router.get('/', CreditosController.listar);

// Actualizar crédito
router.put('/:id', CreditosController.actualizar);

// Eliminar crédito
router.delete('/:id', CreditosController.eliminar);

// Obtener estadísticas
router.get('/estadisticas', CreditosController.obtenerEstadisticas);

module.exports = router;