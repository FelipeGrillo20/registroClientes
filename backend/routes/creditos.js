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
 
// Obtener estadísticas
router.get('/estadisticas', CreditosController.obtenerEstadisticas);
 
// Actualizar crédito
router.put('/:id', CreditosController.actualizar);
 
// Eliminar crédito
router.delete('/:id', CreditosController.eliminar);
 
// ── NUEVAS RUTAS: consumo directo de horas (sin cita) ──────────────────────
// Consumir horas de un crédito directamente desde creditos.html
router.patch('/:id/consumir', CreditosController.consumirHoras);
 
// Devolver horas a un crédito directamente desde creditos.html
router.patch('/:id/devolver', CreditosController.devolverHoras);
 
module.exports = router;