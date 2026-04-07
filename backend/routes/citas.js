// backend/routes/citas.js
const express = require("express");
const router = express.Router();
const CitasController = require("../controllers/citasController");

/**
 * ✅ RUTA PÚBLICA - Confirmar o cancelar cita desde email
 * @route   GET /api/citas/:id/confirmar
 * @desc    Confirmar o cancelar una cita desde el link del email
 * @access  Public (sin autenticación - DEBE IR PRIMERO)
 * @query   accion - "confirmar" o "cancelar"
 * 
 * IMPORTANTE: Esta ruta debe estar ANTES de las rutas con parámetro :id
 * para que coincida primero y no requiera autenticación
 */
router.get("/:id/confirmar", CitasController.confirmarDesdeEmail);

/**
 * @route   GET /api/citas
 * @desc    Obtener todas las citas (con filtros opcionales)
 * @access  Private
 * @query   profesional_id, trabajador_id, estado, modalidad_programa, fecha_inicio, fecha_fin
 */
router.get("/", CitasController.getAllCitas);

/**
 * @route   GET /api/citas/calendario
 * @desc    Obtener citas formateadas para el calendario
 * @access  Private
 * @query   fecha_inicio, fecha_fin, profesional_id, modalidad_programa
 */
router.get("/calendario", CitasController.getCitasCalendario);

/**
 * @route   GET /api/citas/estadisticas
 * @desc    Obtener estadísticas de citas
 * @access  Private
 * @query   fecha_inicio, fecha_fin, modalidad_programa
 */
router.get("/estadisticas", CitasController.getEstadisticas);

/**
 * ✅ NUEVA RUTA - Obtener trabajadores con citas previas de un profesional
 * @route   GET /api/citas/trabajadores-por-profesional/:profesionalId
 * @desc    Obtener trabajadores que tienen citas previas con un profesional específico
 * @access  Private
 * @query   modalidad
 * @params  profesionalId - ID del profesional
 */
router.get(
  "/trabajadores-por-profesional/:profesionalId",
  CitasController.getTrabajadoresPorProfesional
);

/**
 * @route   GET /api/citas/:id
 * @desc    Obtener una cita por ID
 * @access  Private
 */
router.get("/:id", CitasController.getCitaById);

/**
 * @route   POST /api/citas
 * @desc    Crear una nueva cita
 * @access  Private
 * @body    { trabajador_id, profesional_id, fecha, hora_inicio, hora_fin, modalidad_cita, estado, observaciones_internas, observaciones_informe, modalidad_programa }
 */
router.post("/", CitasController.createCita);

/**
 * @route   PUT /api/citas/:id
 * @desc    Actualizar una cita existente
 * @access  Private
 */
router.put("/:id", CitasController.updateCita);

/**
 * ✅ NUEVA RUTA: Asignar crédito manualmente a una cita (desde creditos.html)
 * @route   PATCH /api/citas/:id/asignar-credito
 * @desc    Asigna un formato/crédito a la cita y consume las horas correspondientes
 * @access  Private
 * @body    { credito_id }
 */
router.patch("/:id/asignar-credito", CitasController.asignarCredito);

/**
 * @route   PATCH /api/citas/:id/estado
 * @desc    Cambiar el estado de una cita
 * @access  Private
 * @body    { estado }
 */
router.patch("/:id/estado", CitasController.cambiarEstado);

/**
 * @route   DELETE /api/citas/:id
 * @desc    Eliminar una cita
 * @access  Private
 */
router.delete("/:id", CitasController.deleteCita);

module.exports = router;