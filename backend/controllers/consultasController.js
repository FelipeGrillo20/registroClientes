// backend/controllers/consultasController.js

const consultaModel = require("../models/consultaModel");

// ============================================
// Crear nueva consulta / sesión
//
// El frontend envía un campo opcional "consulta_number":
//
//   - Si viene    → es una sesión adicional de una consulta existente.
//                   Solo validamos que ese consulta_number exista y esté Abierto.
//
//   - Si NO viene → es la primera sesión de una consulta NUEVA.
//                   Calculamos MAX(consulta_number) + 1 y validamos que no
//                   haya otra consulta abierta del mismo trabajador.
// ============================================
exports.createConsulta = async (req, res) => {
  try {
    const {
      cliente_id,
      consulta_number: consulta_number_recibido, // opcional desde el frontend
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado,
      observaciones_confidenciales
    } = req.body;

    // --- Validaciones básicas ---
    if (!cliente_id || !motivo_consulta || !actividad || !modalidad || !fecha || !estado) {
      return res.status(400).json({
        message: "Cliente, motivo de consulta, actividad, modalidad, fecha y estado son requeridos"
      });
    }

    if (modalidad !== "Virtual" && modalidad !== "Presencial") {
      return res.status(400).json({
        message: "La modalidad debe ser 'Virtual' o 'Presencial'"
      });
    }

    if (estado !== "Abierto" && estado !== "Cerrado") {
      return res.status(400).json({
        message: "El estado debe ser 'Abierto' o 'Cerrado'"
      });
    }

    let consulta_number;

    if (consulta_number_recibido) {
      // --- Caso A: sesión adicional de una consulta existente ---
      // El frontend conoce el consulta_number activo y lo envía.
      // No recalculamos ni bloqueamos por consulta abierta, porque
      // precisamente esa consulta ya está abierta y le pertenece.
      consulta_number = parseInt(consulta_number_recibido);
    } else {
      // --- Caso B: primera sesión de una consulta NUEVA ---
      // Verificar que no haya otra consulta abierta del trabajador
      // (regla: máximo una consulta abierta por trabajador)
      const nextNumber = await consultaModel.getNextConsultaNumber(cliente_id);

      const tieneAbiertaEnOtro = await consultaModel.tieneConsultaAbiertaEnOtroNumero(
        cliente_id,
        nextNumber
      );

      if (tieneAbiertaEnOtro) {
        return res.status(409).json({
          message: "El trabajador ya tiene una consulta abierta. Debe cerrarla antes de abrir una nueva."
        });
      }

      consulta_number = nextNumber;
    }

    const newConsulta = await consultaModel.createConsulta({
      cliente_id,
      consulta_number,
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1: columna1 || null,
      estado,
      observaciones_confidenciales: observaciones_confidenciales || false
    });

    res.status(201).json(newConsulta);
  } catch (err) {
    console.error("Error creando consulta:", err);
    res.status(500).json({ message: "Error al crear consulta" });
  }
};

// ============================================
// Obtener consultas según el rol del usuario
// ============================================
exports.getAllConsultas = async (req, res) => {
  try {
    const userRole = req.user.rol;
    const userId = req.user.id;

    let consultas;

    if (userRole === 'admin') {
      consultas = await consultaModel.getAllConsultas();
    } else {
      consultas = await consultaModel.getConsultasByProfesional(userId);
    }

    res.json(consultas);
  } catch (err) {
    console.error("Error obteniendo consultas:", err);
    res.status(500).json({ message: "Error al obtener consultas" });
  }
};

// ============================================
// Obtener consultas de un cliente específico
// ============================================
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

// ============================================
// Obtener consulta por ID
// ============================================
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

// ============================================
// Actualizar consulta
// consulta_number NO se toca en el UPDATE
// ============================================
exports.updateConsulta = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      motivo_consulta,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado,
      observaciones_confidenciales
    } = req.body;

    if (!motivo_consulta || !actividad || !modalidad || !fecha || !estado) {
      return res.status(400).json({
        message: "Motivo de consulta, actividad, modalidad, fecha y estado son requeridos"
      });
    }

    if (modalidad !== "Virtual" && modalidad !== "Presencial") {
      return res.status(400).json({
        message: "La modalidad debe ser 'Virtual' o 'Presencial'"
      });
    }

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
      estado,
      observaciones_confidenciales: observaciones_confidenciales !== undefined
        ? observaciones_confidenciales
        : false
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

// ============================================
// Eliminar consulta
// ============================================
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

// ============================================
// Cerrar una consulta completa
// PUT /api/consultas/cerrar
// Body: { cliente_id, consulta_number, fecha_cierre, recomendaciones_finales }
// ============================================
exports.cerrarConsulta = async (req, res) => {
  try {
    const { cliente_id, consulta_number, fecha_cierre, recomendaciones_finales } = req.body;

    if (!cliente_id || !consulta_number || !fecha_cierre) {
      return res.status(400).json({
        message: "cliente_id, consulta_number y fecha_cierre son requeridos"
      });
    }

    const sesiones = await consultaModel.cerrarConsulta(
      cliente_id,
      consulta_number,
      fecha_cierre,
      recomendaciones_finales || null
    );

    if (!sesiones || sesiones.length === 0) {
      return res.status(404).json({ message: "No se encontraron sesiones para cerrar" });
    }

    res.json({ message: "Consulta cerrada correctamente", sesiones });
  } catch (err) {
    console.error("Error cerrando consulta:", err);
    res.status(500).json({ message: "Error al cerrar la consulta" });
  }
};

