// backend/controllers/consultaSveController.js
const consultaSveModel = require("../models/consultaSveModel");
const mesaTrabajoModel = require("../models/mesaTrabajoSveModel");
const clientModel = require("../models/clientModel");

// Crear nueva consulta SVE
exports.createConsultaSve = async (req, res) => {
  try {
    const {
      cliente_id,
      fecha,
      modalidad,
      motivo_evaluacion,
      ajuste_funciones,
      recomendaciones_medicas,
      recomendaciones_trabajador,
      recomendaciones_empresa,
      observaciones,
      estado
    } = req.body;

    // Validaciones
    if (!cliente_id || !fecha || !modalidad || !motivo_evaluacion || 
        !ajuste_funciones || !recomendaciones_medicas || !recomendaciones_trabajador || 
        !recomendaciones_empresa || !estado) {
      return res.status(400).json({ 
        message: "Todos los campos obligatorios deben ser completados" 
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

    // Verificar que el cliente existe
    const cliente = await clientModel.getClientById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para crear consultas SVE para este cliente" 
      });
    }

    // Verificar que existe Mesa de Trabajo para este cliente
    const tieneMesaTrabajo = await mesaTrabajoModel.clienteTieneMesaTrabajo(cliente_id);
    if (!tieneMesaTrabajo) {
      return res.status(400).json({ 
        message: "Debe registrar primero la Mesa de Trabajo antes de crear consultas SVE" 
      });
    }

    const newConsultaSve = await consultaSveModel.createConsultaSve({
      cliente_id,
      fecha,
      modalidad,
      motivo_evaluacion,
      ajuste_funciones,
      recomendaciones_medicas,
      recomendaciones_trabajador,
      recomendaciones_empresa,
      observaciones: observaciones || null,
      estado
    });

    res.status(201).json(newConsultaSve);
  } catch (err) {
    console.error("Error creando consulta SVE:", err);
    res.status(500).json({ message: "Error al crear consulta SVE" });
  }
};

// Obtener todas las consultas SVE
exports.getAllConsultasSve = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;
    
    let consultas;
    
    if (userRole === 'admin') {
      consultas = await consultaSveModel.getAllConsultasSve();
    } else {
      consultas = await consultaSveModel.getConsultasSveByProfesional(userId);
    }
    
    res.json(consultas);
  } catch (err) {
    console.error("Error obteniendo consultas SVE:", err);
    res.status(500).json({ message: "Error al obtener consultas SVE" });
  }
};

// Obtener consultas SVE de un cliente específico
exports.getConsultasSveByCliente = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    
    // Verificar permisos
    const cliente = await clientModel.getClientById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para ver las consultas SVE de este cliente" 
      });
    }

    const consultas = await consultaSveModel.getConsultasSveByCliente(cliente_id);
    res.json(consultas);
  } catch (err) {
    console.error("Error obteniendo consultas SVE del cliente:", err);
    res.status(500).json({ message: "Error al obtener consultas SVE del cliente" });
  }
};

// Obtener consulta SVE por ID
exports.getConsultaSveById = async (req, res) => {
  try {
    const { id } = req.params;
    const consulta = await consultaSveModel.getConsultaSveById(id);

    if (!consulta) {
      return res.status(404).json({ message: "Consulta SVE no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(consulta.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para ver esta consulta SVE" 
      });
    }

    res.json(consulta);
  } catch (err) {
    console.error("Error obteniendo consulta SVE:", err);
    res.status(500).json({ message: "Error al obtener consulta SVE" });
  }
};

