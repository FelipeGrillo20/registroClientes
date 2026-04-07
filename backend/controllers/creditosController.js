// backend/controllers/creditosController.js
const CreditoModel = require('../models/creditoModel');

const CreditosController = {
  /**
   * Crear nuevo crédito
   */
  async crear(req, res) {
    try {
      const { anio, mes, consecutivo, cantidad_horas, modalidad_programa } = req.body;

      // Validaciones
      if (!anio || !mes || !consecutivo || !cantidad_horas) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios'
        });
      }

      const creditoData = {
        anio: parseInt(anio),
        mes: parseInt(mes),
        consecutivo,
        cantidad_horas: parseInt(cantidad_horas),
        modalidad_programa
      };

      const nuevoCredito = await CreditoModel.crear(creditoData);

      res.status(201).json({
        success: true,
        message: 'Crédito creado exitosamente',
        data: nuevoCredito
      });

    } catch (error) {
      console.error('Error al crear crédito:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear crédito'
      });
    }
  },

  /**
   * Obtener crédito activo (sin importar el periodo)
   */
  async obtenerCreditoActivo(req, res) {
    try {
      const { modalidad_programa } = req.query;

      const creditoActivo = await CreditoModel.obtenerCreditoActivo(modalidad_programa);

      if (!creditoActivo) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'No hay créditos activos disponibles'
        });
      }

      // Calcular horas disponibles
      const horasDisponibles = creditoActivo.cantidad_horas - creditoActivo.horas_consumidas;

      res.status(200).json({
        success: true,
        data: {
          ...creditoActivo,
          horas_disponibles: horasDisponibles
        }
      });

    } catch (error) {
      console.error('Error al obtener crédito activo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener crédito activo'
      });
    }
  },

  /**
   * Listar créditos de un periodo
   */
  async listar(req, res) {
    try {
      const { anio, mes, modalidad_programa } = req.query;

      if (!anio || !mes) {
        return res.status(400).json({
          success: false,
          message: 'Año y mes son requeridos'
        });
      }

      const creditos = await CreditoModel.listar(
        parseInt(anio),
        parseInt(mes),
        modalidad_programa
      );

      res.status(200).json({
        success: true,
        data: creditos
      });

    } catch (error) {
      console.error('Error al listar créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al listar créditos'
      });
    }
  },

  /**
   * Obtener estadísticas de créditos
   */
  async obtenerEstadisticas(req, res) {
    try {
      const { modalidad_programa } = req.query;
      const now = new Date();
      const anio = now.getFullYear();
      const mes = now.getMonth() + 1;

      const estadisticas = await CreditoModel.obtenerEstadisticas(
        anio,
        mes,
        modalidad_programa
      );

      res.status(200).json({
        success: true,
        data: estadisticas
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  },

  /**
   * Actualizar crédito
   */
  async actualizar(req, res) {
    try {
      const { id } = req.params;
      const { anio, mes, consecutivo, cantidad_horas, modalidad_programa } = req.body;

      // Validaciones
      if (!anio || !mes || !consecutivo || !cantidad_horas) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios'
        });
      }

      // Verificar que el crédito existe y no tiene horas consumidas
      const creditoExistente = await CreditoModel.obtenerPorId(id);
      
      if (!creditoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Crédito no encontrado'
        });
      }

      if (creditoExistente.horas_consumidas > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede editar un crédito que ya tiene horas consumidas'
        });
      }

      const creditoData = {
        anio: parseInt(anio),
        mes: parseInt(mes),
        consecutivo,
        cantidad_horas: parseInt(cantidad_horas),
        modalidad_programa
      };

      const creditoActualizado = await CreditoModel.actualizar(id, creditoData);

      res.status(200).json({
        success: true,
        message: 'Crédito actualizado exitosamente',
        data: creditoActualizado
      });

    } catch (error) {
      console.error('Error al actualizar crédito:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar crédito'
      });
    }
  },

  /**
   * Eliminar crédito
   */
  async eliminar(req, res) {
    try {
      const { id } = req.params;

      // Verificar que el crédito existe y no tiene horas consumidas
      const creditoExistente = await CreditoModel.obtenerPorId(id);
      
      if (!creditoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Crédito no encontrado'
        });
      }

      if (creditoExistente.horas_consumidas > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar un crédito que ya tiene horas consumidas'
        });
      }

      await CreditoModel.eliminar(id);

      res.status(200).json({
        success: true,
        message: 'Crédito eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar crédito:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar crédito'
      });
    }
  }
};

module.exports = CreditosController;