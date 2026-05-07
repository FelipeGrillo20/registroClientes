// backend/models/consultaSveModel.js
const pool = require("../config/db");

// Crear una nueva consulta SVE
exports.createConsultaSve = async (data) => {
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
  } = data;

  const result = await pool.query(
    `INSERT INTO consultas_sve 
    (cliente_id, fecha, modalidad, motivo_evaluacion, ajuste_funciones, 
     recomendaciones_medicas, recomendaciones_trabajador, recomendaciones_empresa, 
     observaciones, estado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [cliente_id, fecha, modalidad, motivo_evaluacion, ajuste_funciones, 
     recomendaciones_medicas, recomendaciones_trabajador, recomendaciones_empresa, 
     observaciones, estado]
  );

  return result.rows[0];
};

// Obtener todas las consultas SVE
exports.getAllConsultasSve = async () => {
  const result = await pool.query(`
    SELECT 
      cs.*,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono,
      u.nombre AS profesional_nombre
    FROM consultas_sve cs
    INNER JOIN clients c ON cs.cliente_id = c.id
    LEFT JOIN users u ON c.profesional_id = u.id
    ORDER BY cs.fecha DESC, cs.created_at DESC
  `);
  return result.rows;
};

// Obtener consultas SVE filtradas por profesional
exports.getConsultasSveByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      cs.*,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono,
      u.nombre AS profesional_nombre
    FROM consultas_sve cs
    INNER JOIN clients c ON cs.cliente_id = c.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.profesional_id = $1
    ORDER BY cs.fecha DESC, cs.created_at DESC
  `, [profesionalId]);
  return result.rows;
};

// Obtener consultas SVE de un cliente específico
exports.getConsultasSveByCliente = async (cliente_id) => {
  const result = await pool.query(
    `SELECT * FROM consultas_sve 
     WHERE cliente_id = $1 
     ORDER BY fecha DESC, created_at DESC`,
    [cliente_id]
  );
  return result.rows;
};

// Obtener una consulta SVE por ID
exports.getConsultaSveById = async (id) => {
  const result = await pool.query(
    `SELECT 
      cs.*,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono,
      u.nombre AS profesional_nombre
    FROM consultas_sve cs
    INNER JOIN clients c ON cs.cliente_id = c.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE cs.id = $1`,
    [id]
  );
  return result.rows[0];
};

// Actualizar una consulta SVE
exports.updateConsultaSve = async (id, data) => {
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
  } = data;

  const result = await pool.query(
    `UPDATE consultas_sve SET
      fecha = $1,
      modalidad = $2,
      motivo_evaluacion = $3,
      ajuste_funciones = $4,
      recomendaciones_medicas = $5,
      recomendaciones_trabajador = $6,
      recomendaciones_empresa = $7,
      observaciones = $8,
      estado = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *`,
    [fecha, modalidad, motivo_evaluacion, ajuste_funciones, 
     recomendaciones_medicas, recomendaciones_trabajador, recomendaciones_empresa, 
     observaciones, estado, id]
  );

  return result.rows[0];
};

// Eliminar una consulta SVE
exports.deleteConsultaSve = async (id) => {
  const result = await pool.query(
    "DELETE FROM consultas_sve WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// Obtener estadísticas de consultas SVE
exports.getEstadisticasSve = async () => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_consultas_sve,
      COUNT(CASE WHEN estado = 'Abierto' THEN 1 END) as casos_abiertos_sve,
      COUNT(CASE WHEN estado = 'Cerrado' THEN 1 END) as casos_cerrados_sve,
      COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as consultas_virtuales_sve,
      COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as consultas_presenciales_sve
    FROM consultas_sve
  `);
  return result.rows[0];
};

// Obtener estadísticas SVE filtradas por profesional
exports.getEstadisticasSveByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_consultas_sve,
      COUNT(CASE WHEN cs.estado = 'Abierto' THEN 1 END) as casos_abiertos_sve,
      COUNT(CASE WHEN cs.estado = 'Cerrado' THEN 1 END) as casos_cerrados_sve,
      COUNT(CASE WHEN cs.modalidad = 'Virtual' THEN 1 END) as consultas_virtuales_sve,
      COUNT(CASE WHEN cs.modalidad = 'Presencial' THEN 1 END) as consultas_presenciales_sve
    FROM consultas_sve cs
    INNER JOIN clients c ON cs.cliente_id = c.id
    WHERE c.profesional_id = $1
  `, [profesionalId]);
  return result.rows[0];
};

