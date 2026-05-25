// backend/models/seguimientoModel.js
// Modelo de datos para la tabla `seguimientos`.
// Cada registro representa un seguimiento post-cierre
// de una consulta de Orientación Psicosocial.
// La consulta permanece cerrada; el seguimiento es
// un registro independiente y no la reabre.

const pool = require("../config/db");

// ============================================
// Crear un nuevo seguimiento
// ============================================
exports.createSeguimiento = async (cliente_id, consulta_number, fecha_seguimiento, observaciones_seguimiento) => {
  const result = await pool.query(
    `INSERT INTO seguimientos
       (cliente_id, consulta_number, fecha_seguimiento, observaciones_seguimiento)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [cliente_id, consulta_number, fecha_seguimiento, observaciones_seguimiento]
  );
  return result.rows[0];
};

// ============================================
// Obtener todos los seguimientos de una consulta
// Ordenados cronológicamente (primero el más antiguo)
// ============================================
exports.getSeguimientosByConsulta = async (cliente_id, consulta_number) => {
  const result = await pool.query(
    `SELECT
       id,
       cliente_id,
       consulta_number,
       fecha_seguimiento,
       observaciones_seguimiento,
       created_at,
       updated_at
     FROM seguimientos
     WHERE cliente_id      = $1
       AND consulta_number = $2
     ORDER BY fecha_seguimiento ASC, created_at ASC`,
    [cliente_id, consulta_number]
  );
  return result.rows;
};

// ============================================
// Obtener un seguimiento por ID
// ============================================
exports.getSeguimientoById = async (id) => {
  const result = await pool.query(
    `SELECT * FROM seguimientos WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// ============================================
// Actualizar un seguimiento por ID
// ============================================
exports.updateSeguimiento = async (id, fecha_seguimiento, observaciones_seguimiento) => {
  const result = await pool.query(
    `UPDATE seguimientos SET
       fecha_seguimiento         = $1,
       observaciones_seguimiento = $2,
       updated_at                = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [fecha_seguimiento, observaciones_seguimiento, id]
  );
  return result.rows[0] || null;
};

// ============================================
// Eliminar un seguimiento por ID
// ============================================
exports.deleteSeguimiento = async (id) => {
  const result = await pool.query(
    `DELETE FROM seguimientos WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

// ============================================
// Verificar que una consulta existe y está cerrada
// Devuelve true si el par (cliente_id, consulta_number)
// existe en la tabla consultas con estado 'Cerrado'
// ============================================
exports.consultaExisteYEstaCerrada = async (cliente_id, consulta_number) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total
     FROM consultas
     WHERE cliente_id      = $1
       AND consulta_number = $2
       AND estado          = 'Cerrado'`,
    [cliente_id, consulta_number]
  );
  return parseInt(result.rows[0].total) > 0;
};