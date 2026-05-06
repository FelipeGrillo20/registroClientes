// backend/models/consultaModel.js
const pool = require("../config/db");

// ============================================
// UTILIDAD: Calcular el próximo consulta_number
// para un cliente dado. Si no tiene registros → 1
// Si ya tiene → MAX(consulta_number) + 1
// ============================================
exports.getNextConsultaNumber = async (cliente_id) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(consulta_number), 0) AS max_num
     FROM consultas
     WHERE cliente_id = $1`,
    [cliente_id]
  );
  return parseInt(result.rows[0].max_num) + 1;
};

// ============================================
// UTILIDAD: Verificar si el cliente tiene alguna
// consulta abierta en un consulta_number DISTINTO
// al que se está intentando registrar.
//
// Esto permite:
//   - Agregar sesiones a una consulta ya abierta (mismo consulta_number) ✅
//   - Bloquear abrir una NUEVA consulta si hay una abierta (distinto número) ❌
// ============================================
exports.tieneConsultaAbiertaEnOtroNumero = async (cliente_id, consulta_number) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total
     FROM consultas
     WHERE cliente_id = $1
       AND estado = 'Abierto'
       AND consulta_number != $2`,
    [cliente_id, consulta_number]
  );
  return parseInt(result.rows[0].total) > 0;
};