// ✅ FUNCIÓN CORREGIDA: Estadísticas completas del Dashboard SVE
exports.getEstadisticasDashboardSVE = async () => {
  const result = await pool.query(`
    WITH mesa_trabajo_stats AS (
      SELECT 
        COUNT(DISTINCT mt.cliente_id) as total_casos_sve,
        COUNT(DISTINCT CASE WHEN mt.created_at >= NOW() - INTERVAL '30 days' THEN mt.cliente_id END) as casos_nuevos_mes
      FROM mesa_trabajo_sve mt
    ),
    consultas_stats AS (
      SELECT 
        COUNT(*) as total_sesiones_sve,
        COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
        COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as consultas_presenciales,
        COUNT(DISTINCT CASE WHEN fecha >= NOW() - INTERVAL '30 days' THEN cliente_id END) as consultas_mes_actual
      FROM consultas_sve
    ),
    clientes_stats AS (
      SELECT 
        -- ✅ CASOS CERRADOS: Clientes con Mesa de Trabajo Y fecha_cierre_sve
        COUNT(DISTINCT CASE 
          WHEN c.fecha_cierre_sve IS NOT NULL 
          AND EXISTS(SELECT 1 FROM mesa_trabajo_sve mt WHERE mt.cliente_id = c.id) 
          THEN c.id 
        END) as casos_cerrados,
        
        -- ✅ CASOS ABIERTOS: Clientes con Mesa de Trabajo pero SIN fecha_cierre_sve
        COUNT(DISTINCT CASE 
          WHEN c.fecha_cierre_sve IS NULL 
          AND EXISTS(SELECT 1 FROM mesa_trabajo_sve mt WHERE mt.cliente_id = c.id) 
          THEN c.id 
        END) as casos_abiertos,
        
        COUNT(DISTINCT CASE WHEN fecha_cierre_sve IS NOT NULL THEN id END) as trabajadores_casos_cerrados,
        COUNT(DISTINCT CASE WHEN fecha_cierre_sve IS NULL AND EXISTS(
          SELECT 1 FROM mesa_trabajo_sve WHERE cliente_id = c.id
        ) THEN id END) as trabajadores_seguimiento_activo
      FROM clients c
    ),
    promedio_consultas AS (
      SELECT 
        COALESCE(ROUND(AVG(num_consultas), 2), 0) as promedio_consultas_por_caso
      FROM (
        SELECT cs.cliente_id, COUNT(*) as num_consultas
        FROM consultas_sve cs
        INNER JOIN mesa_trabajo_sve mt ON cs.cliente_id = mt.cliente_id
        GROUP BY cs.cliente_id
      ) sub
    ),
    tasa_cierre_calc AS (
      SELECT 
        CASE 
          WHEN (SELECT total_casos_sve FROM mesa_trabajo_stats) > 0 
          THEN ROUND(
            (SELECT casos_cerrados FROM clientes_stats)::numeric * 100.0 / 
            (SELECT total_casos_sve FROM mesa_trabajo_stats)::numeric, 
            2
          )
          ELSE 0 
        END as tasa_cierre
    )
    SELECT 
      mt.*,
      cs.*,
      cl.*,
      pc.*,
      tc.tasa_cierre
    FROM mesa_trabajo_stats mt
    CROSS JOIN consultas_stats cs
    CROSS JOIN clientes_stats cl
    CROSS JOIN promedio_consultas pc
    CROSS JOIN tasa_cierre_calc tc
  `);
  
  return result.rows[0];
};

