// backend/models/empresaModel.js
const pool = require("../config/db");

// Obtener todas las empresas activas
exports.getEmpresas = async () => {
  const result = await pool.query(
    "SELECT * FROM empresas WHERE activo = true ORDER BY cliente_final ASC"
  );
  return result.rows;
};

// Obtener empresa por ID
exports.getEmpresaById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM empresas WHERE id = $1",
    [id]
  );
  return result.rows[0];
};