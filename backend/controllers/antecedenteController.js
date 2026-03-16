// backend/controllers/antecedenteController.js

const antecedenteModel = require("../models/antecedenteModel");

// GET /api/clientes/:clienteId/antecedentes
exports.getAntecedentes = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const antecedentes = await antecedenteModel.getAntecedentesByClientId(clienteId);
    res.json(antecedentes);
  } catch (err) {
    console.error("Error obteniendo antecedentes:", err);
    res.status(500).json({ error: "Error al obtener antecedentes" });
  }
};

// POST /api/clientes/:clienteId/antecedentes
exports.createAntecedente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { tipo_antecedente, detalle } = req.body;

    if (!tipo_antecedente || !detalle) {
      return res.status(400).json({ error: "Tipo y detalle son requeridos" });
    }

    const nuevo = await antecedenteModel.createAntecedente(clienteId, tipo_antecedente, detalle);
    res.status(201).json(nuevo);
  } catch (err) {
    console.error("Error creando antecedente:", err);
    res.status(500).json({ error: "Error al crear antecedente" });
  }
};

// PUT /api/clientes/:clienteId/antecedentes/:id
exports.updateAntecedente = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_antecedente, detalle } = req.body;

    const actualizado = await antecedenteModel.updateAntecedente(id, tipo_antecedente, detalle);
    if (!actualizado) {
      return res.status(404).json({ error: "Antecedente no encontrado" });
    }
    res.json(actualizado);
  } catch (err) {
    console.error("Error actualizando antecedente:", err);
    res.status(500).json({ error: "Error al actualizar antecedente" });
  }
};

// DELETE /api/clientes/:clienteId/antecedentes/:id
exports.deleteAntecedente = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await antecedenteModel.deleteAntecedente(id);
    if (!eliminado) {
      return res.status(404).json({ error: "Antecedente no encontrado" });
    }
    res.json({ message: "Antecedente eliminado" });
  } catch (err) {
    console.error("Error eliminando antecedente:", err);
    res.status(500).json({ error: "Error al eliminar antecedente" });
  }
};