// ✅ FUNCIÓN CORREGIDA: Estadísticas Dashboard SVE por profesional
exports.getEstadisticasDashboardSVEByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    WITH mesa_trabajo_stats AS (
      SELECT 
        COUNT(DISTINCT mt.cliente_id) as total_casos_sve,
        COUNT(DISTINCT CASE WHEN mt.created_at >= NOW() - INTERVAL '30 days' THEN mt.cliente_id END) as casos_nuevos_mes
      FROM mesa_trabajo_sve mt
      INNER JOIN clients c ON mt.cliente_id = c.id
      WHERE c.profesional_id = $1
    ),
    consultas_stats AS (
      SELECT 
        COUNT(*) as total_sesiones_sve,
        COUNT(CASE WHEN cs.modalidad = 'Virtual' THEN 1 END) as consultas_virtuales,
        COUNT(CASE WHEN cs.modalidad = 'Presencial' THEN 1 END) as consultas_presenciales,
        COUNT(DISTINCT CASE WHEN cs.fecha >= NOW() - INTERVAL '30 days' THEN cs.cliente_id END) as consultas_mes_actual
      FROM consultas_sve cs
      INNER JOIN clients c ON cs.cliente_id = c.id
      WHERE c.profesional_id = $1
    ),
    clientes_stats AS (
      SELECT 
        -- ✅ CASOS CERRADOS: Clientes con Mesa de Trabajo Y fecha_cierre_sve
        COUNT(DISTINCT CASE 
          WHEN c.fecha_cierre_sve IS NOT NULL 
          AND EXISTS(SELECT 1 FROM mesa_trabajo_sve mt WHERE mt.cliente_id = c.id) 
          THEN c.id 
        END) as casos_cerrados,
        
        -- ✅ CASOS ABIERTOS: Clientes con Mesa de Trabajo pero SIN fecha_cierre_sve
        COUNT(DISTINCT CASE 
          WHEN c.fecha_cierre_sve IS NULL 
          AND EXISTS(SELECT 1 FROM mesa_trabajo_sve mt WHERE mt.cliente_id = c.id) 
          THEN c.id 
        END) as casos_abiertos,
        
        COUNT(DISTINCT CASE WHEN fecha_cierre_sve IS NOT NULL THEN id END) as trabajadores_casos_cerrados,
        COUNT(DISTINCT CASE WHEN fecha_cierre_sve IS NULL AND EXISTS(
          SELECT 1 FROM mesa_trabajo_sve WHERE cliente_id = c.id
        ) THEN id END) as trabajadores_seguimiento_activo
      FROM clients c
      WHERE profesional_id = $1
    ),
    promedio_consultas AS (
      SELECT 
        COALESCE(ROUND(AVG(num_consultas), 2), 0) as promedio_consultas_por_caso
      FROM (
        SELECT cs.cliente_id, COUNT(*) as num_consultas
        FROM consultas_sve cs
        INNER JOIN clients c ON cs.cliente_id = c.id
        INNER JOIN mesa_trabajo_sve mt ON cs.cliente_id = mt.cliente_id
        WHERE c.profesional_id = $1
        GROUP BY cs.cliente_id
      ) sub
    ),
    tasa_cierre_calc AS (
      SELECT 
        CASE 
          WHEN (SELECT total_casos_sve FROM mesa_trabajo_stats) > 0 
          THEN ROUND(
            (SELECT casos_cerrados FROM clientes_stats)::numeric * 100.0 / 
            (SELECT total_casos_sve FROM mesa_trabajo_stats)::numeric, 
            2
          )
          ELSE 0 
        END as tasa_cierre
    )
    SELECT 
      mt.*,
      cs.*,
      cl.*,
      pc.*,
      tc.tasa_cierre
    FROM mesa_trabajo_stats mt
    CROSS JOIN consultas_stats cs
    CROSS JOIN clientes_stats cl
    CROSS JOIN promedio_consultas pc
    CROSS JOIN tasa_cierre_calc tc
  `, [profesionalId]);
  
  return result.rows[0];
};

// ✅ NUEVA FUNCIÓN: Estadísticas por criterios de inclusión
exports.getEstadisticasCriteriosInclusion = async () => {
  const result = await pool.query(`
    SELECT 
      criterio_inclusion,
      COUNT(*) as cantidad,
      ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) as porcentaje
    FROM mesa_trabajo_sve
    GROUP BY criterio_inclusion
    ORDER BY cantidad DESC
  `);
  
  return result.rows;
};

// ✅ NUEVA FUNCIÓN: Estadísticas por criterios de inclusión (por profesional)
exports.getEstadisticasCriteriosInclusionByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      mt.criterio_inclusion,
      COUNT(*) as cantidad,
      ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) as porcentaje
    FROM mesa_trabajo_sve mt
    INNER JOIN clients c ON mt.cliente_id = c.id
    WHERE c.profesional_id = $1
    GROUP BY mt.criterio_inclusion
    ORDER BY cantidad DESC
  `, [profesionalId]);
  
  return result.rows;
};

// ✅ NUEVA FUNCIÓN: Evolución temporal de consultas SVE
exports.getEvolucionConsultasSVE = async () => {
  const result = await pool.query(`
    SELECT 
      TO_CHAR(fecha, 'YYYY-MM') as mes,
      COUNT(*) as total_consultas,
      COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as virtuales,
      COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as presenciales
    FROM consultas_sve
    WHERE fecha >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(fecha, 'YYYY-MM'), DATE_TRUNC('month', fecha)
    ORDER BY DATE_TRUNC('month', fecha) ASC
    LIMIT 12
  `);
  
  return result.rows;
};

// ✅ NUEVA FUNCIÓN: Evolución temporal de consultas SVE (por profesional)
exports.getEvolucionConsultasSVEByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      TO_CHAR(cs.fecha, 'YYYY-MM') as mes,
      COUNT(*) as total_consultas,
      COUNT(CASE WHEN cs.modalidad = 'Virtual' THEN 1 END) as virtuales,
      COUNT(CASE WHEN cs.modalidad = 'Presencial' THEN 1 END) as presenciales
    FROM consultas_sve cs
    INNER JOIN clients c ON cs.cliente_id = c.id
    WHERE cs.fecha >= NOW() - INTERVAL '12 months'
      AND c.profesional_id = $1
    GROUP BY TO_CHAR(cs.fecha, 'YYYY-MM'), DATE_TRUNC('month', cs.fecha)
    ORDER BY DATE_TRUNC('month', cs.fecha) ASC
    LIMIT 12
  `, [profesionalId]);
  
  return result.rows;
};