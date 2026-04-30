// backend/controllers/entregaResultadosController.js
const entregaModel = require("../models/entregaResultadosModel");

// POST /api/entrega-resultados
exports.createEntrega = async (req, res) => {
  try {
    const profesional_id = req.user?.id;
    if (!profesional_id) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const {
      client_id,
      fecha_aplicacion,
      fecha_retroalimentacion,
      titulo_seccion,
      recomendaciones_html,
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ message: "El trabajador es requerido" });
    }

    const nueva = await entregaModel.createEntrega({
      client_id,
      profesional_id,
      fecha_aplicacion,
      fecha_retroalimentacion,
      titulo_seccion,
      recomendaciones_html,
    });

    res.status(201).json({ message: "Guardado exitosamente", data: nueva });
  } catch (err) {
    console.error("Error al crear entrega:", err);
    res.status(500).json({ message: "Error al guardar el registro" });
  }
};

// GET /api/entrega-resultados/cliente/:clientId
exports.getByCliente = async (req, res) => {
  try {
    const { clientId } = req.params;
    const registros = await entregaModel.getEntregasByCliente(clientId);
    res.json(registros);
  } catch (err) {
    console.error("Error al obtener entregas:", err);
    res.status(500).json({ message: "Error al obtener registros" });
  }
};

// GET /api/entrega-resultados/:id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await entregaModel.getEntregaById(id);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }
    res.json(registro);
  } catch (err) {
    console.error("Error al obtener entrega:", err);
    res.status(500).json({ message: "Error al obtener el registro" });
  }
};

// PUT /api/entrega-resultados/:id
exports.updateEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const profesional_id = req.user?.id;
    const userRole = req.user?.rol;

    // Verificar que existe
    const existente = await entregaModel.getEntregaById(id);
    if (!existente) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    // Verificar permisos (solo el profesional dueño o admin)
    if (userRole !== 'admin' && existente.profesional_id !== profesional_id) {
      return res.status(403).json({ message: "No tienes permiso para editar este registro" });
    }

    const {
      fecha_aplicacion,
      fecha_retroalimentacion,
      titulo_seccion,
      recomendaciones_html,
    } = req.body;

    const actualizado = await entregaModel.updateEntrega(id, {
      fecha_aplicacion,
      fecha_retroalimentacion,
      titulo_seccion,
      recomendaciones_html,
    });

    res.json({ message: "Actualizado exitosamente", data: actualizado });
  } catch (err) {
    console.error("Error al actualizar entrega:", err);
    res.status(500).json({ message: "Error al actualizar el registro" });
  }
};

// DELETE /api/entrega-resultados/:id
exports.deleteEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const profesional_id = req.user?.id;
    const userRole = req.user?.rol;

    const existente = await entregaModel.getEntregaById(id);
    if (!existente) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    if (userRole !== 'admin' && existente.profesional_id !== profesional_id) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este registro" });
    }

    await entregaModel.deleteEntrega(id);
    res.json({ message: "Eliminado exitosamente" });
  } catch (err) {
    console.error("Error al eliminar entrega:", err);
    res.status(500).json({ message: "Error al eliminar el registro" });
  }
};