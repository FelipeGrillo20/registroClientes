// backend/controllers/empresasController.js
const empresaModel = require("../models/empresaModel");

// Obtener todas las empresas
exports.getEmpresas = async (req, res) => {
  try {
    const empresas = await empresaModel.getEmpresas();
    res.json(empresas);
  } catch (err) {
    console.error("Error obteniendo empresas:", err);
    res.status(500).json({ message: "Error al obtener empresas." });
  }
};

// Obtener empresa por ID
exports.getEmpresaById = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa = await empresaModel.getEmpresaById(id);

    if (!empresa) {
      return res.status(404).json({ message: "Empresa no encontrada." });
    }

    res.json(empresa);
  } catch (err) {
    console.error("Error obteniendo empresa:", err);
    res.status(500).json({ message: "Error al obtener empresa." });
  }
};