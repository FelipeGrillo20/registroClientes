// backend/models/mesaTrabajoSveModel.js
const pool = require("../config/db");

// Crear un nuevo registro de Mesa de Trabajo SVE
exports.createMesaTrabajo = async (data) => {
  const {
    cliente_id,
    criterio_inclusion,
    diagnostico,
    codigo_diagnostico
  } = data;

  const result = await pool.query(
    `INSERT INTO mesa_trabajo_sve 
    (cliente_id, criterio_inclusion, diagnostico, codigo_diagnostico)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [cliente_id, criterio_inclusion, diagnostico, codigo_diagnostico]
  );

  return result.rows[0];
};

// Obtener Mesa de Trabajo por ID de cliente
exports.getMesaTrabajoByClienteId = async (cliente_id) => {
  const result = await pool.query(
    `SELECT 
      mt.*,
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
    diagnostico,
    codigo_diagnostico
  } = data;

  const result = await pool.query(
    `UPDATE mesa_trabajo_sve SET
      criterio_inclusion = $1,
      diagnostico = $2,
      codigo_diagnostico = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *`,
    [criterio_inclusion, diagnostico, codigo_diagnostico, id]
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