// backend/models/antecedenteModel.js

const pool = require("../config/db");

// Crear antecedente
exports.createAntecedente = async (client_id, tipo_antecedente, detalle) => {
  const result = await pool.query(
    `INSERT INTO antecedentes_salud (client_id, tipo_antecedente, detalle)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [client_id, tipo_antecedente, detalle]
  );
  return result.rows[0];
};

// Obtener todos los antecedentes de un cliente
exports.getAntecedentesByClientId = async (client_id) => {
  const result = await pool.query(
    `SELECT * FROM antecedentes_salud
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [client_id]
  );
  return result.rows;
};

// Actualizar antecedente
exports.updateAntecedente = async (id, tipo_antecedente, detalle) => {
  const result = await pool.query(
    `UPDATE antecedentes_salud
     SET tipo_antecedente = $1, detalle = $2
     WHERE id = $3
     RETURNING *`,
    [tipo_antecedente, detalle, id]
  );
  return result.rows[0];
};

// Eliminar antecedente
exports.deleteAntecedente = async (id) => {
  const result = await pool.query(
    `DELETE FROM antecedentes_salud WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};