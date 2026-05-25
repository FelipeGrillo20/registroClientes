// backend/controllers/seguimientoController.js
// Controlador para el módulo de seguimientos post-cierre.
// Opera sobre la tabla `seguimientos` (independiente de consultas).

const seguimientoModel = require("../models/seguimientoModel");

// ============================================
// Crear un nuevo seguimiento
// POST /api/seguimientos
// Body: { cliente_id, consulta_number, fecha_seguimiento,
//         observaciones_seguimiento }
// ============================================
exports.createSeguimiento = async (req, res) => {
  try {
    const { cliente_id, consulta_number, fecha_seguimiento, observaciones_seguimiento } = req.body;

    // Validación de campos requeridos
    if (!cliente_id || !consulta_number || !fecha_seguimiento || !observaciones_seguimiento) {
      return res.status(400).json({
        message: "cliente_id, consulta_number, fecha_seguimiento y observaciones_seguimiento son requeridos"
      });
    }

    if (!observaciones_seguimiento.trim()) {
      return res.status(400).json({ message: "Las observaciones no pueden estar vacías" });
    }

    // Regla de negocio: solo se puede registrar seguimiento en consultas cerradas
    const cerrada = await seguimientoModel.consultaExisteYEstaCerrada(
      parseInt(cliente_id),
      parseInt(consulta_number)
    );

    if (!cerrada) {
      return res.status(409).json({
        message: "El seguimiento solo puede registrarse en consultas cerradas o la consulta no existe"
      });
    }

    const nuevo = await seguimientoModel.createSeguimiento(
      parseInt(cliente_id),
      parseInt(consulta_number),
      fecha_seguimiento,
      observaciones_seguimiento.trim()
    );

    res.status(201).json(nuevo);
  } catch (err) {
    console.error("Error creando seguimiento:", err);
    res.status(500).json({ message: "Error al crear el seguimiento" });
  }
};

// ============================================
// Obtener todos los seguimientos de una consulta
// GET /api/seguimientos/:cliente_id/:consulta_number
// ============================================
exports.getSeguimientosByConsulta = async (req, res) => {
  try {
    const { cliente_id, consulta_number } = req.params;

    const seguimientos = await seguimientoModel.getSeguimientosByConsulta(
      parseInt(cliente_id),
      parseInt(consulta_number)
    );

    // Siempre devuelve array (vacío si no hay seguimientos)
    res.json(seguimientos);
  } catch (err) {
    console.error("Error obteniendo seguimientos:", err);
    res.status(500).json({ message: "Error al obtener los seguimientos" });
  }
};

// ============================================
// Obtener un seguimiento por ID
// GET /api/seguimientos/:id
// ============================================
exports.getSeguimientoById = async (req, res) => {
  try {
    const { id } = req.params;
    const seguimiento = await seguimientoModel.getSeguimientoById(parseInt(id));

    if (!seguimiento) {
      return res.status(404).json({ message: "Seguimiento no encontrado" });
    }

    res.json(seguimiento);
  } catch (err) {
    console.error("Error obteniendo seguimiento:", err);
    res.status(500).json({ message: "Error al obtener el seguimiento" });
  }
};

// ============================================
// Actualizar un seguimiento por ID
// PUT /api/seguimientos/:id
// Body: { fecha_seguimiento, observaciones_seguimiento }
// ============================================
exports.updateSeguimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_seguimiento, observaciones_seguimiento } = req.body;

    if (!fecha_seguimiento || !observaciones_seguimiento) {
      return res.status(400).json({
        message: "fecha_seguimiento y observaciones_seguimiento son requeridos"
      });
    }

    if (!observaciones_seguimiento.trim()) {
      return res.status(400).json({ message: "Las observaciones no pueden estar vacías" });
    }

    const actualizado = await seguimientoModel.updateSeguimiento(
      parseInt(id),
      fecha_seguimiento,
      observaciones_seguimiento.trim()
    );

    if (!actualizado) {
      return res.status(404).json({ message: "Seguimiento no encontrado" });
    }

    res.json(actualizado);
  } catch (err) {
    console.error("Error actualizando seguimiento:", err);
    res.status(500).json({ message: "Error al actualizar el seguimiento" });
  }
};

// ============================================
// Eliminar un seguimiento por ID
// DELETE /api/seguimientos/:id
// ============================================
exports.deleteSeguimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await seguimientoModel.deleteSeguimiento(parseInt(id));

    if (!eliminado) {
      return res.status(404).json({ message: "Seguimiento no encontrado" });
    }

    res.json({ message: "Seguimiento eliminado correctamente", seguimiento: eliminado });
  } catch (err) {
    console.error("Error eliminando seguimiento:", err);
    res.status(500).json({ message: "Error al eliminar el seguimiento" });
  }
};