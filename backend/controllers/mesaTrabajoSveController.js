// backend/controllers/mesaTrabajoSveController.js
const mesaTrabajoModel = require("../models/mesaTrabajoSveModel");
const clientModel = require("../models/clientModel");

// Crear nueva Mesa de Trabajo SVE
exports.createMesaTrabajo = async (req, res) => {
  try {
    const {
      cliente_id,
      criterio_inclusion,
      diagnostico,
      codigo_diagnostico
    } = req.body;

    // Validaciones básicas
    if (!cliente_id || !criterio_inclusion || !diagnostico || !codigo_diagnostico) {
      return res.status(400).json({ 
        message: "Todos los campos son requeridos" 
      });
    }

    // Verificar que el cliente existe
    const cliente = await clientModel.getClientById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos: admin puede crear para cualquiera, profesional solo para sus clientes
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para crear Mesa de Trabajo para este cliente" 
      });
    }

    // Verificar si ya existe Mesa de Trabajo para este cliente
    const yaExiste = await mesaTrabajoModel.clienteTieneMesaTrabajo(cliente_id);
    if (yaExiste) {
      return res.status(400).json({ 
        message: "Este cliente ya tiene una Mesa de Trabajo registrada. Use PUT para actualizar." 
      });
    }

    const newMesaTrabajo = await mesaTrabajoModel.createMesaTrabajo({
      cliente_id,
      criterio_inclusion,
      diagnostico,
      codigo_diagnostico
    });

    res.status(201).json(newMesaTrabajo);
  } catch (err) {
    console.error("Error creando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al crear Mesa de Trabajo" });
  }
};

// Obtener todas las Mesas de Trabajo
exports.getAllMesasTrabajo = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    let mesasTrabajo;

    if (userRole === 'admin') {
      mesasTrabajo = await mesaTrabajoModel.getAllMesasTrabajo();
    } else if (userRole === 'profesional') {
      mesasTrabajo = await mesaTrabajoModel.getMesasTrabajoByProfesional(userId);
    } else {
      return res.status(403).json({ message: "No tienes permisos para ver Mesas de Trabajo" });
    }

    res.json(mesasTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesas de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesas de Trabajo" });
  }
};

// Obtener Mesa de Trabajo por ID de cliente
exports.getMesaTrabajoByClienteId = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const mesaTrabajo = await mesaTrabajoModel.getMesaTrabajoByClienteId(cliente_id);

    if (!mesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada para este cliente" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver esta Mesa de Trabajo" });
    }

    res.json(mesaTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesa de Trabajo" });
  }
};

// Obtener Mesa de Trabajo por ID
exports.getMesaTrabajoById = async (req, res) => {
  try {
    const { id } = req.params;
    const mesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);

    if (!mesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(mesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver esta Mesa de Trabajo" });
    }

    res.json(mesaTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesa de Trabajo" });
  }
};

// Actualizar Mesa de Trabajo
exports.updateMesaTrabajo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      criterio_inclusion,
      diagnostico,
      codigo_diagnostico
    } = req.body;

    // Validaciones
    if (!criterio_inclusion || !diagnostico || !codigo_diagnostico) {
      return res.status(400).json({ 
        message: "Todos los campos son requeridos" 
      });
    }

    // Verificar que existe
    const existingMesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!existingMesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingMesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para editar esta Mesa de Trabajo" 
      });
    }

    const updatedMesaTrabajo = await mesaTrabajoModel.updateMesaTrabajo(id, {
      criterio_inclusion,
      diagnostico,
      codigo_diagnostico
    });

    res.json(updatedMesaTrabajo);
  } catch (err) {
    console.error("Error actualizando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al actualizar Mesa de Trabajo" });
  }
};

// Eliminar Mesa de Trabajo
exports.deleteMesaTrabajo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existingMesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!existingMesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingMesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para eliminar esta Mesa de Trabajo" 
      });
    }

    const deletedMesaTrabajo = await mesaTrabajoModel.deleteMesaTrabajo(id);
    res.json({ 
      message: "Mesa de Trabajo eliminada correctamente", 
      mesaTrabajo: deletedMesaTrabajo 
    });
  } catch (err) {
    console.error("Error eliminando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al eliminar Mesa de Trabajo" });
  }
};