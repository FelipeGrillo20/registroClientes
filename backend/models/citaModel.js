// backend/models/citaModel.js
const pool = require("../config/db");

const CitaModel = {
  /**
   * Obtener todas las citas con información del trabajador y profesional
   */
  async getAllCitas(filters = {}) {
    try {
      let query = `
        SELECT 
          c.id,
          c.trabajador_id,
          c.profesional_id,
          c.fecha,
          c.hora_inicio,
          c.hora_fin,
          c.modalidad_cita,
          c.estado,
          c.credito_id,
          c.observaciones_internas,
          c.observaciones_informe,
          c.modalidad_programa,
          c.fecha_creacion,
          c.fecha_actualizacion,
          cl.nombre AS trabajador_nombre,
          cl.cedula AS trabajador_cedula,
          cl.telefono AS trabajador_celular,
          u.nombre AS profesional_nombre,
          u.email AS profesional_email,
          uc.nombre AS creado_por_nombre
        FROM citas c
        LEFT JOIN clients cl ON c.trabajador_id = cl.id
        LEFT JOIN users u ON c.profesional_id = u.id
        LEFT JOIN users uc ON c.creado_por = uc.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      // Filtros dinámicos
      if (filters.profesional_id) {
        query += ` AND c.profesional_id = $${paramIndex}`;
        params.push(filters.profesional_id);
        paramIndex++;
      }

      if (filters.trabajador_id) {
        query += ` AND c.trabajador_id = $${paramIndex}`;
        params.push(filters.trabajador_id);
        paramIndex++;
      }

      if (filters.estado) {
        query += ` AND c.estado = $${paramIndex}`;
        params.push(filters.estado);
        paramIndex++;
      }

      if (filters.modalidad_programa) {
        query += ` AND c.modalidad_programa = $${paramIndex}`;
        params.push(filters.modalidad_programa);
        paramIndex++;
      }

      // ← NUEVO: Filtro por crédito
      if (filters.credito_id) {
        query += ` AND c.credito_id = $${paramIndex}`;
        params.push(filters.credito_id);
        paramIndex++;
      }

      if (filters.fecha_inicio && filters.fecha_fin) {
        query += ` AND c.fecha BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.fecha_inicio, filters.fecha_fin);
        paramIndex += 2;
      }

      query += ` ORDER BY c.fecha DESC, c.hora_inicio DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Error en getAllCitas:", error);
      throw error;
    }
  },

  /**
   * Obtener cita por ID
   */
  async getCitaById(id) {
    try {
      const query = `
        SELECT 
          c.*,
          cl.nombre AS trabajador_nombre,
          cl.cedula AS trabajador_cedula,
          cl.email  AS trabajador_email,
          u.nombre  AS profesional_nombre,
          u.email   AS profesional_email
        FROM citas c
        LEFT JOIN clients cl ON c.trabajador_id = cl.id
        LEFT JOIN users u ON c.profesional_id = u.id
        WHERE c.id = $1
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error("Error en getCitaById:", error);
      throw error;
    }
  },

  /**
   * Crear nueva cita
   */
  async createCita(citaData, userId) {
    try {
      const query = `
        INSERT INTO citas (
          trabajador_id, 
          profesional_id, 
          fecha, 
          hora_inicio, 
          hora_fin, 
          modalidad_cita, 
          estado, 
          observaciones_internas, 
          observaciones_informe, 
          modalidad_programa, 
          creado_por,
          credito_id,
          google_event_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        citaData.trabajador_id,
        citaData.profesional_id,
        citaData.fecha,
        citaData.hora_inicio,
        citaData.hora_fin,
        citaData.modalidad_cita,
        citaData.estado || "programada",
        citaData.observaciones_internas || null,
        citaData.observaciones_informe || null,
        citaData.modalidad_programa,
        userId,
        citaData.credito_id || null,
        citaData.google_event_id || null,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Error en createCita:", error);
      throw error;
    }
  },

  /**
   * Actualizar cita existente
   */
  async updateCita(id, citaData, userId) {
    try {
      const query = `
        UPDATE citas SET
          trabajador_id = $1,
          profesional_id = $2,
          fecha = $3,
          hora_inicio = $4,
          hora_fin = $5,
          modalidad_cita = $6,
          estado = $7,
          observaciones_internas = $8,
          observaciones_informe = $9,
          modalidad_programa = $10,
          actualizado_por = $11,
          fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *
      `;

      const values = [
        citaData.trabajador_id,
        citaData.profesional_id,
        citaData.fecha,
        citaData.hora_inicio,
        citaData.hora_fin,
        citaData.modalidad_cita,
        citaData.estado,
        citaData.observaciones_internas,
        citaData.observaciones_informe,
        citaData.modalidad_programa,
        userId,
        id,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Error en updateCita:", error);
      throw error;
    }
  },

  /**
   * Eliminar cita
   */
  async deleteCita(id) {
    try {
      const query = `DELETE FROM citas WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error("Error en deleteCita:", error);
      throw error;
    }
  },

  /**
   * Verificar disponibilidad de profesional
   */
  async verificarDisponibilidad(profesional_id, fecha, hora_inicio, hora_fin, cita_id = null) {
    try {
      let query = `
        SELECT * FROM citas 
        WHERE profesional_id = $1 
        AND fecha = $2 
        AND estado NOT IN ('cancelada')
        AND (
          (hora_inicio < $4 AND hora_fin > $3)
        )
      `;

      const params = [profesional_id, fecha, hora_inicio, hora_fin];

      // Si estamos editando, excluir la cita actual
      if (cita_id) {
        query += ` AND id != $5`;
        params.push(cita_id);
      }

      const result = await pool.query(query, params);
      return result.rows.length === 0; // true si está disponible
    } catch (error) {
      console.error("Error en verificarDisponibilidad:", error);
      throw error;
    }
  },

  /**
   * Obtener citas por rango de fechas (para el calendario)
   */
  async getCitasPorRango(fecha_inicio, fecha_fin, filters = {}) {
    try {
      let query = `
        SELECT 
          c.id,
          c.trabajador_id,
          c.profesional_id,
          c.fecha,
          c.hora_inicio,
          c.hora_fin,
          c.modalidad_cita,
          c.estado,
          c.modalidad_programa,
          cl.nombre AS trabajador_nombre,
          cl.cedula AS trabajador_cedula,
          u.nombre AS profesional_nombre
        FROM citas c
        LEFT JOIN clients cl ON c.trabajador_id = cl.id
        LEFT JOIN users u ON c.profesional_id = u.id
        WHERE c.fecha BETWEEN $1 AND $2
      `;

      const params = [fecha_inicio, fecha_fin];
      let paramIndex = 3;

      if (filters.profesional_id) {
        query += ` AND c.profesional_id = $${paramIndex}`;
        params.push(filters.profesional_id);
        paramIndex++;
      }

      if (filters.modalidad_programa) {
        query += ` AND c.modalidad_programa = $${paramIndex}`;
        params.push(filters.modalidad_programa);
        paramIndex++;
      }

      // ✅ NUEVO: Filtro por estado
      if (filters.estado) {
        query += ` AND c.estado = $${paramIndex}`;
        params.push(filters.estado);
        paramIndex++;
      }

      query += ` ORDER BY c.fecha, c.hora_inicio`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Error en getCitasPorRango:", error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de citas
   */
  async getEstadisticas(filters = {}) {
    try {
      let query = `
        SELECT 
          estado,
          COUNT(*) as cantidad
        FROM citas
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (filters.fecha_inicio && filters.fecha_fin) {
        query += ` AND fecha BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.fecha_inicio, filters.fecha_fin);
        paramIndex += 2;
      }

      if (filters.modalidad_programa) {
        query += ` AND modalidad_programa = $${paramIndex}`;
        params.push(filters.modalidad_programa);
        paramIndex++;
      }

      if (filters.profesional_id) {
        query += ` AND profesional_id = $${paramIndex}`;
        params.push(filters.profesional_id);
        paramIndex++;
      }

      query += ` GROUP BY estado`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Error en getEstadisticas:", error);
      throw error;
    }
  },

  /**
   * ✅ NUEVO: Verificar si existe al menos una cita previa entre trabajador y profesional
   * Retorna true si existe al menos una cita previa (para permitir que el profesional cree más)
   */
  async existeCitaPrevia(trabajador_id, profesional_id) {
    try {
      const query = `
        SELECT COUNT(*) as total
        FROM citas
        WHERE trabajador_id = $1 
        AND profesional_id = $2
      `;

      const result = await pool.query(query, [trabajador_id, profesional_id]);
      const total = parseInt(result.rows[0].total);
      
      console.log(`🔍 [existeCitaPrevia] Trabajador ${trabajador_id} + Profesional ${profesional_id}: ${total} cita(s) previa(s)`);
      
      return total > 0; // true si existe al menos una cita
    } catch (error) {
      console.error("Error en existeCitaPrevia:", error);
      throw error;
    }
  },

  /**
   * ✅ NUEVO: Obtener trabajadores que tienen citas previas con un profesional específico
   * Para la cascada: Profesional → Trabajadores relacionados
   */
  async getTrabajadoresPorProfesional(profesional_id, modalidad_programa) {
    try {
      const query = `
        SELECT DISTINCT
          cl.id,
          cl.nombre,
          cl.cedula
        FROM citas c
        INNER JOIN clients cl ON c.trabajador_id = cl.id
        WHERE c.profesional_id = $1
        AND c.modalidad_programa = $2
        ORDER BY cl.nombre
      `;

      const result = await pool.query(query, [profesional_id, modalidad_programa]);
      
      console.log(`📋 [getTrabajadoresPorProfesional] Profesional ${profesional_id} tiene ${result.rows.length} trabajador(es) con citas previas`);
      
      return result.rows;
    } catch (error) {
      console.error("Error en getTrabajadoresPorProfesional:", error);
      throw error;
    }
  },

  /**
   * ✅ NUEVO: Actualizar solo el google_event_id de una cita
   */
  async actualizarGoogleEventId(id, googleEventId) {
    try {
      const query = `
        UPDATE citas
        SET google_event_id = $1,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const result = await pool.query(query, [googleEventId, id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error en actualizarGoogleEventId:', error);
      throw error;
    }
  },

  /**
   * ✅ NUEVO: Actualizar solo el credito_id de una cita
   */
  async actualizarCreditoId(id, creditoId) {
    try {
      const query = `
        UPDATE citas
        SET credito_id = $1,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const result = await pool.query(query, [creditoId, id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error en actualizarCreditoId:', error);
      throw error;
    }
  },

  /**
   * Cambiar el estado de una cita
   */
  async cambiarEstado(id, nuevoEstado) {
    try {
      const query = `
        UPDATE citas 
        SET estado = $1, 
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const result = await pool.query(query, [nuevoEstado, id]);
      return result.rows[0];
    } catch (error) {
      console.error("Error en cambiarEstado:", error);
      throw error;
    }
  }
};

module.exports = CitaModel;