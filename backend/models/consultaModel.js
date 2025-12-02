// backend/models/consultaModel.js
const pool = require("../config/db");

// Crear una nueva consulta
exports.createConsulta = async (data) => {
  const {
    cliente_id,
    motivo_consulta,
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    observaciones_confidenciales // ⭐ NUEVO
  } = data;

  const result = await pool.query(
    `INSERT INTO consultas 
    (cliente_id, motivo_consulta, actividad, modalidad, fecha, columna1, estado, observaciones_confidenciales)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [cliente_id, motivo_consulta, actividad, modalidad, fecha, columna1, estado, observaciones_confidenciales]
  );

  return result.rows[0];
};

// Obtener todas las consultas
exports.getAllConsultas = async () => {
  const result = await pool.query(`
    SELECT 
      c.*,
      cl.cedula,
      cl.nombre,
      cl.sede
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    ORDER BY c.fecha DESC, c.created_at DESC
  `);
  return result.rows;
};

// ⭐ NUEVO: Obtener consultas filtradas por profesional
exports.getConsultasByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      cl.cedula,
      cl.nombre,
      cl.sede
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
    ORDER BY c.fecha DESC, c.created_at DESC
  `, [profesionalId]);
  return result.rows;
};

// Obtener consultas de un cliente específico
exports.getConsultasByCliente = async (cliente_id) => {
  const result = await pool.query(
    `SELECT * FROM consultas 
     WHERE cliente_id = $1 
     ORDER BY fecha DESC, created_at DESC`,
    [cliente_id]
  );
  return result.rows;
};

// Obtener una consulta por ID
exports.getConsultaById = async (id) => {
  const result = await pool.query(
    `SELECT 
      c.*,
      cl.cedula,
      cl.nombre,
      cl.sede,
      cl.email,
      cl.telefono
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE c.id = $1`,
    [id]
  );
  return result.rows[0];
};

// Actualizar una consulta
exports.updateConsulta = async (id, data) => {
  const {
    motivo_consulta,
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    observaciones_confidenciales // ⭐ NUEVO
  } = data;

  const result = await pool.query(
    `UPDATE consultas SET
      motivo_consulta = $1,
      actividad = $2,
      modalidad = $3,
      fecha = $4,
      columna1 = $5,
      estado = $6,
      observaciones_confidenciales = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *`,
    [motivo_consulta, actividad, modalidad, fecha, columna1, estado, observaciones_confidenciales, id]
  );

  return result.rows[0];
};

// Eliminar una consulta
exports.deleteConsulta = async (id) => {
  const result = await pool.query(
    "DELETE FROM consultas WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// Obtener estadísticas de consultas
exports.getEstadisticas = async () => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_consultas,
      COUNT(CASE WHEN estado = 'Abierto' THEN 1 END) as casos_abiertos,
      COUNT(CASE WHEN estado = 'Cerrado' THEN 1 END) as casos_cerrados,
      COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
      COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as consultas_presenciales
    FROM consultas
  `);
  return result.rows[0];
};

// ⭐ NUEVO: Obtener estadísticas filtradas por profesional
exports.getEstadisticasByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_consultas,
      COUNT(CASE WHEN c.estado = 'Abierto' THEN 1 END) as casos_abiertos,
      COUNT(CASE WHEN c.estado = 'Cerrado' THEN 1 END) as casos_cerrados,
      COUNT(CASE WHEN c.modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
      COUNT(CASE WHEN c.modalidad = 'Presencial' THEN 1 END) as consultas_presenciales
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
  `, [profesionalId]);
  return result.rows[0];
};

// ⭐ NUEVO: Obtener estadísticas detalladas por profesional
exports.getEstadisticasDetalladasByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      -- Total de consultas realizadas
      COUNT(c.id) as total_consultas,
      
      -- Total de pacientes únicos atendidos
      COUNT(DISTINCT c.cliente_id) as pacientes_atendidos,
      
      -- Total de casos cerrados (clientes con fecha_cierre)
      COUNT(DISTINCT CASE 
        WHEN cl.fecha_cierre IS NOT NULL THEN cl.id 
      END) as casos_cerrados,
      
      -- Consultas por estado
      COUNT(CASE WHEN c.estado = 'Abierto' THEN 1 END) as consultas_abiertas,
      COUNT(CASE WHEN c.estado = 'Cerrado' THEN 1 END) as consultas_cerradas,
      
      -- Consultas por modalidad
      COUNT(CASE WHEN c.modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
      COUNT(CASE WHEN c.modalidad = 'Presencial' THEN 1 END) as consultas_presenciales
      
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
  `, [profesionalId]);
  
  return result.rows[0];
};