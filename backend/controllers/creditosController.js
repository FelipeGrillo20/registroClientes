// backend/controllers/creditosController.js
const CreditoModel   = require('../models/creditoModel');
const AsignacionModel = require('../models/asignacionModel');

const CreditosController = {

  /**
   * Crear nuevo crédito
   */
  async crear(req, res) {
    try {
      const { anio, mes, consecutivo, cantidad_horas, modalidad_programa } = req.body;

      if (!anio || !mes || !consecutivo || !cantidad_horas) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
      }

      const existente = await CreditoModel.buscarPorConsecutivo(consecutivo);
      if (existente) {
        return res.status(409).json({
          success: false,
          message: `Ya tienes cargado un formato con ese nombre ("${consecutivo}"), debes cambiarlo por uno diferente`
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

      res.status(201).json({ success: true, message: 'Crédito creado exitosamente', data: nuevoCredito });

    } catch (error) {
      console.error('Error al crear crédito:', error);
      if (error.code === '23505' || (error.detail && error.detail.includes('consecutivo'))) {
        return res.status(409).json({
          success: false,
          message: 'Ya tienes cargado un formato con ese nombre, debes cambiarlo por uno diferente'
        });
      }
      res.status(500).json({ success: false, message: 'Error al crear crédito' });
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
        return res.status(200).json({ success: true, data: null, message: 'No hay créditos activos disponibles' });
      }

      const horasDisponibles = creditoActivo.cantidad_horas - creditoActivo.horas_consumidas;

      res.status(200).json({
        success: true,
        data: { ...creditoActivo, horas_disponibles: horasDisponibles }
      });

    } catch (error) {
      console.error('Error al obtener crédito activo:', error);
      res.status(500).json({ success: false, message: 'Error al obtener crédito activo' });
    }
  },

  /**
   * Listar créditos de un periodo
   */
  async listar(req, res) {
    try {
      const { anio, mes, modalidad_programa } = req.query;

      if (!anio || !mes) {
        return res.status(400).json({ success: false, message: 'Año y mes son requeridos' });
      }

      const creditos = await CreditoModel.listar(parseInt(anio), parseInt(mes), modalidad_programa);

      res.status(200).json({ success: true, data: creditos });

    } catch (error) {
      console.error('Error al listar créditos:', error);
      res.status(500).json({ success: false, message: 'Error al listar créditos' });
    }
  },

  /**
   * Obtener estadísticas de créditos
   */
  async obtenerEstadisticas(req, res) {
    try {
      const { modalidad_programa } = req.query;
      const now = new Date();

      const estadisticas = await CreditoModel.obtenerEstadisticas(
        now.getFullYear(),
        now.getMonth() + 1,
        modalidad_programa
      );

      res.status(200).json({ success: true, data: estadisticas });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  },

  /**
   * Actualizar crédito
   */
  async actualizar(req, res) {
    try {
      const { id } = req.params;
      const { anio, mes, consecutivo, cantidad_horas, modalidad_programa } = req.body;

      if (!anio || !mes || !consecutivo || !cantidad_horas) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
      }

      const creditoExistente = await CreditoModel.obtenerPorId(id);
      if (!creditoExistente) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      const creditoMismoNombre = await CreditoModel.buscarPorConsecutivo(consecutivo);
      if (creditoMismoNombre && String(creditoMismoNombre.id) !== String(id)) {
        return res.status(409).json({
          success: false,
          message: `Ya tienes cargado un formato con ese nombre ("${consecutivo}"), debes cambiarlo por uno diferente`
        });
      }

      const nuevaCantidad   = parseInt(cantidad_horas);
      const horasConsumidas = parseFloat(creditoExistente.horas_consumidas) || 0;

      if (nuevaCantidad < horasConsumidas) {
        return res.status(400).json({
          success: false,
          message: `No se puede establecer ${nuevaCantidad} hora(s) porque ya están asignadas ${horasConsumidas} hora(s). El valor mínimo permitido es ${horasConsumidas} hora(s).`
        });
      }

      const creditoData = {
        anio: parseInt(anio), mes: parseInt(mes),
        consecutivo, cantidad_horas: nuevaCantidad,
        modalidad_programa
      };

      const creditoActualizado = await CreditoModel.actualizar(id, creditoData);

      res.status(200).json({ success: true, message: 'Crédito actualizado exitosamente', data: creditoActualizado });

    } catch (error) {
      console.error('Error al actualizar crédito:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar crédito' });
    }
  },

  /**
   * Eliminar crédito
   */
  async eliminar(req, res) {
    try {
      const { id } = req.params;

      const creditoExistente = await CreditoModel.obtenerPorId(id);
      if (!creditoExistente) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      if (creditoExistente.horas_consumidas > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar un crédito que ya tiene horas consumidas'
        });
      }

      await CreditoModel.eliminar(id);

      res.status(200).json({ success: true, message: 'Crédito eliminado exitosamente' });

    } catch (error) {
      console.error('Error al eliminar crédito:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar crédito' });
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Consumir horas de un crédito + registrar asignación en BD
   * PATCH /api/creditos/:id/consumir
   * Body: { horas, profesional_id, trabajador_id, sesion_id,
   *         fecha_sesion, profesional_nombre, trabajador_nombre }
   * ─────────────────────────────────────────────────────────────────────────
   */
  async consumirHoras(req, res) {
    try {
      const { id } = req.params;
      const {
        horas,
        profesional_id,
        trabajador_id,
        sesion_id,
        fecha_sesion,
        profesional_nombre,
        trabajador_nombre
      } = req.body;

      if (!horas || horas <= 0) {
        return res.status(400).json({ success: false, message: 'Horas inválidas' });
      }

      const creditoExistente = await CreditoModel.obtenerPorId(id);
      if (!creditoExistente) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      const horasDisponibles = creditoExistente.cantidad_horas - creditoExistente.horas_consumidas;
      if (horasDisponibles < horas) {
        return res.status(400).json({
          success: false,
          message: `Horas insuficientes en "${creditoExistente.consecutivo}". Disponibles: ${horasDisponibles.toFixed(1)}h, Requeridas: ${horas}h`
        });
      }

      // 1. Descontar horas del crédito
      await CreditoModel.consumirHoras(id, horas);

      // 2. Registrar asignación en BD (si vienen los datos del trabajador/sesión)
      let asignacion = null;
      if (profesional_id && trabajador_id && sesion_id) {
        asignacion = await AsignacionModel.crear({
          credito_id:         parseInt(id),
          profesional_id:     parseInt(profesional_id),
          trabajador_id:      parseInt(trabajador_id),
          sesion_id:          parseInt(sesion_id),
          horas_asignadas:    horas,
          fecha_sesion:       fecha_sesion || null,
          profesional_nombre: profesional_nombre || null,
          trabajador_nombre:  trabajador_nombre  || null
        });
      }

      const actualizado  = await CreditoModel.obtenerPorId(id);
      const dispActual   = actualizado.cantidad_horas - actualizado.horas_consumidas;

      res.json({
        success: true,
        message: `${horas}h consumidas del crédito "${creditoExistente.consecutivo}"`,
        data: {
          credito_id:        parseInt(id),
          horas_consumidas:  horas,
          horas_disponibles: dispActual,
          asignacion_id:     asignacion?.id || null
        }
      });

    } catch (error) {
      console.error('Error al consumir horas:', error);
      res.status(500).json({ success: false, message: 'Error al consumir horas del crédito' });
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Devolver horas a un crédito + eliminar registro de asignación en BD
   * PATCH /api/creditos/:id/devolver
   * Body: { horas, profesional_id, trabajador_id, sesion_id }
   * ─────────────────────────────────────────────────────────────────────────
   */
  async devolverHoras(req, res) {
    try {
      const { id } = req.params;
      const { horas, profesional_id, trabajador_id, sesion_id } = req.body;

      if (!horas || horas <= 0) {
        return res.status(400).json({ success: false, message: 'Horas inválidas' });
      }

      const creditoExistente = await CreditoModel.obtenerPorId(id);
      if (!creditoExistente) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      // 1. Devolver horas al crédito
      await CreditoModel.devolverHoras(id, horas);

      // 2. Eliminar el registro de asignación en BD (si vienen los datos)
      if (profesional_id && trabajador_id && sesion_id) {
        await AsignacionModel.eliminar(
          parseInt(id),
          parseInt(profesional_id),
          parseInt(trabajador_id),
          parseInt(sesion_id)
        );
      }

      const actualizado = await CreditoModel.obtenerPorId(id);
      const dispActual  = actualizado.cantidad_horas - actualizado.horas_consumidas;

      res.json({
        success: true,
        message: `${horas}h devueltas al crédito "${creditoExistente.consecutivo}"`,
        data: {
          credito_id:        parseInt(id),
          horas_devueltas:   horas,
          horas_disponibles: dispActual
        }
      });

    } catch (error) {
      console.error('Error al devolver horas:', error);
      res.status(500).json({ success: false, message: 'Error al devolver horas al crédito' });
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Obtener el informe de asignaciones de un crédito (para el modal)
   * GET /api/creditos/:id/asignaciones
   * ─────────────────────────────────────────────────────────────────────────
   */
  async obtenerAsignaciones(req, res) {
    try {
      const { id } = req.params;

      const creditoExistente = await CreditoModel.obtenerPorId(id);
      if (!creditoExistente) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      const asignaciones = await AsignacionModel.listarPorCredito(id);

      res.status(200).json({
        success: true,
        data: asignaciones,
        credito: creditoExistente
      });

    } catch (error) {
      console.error('Error al obtener asignaciones:', error);
      res.status(500).json({ success: false, message: 'Error al obtener asignaciones' });
    }
  },

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Verificar si una sesión ya tiene asignación
   * GET /api/creditos/asignacion-sesion?profesional_id=&trabajador_id=&sesion_id=
   * ─────────────────────────────────────────────────────────────────────────
   */
  async verificarAsignacionSesion(req, res) {
    try {
      const { profesional_id, trabajador_id, sesion_id } = req.query;

      if (!profesional_id || !trabajador_id || !sesion_id) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros' });
      }

      const asignacion = await AsignacionModel.buscarPorSesion(
        parseInt(profesional_id),
        parseInt(trabajador_id),
        parseInt(sesion_id)
      );

      res.status(200).json({
        success: true,
        data: asignacion || null,
        tiene_asignacion: !!asignacion
      });

    } catch (error) {
      console.error('Error al verificar asignación:', error);
      res.status(500).json({ success: false, message: 'Error al verificar asignación' });
    }
  }

};

module.exports = CreditosController;