// Actualizar consulta SVE
exports.updateConsultaSve = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fecha,
      modalidad,
      motivo_evaluacion,
      ajuste_funciones,
      recomendaciones_medicas,
      recomendaciones_trabajador,
      recomendaciones_empresa,
      observaciones,
      estado
    } = req.body;

    // Validaciones
    if (!fecha || !modalidad || !motivo_evaluacion || 
        !ajuste_funciones || !recomendaciones_medicas || !recomendaciones_trabajador || 
        !recomendaciones_empresa || !estado) {
      return res.status(400).json({ 
        message: "Todos los campos obligatorios deben ser completados" 
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

    // Verificar que existe
    const existingConsulta = await consultaSveModel.getConsultaSveById(id);
    if (!existingConsulta) {
      return res.status(404).json({ message: "Consulta SVE no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingConsulta.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para editar esta consulta SVE" 
      });
    }

    const updatedConsulta = await consultaSveModel.updateConsultaSve(id, {
      fecha,
      modalidad,
      motivo_evaluacion,
      ajuste_funciones,
      recomendaciones_medicas,
      recomendaciones_trabajador,
      recomendaciones_empresa,
      observaciones: observaciones || null,
      estado
    });

    res.json(updatedConsulta);
  } catch (err) {
    console.error("Error actualizando consulta SVE:", err);
    res.status(500).json({ message: "Error al actualizar consulta SVE" });
  }
};

// Eliminar consulta SVE
exports.deleteConsultaSve = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existingConsulta = await consultaSveModel.getConsultaSveById(id);
    if (!existingConsulta) {
      return res.status(404).json({ message: "Consulta SVE no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingConsulta.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para eliminar esta consulta SVE" 
      });
    }

    const deletedConsulta = await consultaSveModel.deleteConsultaSve(id);
    res.json({ 
      message: "Consulta SVE eliminada correctamente", 
      consulta: deletedConsulta 
    });
  } catch (err) {
    console.error("Error eliminando consulta SVE:", err);
    res.status(500).json({ message: "Error al eliminar consulta SVE" });
  }
};

// Obtener estadísticas de consultas SVE
exports.getEstadisticasSve = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;
    
    let stats;
    
    if (userRole === 'admin') {
      stats = await consultaSveModel.getEstadisticasSve();
    } else {
      stats = await consultaSveModel.getEstadisticasSveByProfesional(userId);
    }
    
    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas SVE:", err);
    res.status(500).json({ message: "Error al obtener estadísticas SVE" });
  }
};

// ⭐ NUEVA FUNCIÓN: Obtener estadísticas completas del Dashboard SVE
exports.getEstadisticasDashboardSVE = async (req, res) => {
  try {
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    let stats;
    
    if (userRole === 'admin') {
      // Admin ve estadísticas de TODO el sistema SVE
      stats = await consultaSveModel.getEstadisticasDashboardSVE();
    } else {
      // Profesionales solo ven sus datos
      stats = await consultaSveModel.getEstadisticasDashboardSVEByProfesional(userId);
    }
    
    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas Dashboard SVE:", err);
    res.status(500).json({ message: "Error al obtener estadísticas del Dashboard SVE" });
  }
};

// ⭐ NUEVA FUNCIÓN: Obtener datos para gráfico de criterios de inclusión
exports.getEstadisticasCriteriosInclusion = async (req, res) => {
  try {
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    let stats;
    
    if (userRole === 'admin') {
      stats = await consultaSveModel.getEstadisticasCriteriosInclusion();
    } else {
      stats = await consultaSveModel.getEstadisticasCriteriosInclusionByProfesional(userId);
    }
    
    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas de criterios:", err);
    res.status(500).json({ message: "Error al obtener estadísticas de criterios de inclusión" });
  }
};

// ⭐ NUEVA FUNCIÓN: Obtener evolución temporal de consultas SVE
exports.getEvolucionConsultasSVE = async (req, res) => {
  try {
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    let stats;
    
    if (userRole === 'admin') {
      stats = await consultaSveModel.getEvolucionConsultasSVE();
    } else {
      stats = await consultaSveModel.getEvolucionConsultasSVEByProfesional(userId);
    }
    
    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo evolución de consultas SVE:", err);
    res.status(500).json({ message: "Error al obtener evolución de consultas SVE" });
  }
};