// ============================================
// Crear una nueva consulta
// consulta_number se calcula antes de llamar
// a esta función (desde el controller)
// ============================================
exports.createConsulta = async (data) => {
  const {
    cliente_id,
    consulta_number,
    motivo_consulta,
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    observaciones_confidenciales,
    consultas_sugeridas
  } = data;

  const result = await pool.query(
    `INSERT INTO consultas
    (cliente_id, consulta_number, motivo_consulta, actividad, modalidad, fecha,
     columna1, estado, observaciones_confidenciales, consultas_sugeridas)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [cliente_id, consulta_number, motivo_consulta, actividad, modalidad, fecha,
     columna1, estado, observaciones_confidenciales, consultas_sugeridas || null]
  );

  return result.rows[0];
};

// ============================================
// Obtener todas las consultas
// ============================================
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

// Obtener consultas filtradas por profesional
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

// ============================================
// Obtener consultas de un cliente específico
// Ordenadas por consulta_number ASC, fecha ASC
// para que el historial salga en orden correcto
// ============================================
exports.getConsultasByCliente = async (cliente_id) => {
  const result = await pool.query(
    `SELECT * FROM consultas
     WHERE cliente_id = $1
     ORDER BY consulta_number ASC, fecha ASC, created_at ASC`,
    [cliente_id]
  );
  return result.rows;
};

// ============================================
// Obtener una consulta por ID
// ============================================
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

// ============================================
// Actualizar una consulta (sesión individual)
// consulta_number NO se modifica en el UPDATE
// ============================================
exports.updateConsulta = async (id, data) => {
  const {
    motivo_consulta,
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    observaciones_confidenciales
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

// ============================================
// Cerrar una consulta completa:
// Escribe fecha_cierre y recomendaciones_finales
// en TODOS los registros del mismo consulta_number.
// Se usa al hacer "Cerrar caso".
// ============================================
exports.cerrarConsulta = async (cliente_id, consulta_number, fecha_cierre, recomendaciones_finales) => {
  const result = await pool.query(
    `UPDATE consultas SET
      estado = 'Cerrado',
      fecha_cierre = $1,
      recomendaciones_finales = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE cliente_id = $3
      AND consulta_number = $4
    RETURNING *`,
    [fecha_cierre, recomendaciones_finales, cliente_id, consulta_number]
  );
  return result.rows;
};

// ============================================
// Reabrir una consulta:
// Limpia fecha_cierre y recomendaciones_finales
// y vuelve el estado a 'Abierto' para ese
// consulta_number.
// ============================================
exports.reabrirConsulta = async (cliente_id, consulta_number) => {
  const result = await pool.query(
    `UPDATE consultas SET
      estado = 'Abierto',
      fecha_cierre = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE cliente_id = $1
      AND consulta_number = $2
    RETURNING *`,
    [cliente_id, consulta_number]
  );
  return result.rows;
};

// ============================================
// Guardar consultas_sugeridas en la primera
// sesión de una consulta (consulta_number dado).
// Se llama solo al registrar la sesión 1.
// ============================================
exports.guardarConsultasSugeridas = async (cliente_id, consulta_number, consultas_sugeridas) => {
  const result = await pool.query(
    `UPDATE consultas SET
      consultas_sugeridas = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE cliente_id = $2
      AND consulta_number = $3
    RETURNING *`,
    [consultas_sugeridas, cliente_id, consulta_number]
  );
  return result.rows;
};

// ============================================
// Obtener los datos de cierre de una consulta
// (fecha_cierre y recomendaciones_finales)
// Busca en la primera sesión del consulta_number
// donde fecha_cierre no sea NULL.
// ============================================
exports.getDatosCierreConsulta = async (cliente_id, consulta_number) => {
  const result = await pool.query(
    `SELECT fecha_cierre, recomendaciones_finales, consultas_sugeridas
     FROM consultas
     WHERE cliente_id = $1
       AND consulta_number = $2
       AND fecha_cierre IS NOT NULL
     LIMIT 1`,
    [cliente_id, consulta_number]
  );
  return result.rows[0] || null;
};

// ============================================
// Eliminar una consulta
// ============================================
exports.deleteConsulta = async (id) => {
  const result = await pool.query(
    "DELETE FROM consultas WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// ============================================
// Estadísticas globales (admin)
// ============================================
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

// Estadísticas filtradas por profesional
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

// Estadísticas detalladas por profesional (solo admin)
exports.getEstadisticasDetalladasByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT
      COUNT(c.id) as total_consultas,
      COUNT(DISTINCT c.cliente_id) as pacientes_atendidos,
      COUNT(DISTINCT CASE
        WHEN c.fecha_cierre IS NOT NULL THEN c.cliente_id || '-' || c.consulta_number
      END) as casos_cerrados,
      COUNT(CASE WHEN c.estado = 'Abierto' THEN 1 END) as consultas_abiertas,
      COUNT(CASE WHEN c.estado = 'Cerrado' THEN 1 END) as consultas_cerradas,
      COUNT(CASE WHEN c.modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
      COUNT(CASE WHEN c.modalidad = 'Presencial' THEN 1 END) as consultas_presenciales
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
  `, [profesionalId]);

  return result.rows[0];
};
// ============================================
// Obtener sesiones de un profesional filtradas
// por año y mes (para asignación de créditos)
// Devuelve cada sesión como fila independiente
// ============================================
exports.getSesionesByProfesionalMesAnio = async (profesional_id, anio, mes) => {
  const result = await pool.query(`
    SELECT
      c.id,
      c.cliente_id,
      c.consulta_number,
      c.fecha,
      c.motivo_consulta,
      c.actividad,
      c.modalidad,
      c.estado,
      cl.nombre  AS trabajador_nombre,
      cl.cedula  AS trabajador_cedula
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
      AND EXTRACT(YEAR  FROM c.fecha) = $2
      AND EXTRACT(MONTH FROM c.fecha) = $3
    ORDER BY cl.nombre ASC, c.fecha ASC, c.consulta_number ASC
  `, [profesional_id, anio, mes]);
  return result.rows;
};

// ============================================
// Sesiones SIN crédito asignado de un profesional
// Todas las fechas, ordenadas cronológicamente
// Se filtra por credito_id IS NULL en tabla citas
// ============================================
exports.getSesionesSinAsignacion = async (profesional_id) => {
  const result = await pool.query(`
    SELECT
      c.id,
      c.cliente_id,
      c.consulta_number,
      c.fecha,
      c.motivo_consulta,
      c.actividad,
      c.modalidad,
      c.estado,
      cl.nombre  AS trabajador_nombre,
      cl.cedula  AS trabajador_cedula,
      EXTRACT(YEAR  FROM c.fecha)::int AS anio,
      EXTRACT(MONTH FROM c.fecha)::int AS mes
    FROM consultas c
    INNER JOIN clients cl ON c.cliente_id = cl.id
    WHERE cl.profesional_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM citas ci
        WHERE ci.trabajador_id = c.cliente_id
          AND ci.credito_id IS NOT NULL
          AND DATE_TRUNC('month', ci.fecha) = DATE_TRUNC('month', c.fecha)
      )
    ORDER BY c.fecha ASC, cl.nombre ASC
  `, [profesional_id]);
  return result.rows;
};