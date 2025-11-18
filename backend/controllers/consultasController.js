// backend/controllers/consultasController.js

const consultaModel = require("../models/consultaModel");

// Crear nueva consulta
exports.createConsulta = async (req, res) => {
  try {
    const {
      cliente_id,
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado
    } = req.body;

    // Validaciones
    if (!cliente_id || !motivo_consulta || !actividad || !modalidad || !fecha || !estado) {
      return res.status(400).json({ 
        message: "Cliente, motivo de consulta, actividad, modalidad, fecha y estado son requeridos" 
      });
    }

    // Validar modalidad
    if (modalidad !== "Virtual" && modalidad !== "Presencial") {
      return res.status(400).json({ 
        message: "La modalidad debe ser 'Virtual' o 'Presencial'" 
      });
    }

    // Validar estado
    if (estado !== "Abierto" && estado !== "Cerrado") {
      return res.status(400).json({ 
        message: "El estado debe ser 'Abierto' o 'Cerrado'" 
      });
    }

    const newConsulta = await consultaModel.createConsulta({
      cliente_id,
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1: columna1 || null,
      estado
    });

    res.status(201).json(newConsulta);
  } catch (err) {
    console.error("Error creando consulta:", err);
    res.status(500).json({ message: "Error al crear consulta" });
  }
};

// ⭐ MODIFICADO: Obtener consultas según el rol del usuario
exports.getAllConsultas = async (req, res) => {
  try {
    const userRole = req.user.rol; // Del token JWT
    const userId = req.user.id;    // Del token JWT
    
    let consultas;
    
    if (userRole === 'admin') {
      // Admin ve TODAS las consultas
      consultas = await consultaModel.getAllConsultas();
    } else {
      // Profesionales solo ven consultas de sus clientes
      consultas = await consultaModel.getConsultasByProfesional(userId);
    }
    
    res.json(consultas);
  } catch (err) {
    console.error("Error obteniendo consultas:", err);
    res.status(500).json({ message: "Error al obtener consultas" });
  }
};

// Obtener consultas de un cliente específico
exports.getConsultasByCliente = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const consultas = await consultaModel.getConsultasByCliente(cliente_id);
    res.json(consultas);
  } catch (err) {
    console.error("Error obteniendo consultas del cliente:", err);
    res.status(500).json({ message: "Error al obtener consultas del cliente" });
  }
};

// Obtener consulta por ID
exports.getConsultaById = async (req, res) => {
  try {
    const { id } = req.params;
    const consulta = await consultaModel.getConsultaById(id);

    if (!consulta) {
      return res.status(404).json({ message: "Consulta no encontrada" });
    }

    res.json(consulta);
  } catch (err) {
    console.error("Error obteniendo consulta:", err);
    res.status(500).json({ message: "Error al obtener consulta" });
  }
};

// Actualizar consulta
exports.updateConsulta = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado
    } = req.body;

    // Validaciones
    if (!motivo_consulta || !actividad || !modalidad || !fecha || !estado) {
      return res.status(400).json({ 
        message: "Motivo de consulta, actividad, modalidad, fecha y estado son requeridos" 
      });
    }

    // Validar modalidad
    if (modalidad !== "Virtual" && modalidad !== "Presencial") {
      return res.status(400).json({ 
        message: "La modalidad debe ser 'Virtual' o 'Presencial'" 
      });
    }

    // Validar estado
    if (estado !== "Abierto" && estado !== "Cerrado") {
      return res.status(400).json({ 
        message: "El estado debe ser 'Abierto' o 'Cerrado'" 
      });
    }

    const updatedConsulta = await consultaModel.updateConsulta(id, {
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1: columna1 || null,
      estado
    });

    if (!updatedConsulta) {
      return res.status(404).json({ message: "Consulta no encontrada" });
    }

    res.json(updatedConsulta);
  } catch (err) {
    console.error("Error actualizando consulta:", err);
    res.status(500).json({ message: "Error al actualizar consulta" });
  }
};

// Eliminar consulta
exports.deleteConsulta = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedConsulta = await consultaModel.deleteConsulta(id);

    if (!deletedConsulta) {
      return res.status(404).json({ message: "Consulta no encontrada" });
    }

    res.json({ 
      message: "Consulta eliminada correctamente", 
      consulta: deletedConsulta 
    });
  } catch (err) {
    console.error("Error eliminando consulta:", err);
    res.status(500).json({ message: "Error al eliminar consulta" });
  }
};

// ⭐ MODIFICADO: Obtener estadísticas según el rol del usuario
exports.getEstadisticas = async (req, res) => {
  try {
    const userRole = req.user.rol; // Del token JWT
    const userId = req.user.id;    // Del token JWT
    
    let stats;
    
    if (userRole === 'admin') {
      // Admin ve estadísticas de TODAS las consultas
      stats = await consultaModel.getEstadisticas();
    } else {
      // Profesionales solo ven estadísticas de sus clientes
      stats = await consultaModel.getEstadisticasByProfesional(userId);
    }
    
    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas:", err);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
};