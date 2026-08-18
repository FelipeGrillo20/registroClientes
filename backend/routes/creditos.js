// backend/routes/creditos.js
const express = require('express');
const router  = express.Router();
const CreditosController = require('../controllers/creditosController');

// ── Créditos (CRUD) ────────────────────────────────────────────────────────

// Crear nuevo crédito
router.post('/', CreditosController.crear);

// Obtener crédito activo (sin importar año/mes)
router.get('/activo', CreditosController.obtenerCreditoActivo);

// Verificar si una sesión ya tiene asignación
// IMPORTANTE: esta ruta debe ir ANTES de /:id para no colisionar
router.get('/asignacion-sesion', CreditosController.verificarAsignacionSesion);

// Listar créditos por año y mes
router.get('/', CreditosController.listar);

// Obtener estadísticas
router.get('/estadisticas', CreditosController.obtenerEstadisticas);

// Actualizar crédito
router.put('/:id', CreditosController.actualizar);

// Eliminar crédito
router.delete('/:id', CreditosController.eliminar);

// ── Consumo / devolución de horas ─────────────────────────────────────────
// Ahora también registran/eliminan en asignaciones_creditos

// Consumir horas + registrar asignación en BD
router.patch('/:id/consumir', CreditosController.consumirHoras);

// Devolver horas + eliminar asignación de BD
router.patch('/:id/devolver', CreditosController.devolverHoras);

// ── Informe de asignaciones ────────────────────────────────────────────────
// Obtener todas las asignaciones de un crédito (para el modal Informe Asignados)
router.get('/:id/asignaciones', CreditosController.obtenerAsignaciones);

module.exports = router;