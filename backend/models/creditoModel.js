// backend/models/creditoModel.js
const pool = require('../config/db');

const CreditoModel = {
  /**
   * Crear un nuevo crédito
   */
  async crear(creditoData) {
    const query = `
      INSERT INTO creditos (
        anio, 
        mes, 
        consecutivo, 
        cantidad_horas, 
        horas_consumidas,
        modalidad_programa,
        activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const params = [
      creditoData.anio,
      creditoData.mes,
      creditoData.consecutivo,
      creditoData.cantidad_horas,
      0, // horas_consumidas empieza en 0
      creditoData.modalidad_programa,
      true // activo por defecto
    ];
    
    const result = await pool.query(query, params);
    return result.rows[0];
  },

  /**
   * Obtener el crédito activo actual (sin importar año/mes)
   * Busca cualquier crédito que tenga horas disponibles
   */
  async obtenerCreditoActivo(modalidad_programa) {
    const query = `
      SELECT * FROM creditos
      WHERE modalidad_programa = $1
        AND activo = true
        AND horas_consumidas < cantidad_horas
      ORDER BY id ASC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [modalidad_programa]);
    return result.rows[0] || null;
  },

  /**
   * Consumir horas de un crédito
   */
  async consumirHoras(creditoId, horasConsumidas) {
    const query = `
      UPDATE creditos
      SET horas_consumidas = horas_consumidas + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [horasConsumidas, creditoId]);
    return result.rows[0];
  },

  /**
   * Devolver horas (cuando se cancela/elimina una cita)
   */
  async devolverHoras(creditoId, horasDevueltas) {
    const query = `
      UPDATE creditos
      SET horas_consumidas = GREATEST(horas_consumidas - $1, 0),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [horasDevueltas, creditoId]);
    return result.rows[0];
  },

  /**
   * Listar todos los créditos de un periodo
   */
  async listar(anio, mes, modalidad_programa) {
    const query = `
      SELECT *,
        (cantidad_horas - horas_consumidas) as horas_disponibles
      FROM creditos
      WHERE anio = $1 
        AND mes = $2 
        AND modalidad_programa = $3
      ORDER BY id DESC
    `;
    
    const result = await pool.query(query, [anio, mes, modalidad_programa]);
    return result.rows;
  },

  /**
   * Verificar si hay créditos sin consumir completamente
   */
  async verificarCreditosSinConsumir(modalidad_programa) {
    const query = `
      SELECT * FROM creditos
      WHERE modalidad_programa = $1
        AND activo = true
        AND horas_consumidas < cantidad_horas
      ORDER BY id ASC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [modalidad_programa]);
    return result.rows[0] || null;
  },

  /**
   * Obtener estadísticas de créditos
   */
  async obtenerEstadisticas(anio, mes, modalidad_programa) {
    const query = `
      SELECT 
        SUM(cantidad_horas) as total_horas_asignadas,
        SUM(horas_consumidas) as total_horas_consumidas,
        SUM(cantidad_horas - horas_consumidas) as total_horas_disponibles,
        COUNT(*) as total_creditos
      FROM creditos
      WHERE anio = $1 
        AND mes = $2 
        AND modalidad_programa = $3
    `;
    
    const result = await pool.query(query, [anio, mes, modalidad_programa]);
    return result.rows[0];
  },

  /**
   * Obtener crédito por ID
   */
  async obtenerPorId(id) {
    const query = `SELECT * FROM creditos WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Actualizar crédito
   */
  async actualizar(id, creditoData) {
    const query = `
      UPDATE creditos
      SET anio = $1,
          mes = $2,
          consecutivo = $3,
          cantidad_horas = $4,
          modalidad_programa = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    
    const params = [
      creditoData.anio,
      creditoData.mes,
      creditoData.consecutivo,
      creditoData.cantidad_horas,
      creditoData.modalidad_programa,
      id
    ];
    
    const result = await pool.query(query, params);
    return result.rows[0];
  },


  /**
   * Buscar crédito por consecutivo (para validar duplicados)
   */
  async buscarPorConsecutivo(consecutivo) {
    const query = `SELECT * FROM creditos WHERE LOWER(consecutivo) = LOWER($1) LIMIT 1`;
    const result = await pool.query(query, [consecutivo]);
    return result.rows[0] || null;
  },

  /**
   * Eliminar crédito
   */
  async eliminar(id) {
    const query = `DELETE FROM creditos WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = CreditoModel;