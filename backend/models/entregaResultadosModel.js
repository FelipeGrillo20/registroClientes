// backend/models/entregaResultadosModel.js
const pool = require("../config/db");

// Crear un nuevo registro de entrega
exports.createEntrega = async (data) => {
  const {
    client_id,
    profesional_id,
    fecha_retroalimentacion,
    titulo_seccion,
    recomendaciones_html,
    pruebas_profundidad,
  } = data;

  const result = await pool.query(
    `INSERT INTO entrega_resultados
      (client_id, profesional_id, fecha_retroalimentacion,
       titulo_seccion, recomendaciones_html, pruebas_profundidad)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      client_id,
      profesional_id,
      fecha_retroalimentacion || null,
      titulo_seccion || 'RESULTADO INDIVIDUAL DEL DIAGNOSTICO DE RIESGO PSICOSOCIAL',
      recomendaciones_html || null,
      pruebas_profundidad || 'Ninguna',
    ]
  );
  return result.rows[0];
};

// Obtener todos los registros de un cliente
exports.getEntregasByCliente = async (clientId) => {
  const result = await pool.query(
    `SELECT
       er.*,
       u.nombre AS profesional_nombre,
       c.nombre AS trabajador_nombre,
       c.cedula AS trabajador_cedula,
       c.telefono AS trabajador_telefono
     FROM entrega_resultados er
     LEFT JOIN users u ON er.profesional_id = u.id
     LEFT JOIN clients c ON er.client_id = c.id
     WHERE er.client_id = $1
     ORDER BY er.created_at DESC`,
    [clientId]
  );
  return result.rows;
};

// Obtener un registro por ID
exports.getEntregaById = async (id) => {
  const result = await pool.query(
    `SELECT
       er.*,
       u.nombre AS profesional_nombre,
       c.nombre AS trabajador_nombre,
       c.cedula AS trabajador_cedula,
       c.telefono AS trabajador_telefono
     FROM entrega_resultados er
     LEFT JOIN users u ON er.profesional_id = u.id
     LEFT JOIN clients c ON er.client_id = c.id
     WHERE er.id = $1`,
    [id]
  );
  return result.rows[0];
};

// Actualizar un registro existente
exports.updateEntrega = async (id, data) => {
  const {
    fecha_retroalimentacion,
    titulo_seccion,
    recomendaciones_html,
    pruebas_profundidad,
    profesional_id,       // opcional: si viene, reatribuir autoría al profesional correcto
  } = data;

  // Construir la query dinámicamente según si se debe actualizar profesional_id
  if (profesional_id) {
    const result = await pool.query(
      `UPDATE entrega_resultados SET
         fecha_retroalimentacion = $1,
         titulo_seccion          = $2,
         recomendaciones_html    = $3,
         pruebas_profundidad     = $4,
         profesional_id          = $5
       WHERE id = $6
       RETURNING *`,
      [
        fecha_retroalimentacion || null,
        titulo_seccion || 'RESULTADO INDIVIDUAL DEL DIAGNOSTICO DE RIESGO PSICOSOCIAL',
        recomendaciones_html || null,
        pruebas_profundidad || 'Ninguna',
        profesional_id,
        id,
      ]
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `UPDATE entrega_resultados SET
       fecha_retroalimentacion = $1,
       titulo_seccion          = $2,
       recomendaciones_html    = $3,
       pruebas_profundidad     = $4
     WHERE id = $5
     RETURNING *`,
    [
      fecha_retroalimentacion || null,
      titulo_seccion || 'RESULTADO INDIVIDUAL DEL DIAGNOSTICO DE RIESGO PSICOSOCIAL',
      recomendaciones_html || null,
      pruebas_profundidad || 'Ninguna',
      id,
    ]
  );
  return result.rows[0];
};

// Eliminar un registro
exports.deleteEntrega = async (id) => {
  const result = await pool.query(
    `DELETE FROM entrega_resultados WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};