// backend/models/mesaTrabajoSveModel.js
const pool = require("../config/db");

// Crear un nuevo registro de Mesa de Trabajo SVE
exports.createMesaTrabajo = async (data) => {
  const {
    cliente_id,
    criterio_inclusion,
    motivo_evaluacion,
    diagnostico,
    codigo_diagnostico
  } = data;

  const result = await pool.query(
    `INSERT INTO mesa_trabajo_sve 
    (cliente_id, criterio_inclusion, motivo_evaluacion, diagnostico, codigo_diagnostico)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [cliente_id, criterio_inclusion, motivo_evaluacion, diagnostico, codigo_diagnostico]
  );

  return result.rows[0];
};

// Obtener Mesa de Trabajo por ID de cliente
exports.getMesaTrabajoByClienteId = async (cliente_id) => {
  const result = await pool.query(
    `SELECT 
      mt.*,
      CASE WHEN mt.soporte_ruta IS NOT NULL 
        THEN '/uploads/soporte-mesa-trabajo/' || mt.soporte_ruta 
        ELSE NULL 
      END AS soporte_url,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono
    FROM mesa_trabajo_sve mt
    INNER JOIN clients c ON mt.cliente_id = c.id
    WHERE mt.cliente_id = $1`,
    [cliente_id]
  );
  return result.rows[0];
};

// Obtener Mesa de Trabajo por ID
exports.getMesaTrabajoById = async (id) => {
  const result = await pool.query(
    `SELECT 
      mt.*,
      CASE WHEN mt.soporte_ruta IS NOT NULL 
        THEN '/uploads/soporte-mesa-trabajo/' || mt.soporte_ruta 
        ELSE NULL 
      END AS soporte_url,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono
    FROM mesa_trabajo_sve mt
    INNER JOIN clients c ON mt.cliente_id = c.id
    WHERE mt.id = $1`,
    [id]
  );
  return result.rows[0];
};

// Obtener todas las Mesas de Trabajo
exports.getAllMesasTrabajo = async () => {
  const result = await pool.query(`
    SELECT 
      mt.*,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono,
      u.nombre AS profesional_nombre
    FROM mesa_trabajo_sve mt
    INNER JOIN clients c ON mt.cliente_id = c.id
    LEFT JOIN users u ON c.profesional_id = u.id
    ORDER BY mt.created_at DESC
  `);
  return result.rows;
};

// Obtener Mesas de Trabajo filtradas por profesional
exports.getMesasTrabajoByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      mt.*,
      c.cedula,
      c.nombre,
      c.sede,
      c.email,
      c.telefono,
      u.nombre AS profesional_nombre
    FROM mesa_trabajo_sve mt
    INNER JOIN clients c ON mt.cliente_id = c.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.profesional_id = $1
    ORDER BY mt.created_at DESC
  `, [profesionalId]);
  return result.rows;
};

// Actualizar Mesa de Trabajo
exports.updateMesaTrabajo = async (id, data) => {
  const {
    criterio_inclusion,
    motivo_evaluacion,
    diagnostico,
    codigo_diagnostico
  } = data;

  const result = await pool.query(
    `UPDATE mesa_trabajo_sve SET
      criterio_inclusion = $1,
      motivo_evaluacion  = $2,
      diagnostico        = $3,
      codigo_diagnostico = $4,
      updated_at         = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *`,
    [criterio_inclusion, motivo_evaluacion, diagnostico, codigo_diagnostico, id]
  );

  return result.rows[0];
};

// Eliminar Mesa de Trabajo
exports.deleteMesaTrabajo = async (id) => {
  const result = await pool.query(
    "DELETE FROM mesa_trabajo_sve WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// Verificar si un cliente ya tiene Mesa de Trabajo registrada
exports.clienteTieneMesaTrabajo = async (cliente_id) => {
  const result = await pool.query(
    "SELECT id FROM mesa_trabajo_sve WHERE cliente_id = $1",
    [cliente_id]
  );
  return result.rows.length > 0;
};

// Verificar si un cliente tiene sesiones SVE registradas
// (impide eliminar la Mesa de Trabajo si hay sesiones)
exports.clienteTieneSesionesSVE = async (cliente_id) => {
  const result = await pool.query(
    "SELECT id FROM consultas_sve WHERE cliente_id = $1 LIMIT 1",
    [cliente_id]
  );
  return result.rows.length > 0;
};
// ============================================================
// Actualizar solo los campos de soporte (nombre y ruta)
// ============================================================
exports.updateSoporteMesaTrabajo = async (id, { soporte_nombre, soporte_ruta }) => {
  const result = await pool.query(
    `UPDATE mesa_trabajo_sve SET
      soporte_nombre = $1,
      soporte_ruta   = $2,
      updated_at     = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *`,
    [soporte_nombre, soporte_ruta, id]
  );
  return result.rows[0];
};
// ============================================================
// SOPORTES ADICIONALES — tabla mesa_trabajo_soportes
// Migración requerida:
//   CREATE TABLE IF NOT EXISTS mesa_trabajo_soportes (
//     id              SERIAL PRIMARY KEY,
//     mesa_trabajo_id INTEGER NOT NULL REFERENCES mesa_trabajo_sve(id) ON DELETE CASCADE,
//     soporte_nombre  VARCHAR(255) NOT NULL,
//     soporte_ruta    VARCHAR(255) NOT NULL,
//     created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   );
// ============================================================

exports.getSoportesByMesaId = async (mesa_trabajo_id) => {
  const result = await pool.query(
    `SELECT id, mesa_trabajo_id, soporte_nombre, soporte_ruta,
      '/uploads/soporte-mesa-trabajo/' || soporte_ruta AS soporte_url,
      created_at
    FROM mesa_trabajo_soportes
    WHERE mesa_trabajo_id = $1
    ORDER BY created_at ASC`,
    [mesa_trabajo_id]
  );
  return result.rows;
};

exports.addSoporteAdicional = async (mesa_trabajo_id, { soporte_nombre, soporte_ruta }) => {
  const result = await pool.query(
    `INSERT INTO mesa_trabajo_soportes (mesa_trabajo_id, soporte_nombre, soporte_ruta)
     VALUES ($1, $2, $3)
     RETURNING id, mesa_trabajo_id, soporte_nombre, soporte_ruta,
       '/uploads/soporte-mesa-trabajo/' || soporte_ruta AS soporte_url,
       created_at`,
    [mesa_trabajo_id, soporte_nombre, soporte_ruta]
  );
  return result.rows[0];
};

exports.getSoporteAdicionalById = async (soporte_id) => {
  const result = await pool.query(
    `SELECT id, mesa_trabajo_id, soporte_nombre, soporte_ruta,
      '/uploads/soporte-mesa-trabajo/' || soporte_ruta AS soporte_url
    FROM mesa_trabajo_soportes WHERE id = $1`,
    [soporte_id]
  );
  return result.rows[0];
};

exports.deleteSoporteAdicional = async (soporte_id) => {
  const result = await pool.query(
    `DELETE FROM mesa_trabajo_soportes WHERE id = $1 RETURNING *`,
    [soporte_id]
  );
  return result.rows[0];
};