// ============================================
// Reabrir una consulta
// PUT /api/consultas/reabrir
// Body: { cliente_id, consulta_number }
// ============================================
exports.reabrirConsulta = async (req, res) => {
  try {
    const { cliente_id, consulta_number } = req.body;

    if (!cliente_id || !consulta_number) {
      return res.status(400).json({
        message: "cliente_id y consulta_number son requeridos"
      });
    }

    // Regla de negocio: solo una consulta abierta por trabajador.
    // Verificar que no haya otra consulta abierta con distinto consulta_number.
    const tieneAbierta = await consultaModel.tieneConsultaAbiertaEnOtroNumero(
      cliente_id,
      parseInt(consulta_number)
    );

    if (tieneAbierta) {
      return res.status(409).json({
        message: `El trabajador ya tiene otra consulta abierta. Ciérrala antes de reabrir esta.`
      });
    }

    const sesiones = await consultaModel.reabrirConsulta(cliente_id, consulta_number);

    if (!sesiones || sesiones.length === 0) {
      return res.status(404).json({ message: "No se encontraron sesiones para reabrir" });
    }

    res.json({ message: "Consulta reabierta correctamente", sesiones });
  } catch (err) {
    console.error("Error reabriendo consulta:", err);
    res.status(500).json({ message: "Error al reabrir la consulta" });
  }
};

// ============================================
// Guardar consultas sugeridas
// PUT /api/consultas/sugeridas
// Body: { cliente_id, consulta_number, consultas_sugeridas }
// ============================================
exports.guardarConsultasSugeridas = async (req, res) => {
  try {
    const { cliente_id, consulta_number, consultas_sugeridas } = req.body;

    if (!cliente_id || !consulta_number || consultas_sugeridas === undefined) {
      return res.status(400).json({
        message: "cliente_id, consulta_number y consultas_sugeridas son requeridos"
      });
    }

    const sesiones = await consultaModel.guardarConsultasSugeridas(
      cliente_id,
      consulta_number,
      parseInt(consultas_sugeridas)
    );

    res.json({ message: "Consultas sugeridas guardadas", sesiones });
  } catch (err) {
    console.error("Error guardando consultas sugeridas:", err);
    res.status(500).json({ message: "Error al guardar consultas sugeridas" });
  }
};

// ============================================
// Obtener datos de cierre de una consulta
// GET /api/consultas/cierre/:cliente_id/:consulta_number
// ============================================
exports.getDatosCierreConsulta = async (req, res) => {
  try {
    const { cliente_id, consulta_number } = req.params;
    const datos = await consultaModel.getDatosCierreConsulta(cliente_id, consulta_number);
    res.json(datos || {});
  } catch (err) {
    console.error("Error obteniendo datos de cierre:", err);
    res.status(500).json({ message: "Error al obtener datos de cierre" });
  }
};

// ============================================
// Estadísticas según rol del usuario
// ============================================
exports.getEstadisticas = async (req, res) => {
  try {
    const userRole = req.user.rol;
    const userId = req.user.id;

    let stats;

    if (userRole === 'admin') {
      stats = await consultaModel.getEstadisticas();
    } else {
      stats = await consultaModel.getEstadisticasByProfesional(userId);
    }

    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas:", err);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
};

// ============================================
// Estadísticas detalladas por profesional (solo admin)
// ============================================
exports.getEstadisticasDetalladasByProfesional = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const { profesional_id } = req.query;

    if (userRole !== 'admin') {
      return res.status(403).json({ message: "No tienes permisos para ver estas estadísticas" });
    }

    if (!profesional_id) {
      return res.status(400).json({ message: "Se requiere el ID del profesional" });
    }

    const stats = await consultaModel.getEstadisticasDetalladasByProfesional(profesional_id);

    res.json(stats);
  } catch (err) {
    console.error("Error obteniendo estadísticas detalladas:", err);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
};
// ============================================
// Obtener sesiones de un profesional por mes/año
// GET /api/consultas/sesiones-creditos?profesional_id=&anio=&mes=
// Usado desde creditos.html al pulsar "Generar"
// ============================================
exports.getSesionesCreditos = async (req, res) => {
  try {
    const { profesional_id, anio, mes } = req.query;

    if (!profesional_id || !anio || !mes) {
      return res.status(400).json({
        message: "profesional_id, anio y mes son requeridos"
      });
    }

    const sesiones = await consultaModel.getSesionesByProfesionalMesAnio(
      parseInt(profesional_id),
      parseInt(anio),
      parseInt(mes)
    );

    res.json(sesiones);
  } catch (err) {
    console.error("Error obteniendo sesiones para créditos:", err);
    res.status(500).json({ message: "Error al obtener sesiones" });
  }
};

// ============================================
// Sesiones SIN crédito asignado de un profesional
// GET /api/consultas/sesiones-sin-asignacion?profesional_id=
// Usado desde el modal "Trabajadores sin asignación"
// ============================================
exports.getSesionesSinAsignacion = async (req, res) => {
  try {
    const { profesional_id } = req.query;

    if (!profesional_id) {
      return res.status(400).json({ message: "profesional_id es requerido" });
    }

    const sesiones = await consultaModel.getSesionesSinAsignacion(
      parseInt(profesional_id)
    );

    res.json(sesiones);
  } catch (err) {
    console.error("Error obteniendo sesiones sin asignación:", err);
    res.status(500).json({ message: "Error al obtener sesiones sin asignación" });
  }
};