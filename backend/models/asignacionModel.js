// backend/models/asignacionModel.js
// Modelo para la tabla asignaciones_creditos
// Reemplaza el localStorage como fuente de verdad del detalle de asignaciones

const pool = require('../config/db');

const AsignacionModel = {

  /**
   * Crear una nueva asignación
   * Se llama cuando el usuario presiona "Asignar" en creditos.html
   */
  async crear(data) {
    const query = `
      INSERT INTO asignaciones_creditos (
        credito_id,
        profesional_id,
        trabajador_id,
        sesion_id,
        horas_asignadas,
        fecha_sesion,
        profesional_nombre,
        trabajador_nombre
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (credito_id, profesional_id, trabajador_id, sesion_id)
        DO UPDATE SET
          horas_asignadas    = EXCLUDED.horas_asignadas,
          fecha_sesion       = EXCLUDED.fecha_sesion,
          profesional_nombre = EXCLUDED.profesional_nombre,
          trabajador_nombre  = EXCLUDED.trabajador_nombre,
          updated_at         = NOW()
      RETURNING *
    `;

    const params = [
      data.credito_id,
      data.profesional_id,
      data.trabajador_id,
      data.sesion_id,
      data.horas_asignadas,
      data.fecha_sesion   || null,
      data.profesional_nombre || null,
      data.trabajador_nombre  || null
    ];

    const result = await pool.query(query, params);
    return result.rows[0];
  },

  /**
   * Eliminar una asignación específica (cuando el usuario presiona "Quitar")
   * Devuelve la fila eliminada para conocer las horas a devolver
   */
  async eliminar(creditoId, profesionalId, trabajadorId, sesionId) {
    const query = `
      DELETE FROM asignaciones_creditos
      WHERE credito_id     = $1
        AND profesional_id = $2
        AND trabajador_id  = $3
        AND sesion_id      = $4
      RETURNING *
    `;

    const result = await pool.query(query, [creditoId, profesionalId, trabajadorId, sesionId]);
    return result.rows[0] || null;
  },

  /**
   * Eliminar todas las asignaciones de un crédito
   * Se usa si el crédito es eliminado (ON DELETE CASCADE también lo hace,
   * pero este método permite hacerlo explícitamente desde el controller)
   */
  async eliminarPorCredito(creditoId) {
    const query = `
      DELETE FROM asignaciones_creditos
      WHERE credito_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [creditoId]);
    return result.rows;
  },

  /**
   * Buscar una asignación existente por sesión
   * Útil para saber si ya hay asignación al renderizar la lista
   */
  async buscarPorSesion(profesionalId, trabajadorId, sesionId) {
    const query = `
      SELECT a.*, c.consecutivo
      FROM asignaciones_creditos a
      JOIN creditos c ON c.id = a.credito_id
      WHERE a.profesional_id = $1
        AND a.trabajador_id  = $2
        AND a.sesion_id      = $3
      LIMIT 1
    `;
    const result = await pool.query(query, [profesionalId, trabajadorId, sesionId]);
    return result.rows[0] || null;
  },

  /**
   * Obtener todas las asignaciones de un crédito específico
   * Usado por el "Informe Asignados"
   */
  async listarPorCredito(creditoId) {
    const query = `
      SELECT
        a.id,
        a.credito_id,
        a.profesional_id,
        a.trabajador_id,
        a.sesion_id,
        a.horas_asignadas,
        a.fecha_sesion,
        a.profesional_nombre,
        a.trabajador_nombre,
        a.created_at
      FROM asignaciones_creditos a
      WHERE a.credito_id = $1
      ORDER BY a.fecha_sesion ASC, a.created_at ASC
    `;
    const result = await pool.query(query, [creditoId]);
    return result.rows;
  },

  /**
   * Obtener asignaciones de un profesional en un periodo
   * Usado para el modal "Trabajadores sin asignación"
   */
  async sesionesAsignadasPorProfesional(profesionalId, anio, mes) {
    const query = `
      SELECT sesion_id
      FROM asignaciones_creditos
      WHERE profesional_id = $1
        AND EXTRACT(YEAR FROM fecha_sesion) = $2
        AND EXTRACT(MONTH FROM fecha_sesion) = $3
    `;
    const result = await pool.query(query, [profesionalId, anio, mes]);
    return result.rows.map(r => r.sesion_id);
  }

};

module.exports = AsignacionModel;