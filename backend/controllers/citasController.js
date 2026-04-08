// backend/controllers/citasController.js
// VERSIÓN CON LOGGING DETALLADO PARA DEBUG

const CitaModel = require("../models/citaModel");
const { consumirHorasCita, devolverHorasCita, ajustarHorasCitaEditada } = require('../utils/creditosHelper');
const { enviarNotificacionCitaAgendada } = require('../utils/emailService');
const { crearEventoCalendario, actualizarEventoCalendario, eliminarEventoCalendario, verificarDisponibilidadGoogleCalendar } = require('../utils/googleCalendarService');

const CitasController = {
  /**
   * Obtener todas las citas
   */
  async getAllCitas(req, res) {
    try {
      console.log("📥 [getAllCitas] Iniciando...");
      const filters = {
        profesional_id: req.query.profesional_id,
        trabajador_id: req.query.trabajador_id,
        estado: req.query.estado,
        modalidad_programa: req.query.modalidad_programa,
        fecha_inicio: req.query.fecha_inicio,
        fecha_fin: req.query.fecha_fin,
        credito_id: req.query.credito_id,       // ← NUEVO: filtro por crédito
      };
      console.log("🔍 [getAllCitas] Filtros:", filters);

      const citas = await CitaModel.getAllCitas(filters);
      console.log("✅ [getAllCitas] Citas obtenidas:", citas.length);

      res.json({
        success: true,
        data: citas,
      });
    } catch (error) {
      console.error("❌ [getAllCitas] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las citas",
        error: error.message,
      });
    }
  },

  /**
   * Obtener cita por ID
   */
  async getCitaById(req, res) {
    try {
      console.log("📥 [getCitaById] ID:", req.params.id);
      const { id } = req.params;
      const cita = await CitaModel.getCitaById(id);

      if (!cita) {
        console.log("⚠️ [getCitaById] Cita no encontrada");
        return res.status(404).json({
          success: false,
          message: "Cita no encontrada",
        });
      }

      console.log("✅ [getCitaById] Cita encontrada:", cita.id);
      res.json({
        success: true,
        data: cita,
      });
    } catch (error) {
      console.error("❌ [getCitaById] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener la cita",
        error: error.message,
      });
    }
  },

  /**
   * Crear nueva cita
   */
  async createCita(req, res) {
    try {
      console.log("📥 [createCita] Iniciando...");
      console.log("📋 [createCita] Datos recibidos:", req.body);
      
      const citaData = req.body;
      const userId = req.user.id;
      const userRol = req.user.rol; // Obtener rol del usuario autenticado
      console.log("👤 [createCita] Usuario ID:", userId, "- Rol:", userRol);

      // Validaciones básicas
      if (!citaData.trabajador_id || !citaData.profesional_id || !citaData.fecha || !citaData.hora_inicio || !citaData.hora_fin) {
        console.log("⚠️ [createCita] Faltan datos obligatorios");
        return res.status(400).json({
          success: false,
          message: "Faltan datos obligatorios",
        });
      }

      // ✅ NUEVO: Validación de permisos según reglas de negocio
      console.log("🔐 [createCita] Verificando permisos...");
      
      // Verificar si existe una cita previa entre este trabajador y profesional
      const existeCitaPrevia = await CitaModel.existeCitaPrevia(
        citaData.trabajador_id,
        citaData.profesional_id
      );

      // REGLA 1: Si es la primera cita, solo administrador puede crearla
      if (!existeCitaPrevia) {
        console.log("🆕 [createCita] Primera cita entre trabajador y profesional");
        
        if (userRol !== 'admin') {
          console.log("❌ [createCita] Permiso denegado: Solo administradores pueden crear primera cita");
          return res.status(403).json({
            success: false,
            message: "Solo los administradores pueden crear la primera cita entre un trabajador y un profesional",
          });
        }
        
        console.log("✅ [createCita] Usuario es administrador, puede crear primera cita");
      } 
      // REGLA 2: Si ya existe cita previa, puede crearla administrador O el profesional asignado
      else {
        console.log("🔄 [createCita] Ya existe cita previa, validando permisos...");
        
        if (userRol !== 'admin' && userId !== citaData.profesional_id) {
          console.log("❌ [createCita] Permiso denegado: Usuario no es admin ni el profesional asignado");
          return res.status(403).json({
            success: false,
            message: "Solo puedes agendar citas para ti mismo después de la primera cita",
          });
        }
        
        console.log("✅ [createCita] Permiso concedido para crear cita");
      }

      console.log("🔍 [createCita] Verificando disponibilidad...");
      // Verificar disponibilidad del profesional
      const disponible = await CitaModel.verificarDisponibilidad(
        citaData.profesional_id,
        citaData.fecha,
        citaData.hora_inicio,
        citaData.hora_fin
      );

      if (!disponible) {
        console.log("⚠️ [createCita] Profesional no disponible en BD");
        return res.status(409).json({
          success: false,
          message: "El profesional ya tiene una cita registrada en ese horario",
        });
      }

      // ✅ Verificar disponibilidad en Google Calendar (eventos personales o externos)
      console.log("🔍 [createCita] Verificando disponibilidad en Google Calendar...");
      const pool = require('../config/db');
      const profResult = await pool.query('SELECT email FROM users WHERE id = $1', [citaData.profesional_id]);
      const profesional_email_check = profResult.rows[0]?.email;
      console.log("   profesional_email para GC check:", profesional_email_check);

      const gcDisponibilidad = await verificarDisponibilidadGoogleCalendar(
        profesional_email_check,
        citaData.fecha,
        citaData.hora_inicio,
        citaData.hora_fin
      );

      console.log("📊 [createCita] Resultado GC disponibilidad:", JSON.stringify(gcDisponibilidad));

      if (!gcDisponibilidad.disponible) {
        const c = gcDisponibilidad.conflicto;
        console.log("⚠️ [createCita] Conflicto en Google Calendar:", c);
        return res.status(409).json({
          success: false,
          message: `El profesional tiene un compromiso en ese horario: "${c.titulo}" (${c.inicio} - ${c.fin})`
        });
      }
      console.log("✅ [createCita] Horario libre en Google Calendar");

      console.log("💾 [createCita] Guardando en BD...");

      // Crear la cita (sin consumir horas automáticamente — 
      // el crédito se asigna manualmente desde creditos.html)
      const nuevaCita = await CitaModel.createCita(citaData, userId);
      console.log("✅ [createCita] Cita creada exitosamente. ID:", nuevaCita.id);

      // ✅ NUEVO: Enviar notificación por email si el estado es "programada"
      if (citaData.estado === 'programada' || !citaData.estado) {
        try {
          console.log("📧 [createCita] Enviando notificación por email...");
          
          // Obtener datos completos de la cita con información del trabajador y profesional
          const citaCompleta = await CitaModel.getCitaById(nuevaCita.id);
          
          await enviarNotificacionCitaAgendada({
            id: citaCompleta.id,
            trabajador_nombre:  citaCompleta.trabajador_nombre,
            trabajador_cedula:  citaCompleta.trabajador_cedula,
            trabajador_email:   citaCompleta.trabajador_email,    // ← email del trabajador
            profesional_nombre: citaCompleta.profesional_nombre,
            profesional_id:     citaCompleta.profesional_id,      // ← para enlace Meet
            profesional_email:  citaCompleta.profesional_email,   // ← email del profesional
            fecha:              citaCompleta.fecha,
            hora_inicio:        citaCompleta.hora_inicio,
            hora_fin:           citaCompleta.hora_fin,
            modalidad_cita:     citaCompleta.modalidad_cita
          });
          
          console.log("✅ [createCita] Notificación enviada por email");
        } catch (emailError) {
          // No fallar la creación de la cita si falla el email
          console.error("⚠️ [createCita] Error al enviar email (cita creada exitosamente):", emailError);
        }

        // ✅ GOOGLE CALENDAR: crear evento en el calendario del profesional
        try {
          console.log("📅 [createCita] Creando evento en Google Calendar...");
          const citaCompleta = await CitaModel.getCitaById(nuevaCita.id);

          // 🧪 DIAGNÓSTICO: ver qué devuelve getCitaById para campos de hora
          console.log("🧪 [createCita] citaCompleta.hora_inicio:", citaCompleta.hora_inicio);
          console.log("🧪 [createCita] citaCompleta.hora_fin:   ", citaCompleta.hora_fin);
          console.log("🧪 [createCita] citaData.hora_inicio:   ", citaData.hora_inicio);
          console.log("🧪 [createCita] citaData.hora_fin:      ", citaData.hora_fin);
          console.log("🧪 [createCita] citaCompleta.fecha:     ", citaCompleta.fecha);
          console.log("🧪 [createCita] citaData.fecha:         ", citaData.fecha);

          // Usar citaCompleta para datos enriquecidos (nombre, email, cédula del JOIN)
          // pero preferir citaData para hora/fecha si citaCompleta los trae undefined
          const gcResult = await crearEventoCalendario({
            id:                  citaCompleta.id,
            profesional_email:   citaCompleta.profesional_email,
            profesional_nombre:  citaCompleta.profesional_nombre,
            profesional_id:      citaCompleta.profesional_id,
            trabajador_nombre:   citaCompleta.trabajador_nombre,
            trabajador_cedula:   citaCompleta.trabajador_cedula,
            // ✅ Usar citaData para fecha/hora — citaCompleta.fecha viene como ISO UTC
            // (ej: 2026-04-09T05:00:00.000Z) y puede desfasar un día al parsear.
            // citaData trae el string limpio directamente del frontend (ej: 2026-04-09).
            fecha:               citaData.fecha,
            hora_inicio:         citaData.hora_inicio,
            hora_fin:            citaData.hora_fin,
            modalidad_cita:      citaCompleta.modalidad_cita || citaData.modalidad_cita,
            observaciones_informe: citaCompleta.observaciones_informe || citaData.observaciones_informe
          });

          if (gcResult.success) {
            // Guardar el ID del evento de Google en la BD para editarlo/eliminarlo después
            await CitaModel.actualizarGoogleEventId(nuevaCita.id, gcResult.eventId);
            console.log("✅ [createCita] Evento creado en Google Calendar:", gcResult.eventId);
          } else {
            console.warn("⚠️ [createCita] No se pudo crear evento en Google Calendar:", gcResult.razon);
          }
        } catch (gcError) {
          console.error("⚠️ [createCita] Error en Google Calendar (cita creada exitosamente):", gcError);
        }
      }

      res.status(201).json({
        success: true,
        message: "Cita creada exitosamente",
        data: nuevaCita,
      });
    } catch (error) {
      console.error("❌ [createCita] Error:", error);
      console.error("❌ [createCita] Stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Error al crear la cita",
        error: error.message,
      });
    }
  },

  /**
   * Actualizar cita existente
   */
  async updateCita(req, res) {
    try {
      console.log("📥 [updateCita] ID:", req.params.id);
      const { id } = req.params;
      const citaData = req.body;
      const userId = req.user.id;

      // Verificar que la cita existe
      const citaExistente = await CitaModel.getCitaById(id);
      if (!citaExistente) {
        console.log("⚠️ [updateCita] Cita no encontrada");
        return res.status(404).json({
          success: false,
          message: "Cita no encontrada",
        });
      }

      // Verificar disponibilidad si cambió la fecha/hora o el profesional
      if (
        citaData.fecha !== citaExistente.fecha ||
        citaData.hora_inicio !== citaExistente.hora_inicio ||
        citaData.hora_fin !== citaExistente.hora_fin ||
        citaData.profesional_id !== citaExistente.profesional_id
      ) {
        // 1️⃣ Verificar en BD (citas de la app)
        const disponible = await CitaModel.verificarDisponibilidad(
          citaData.profesional_id,
          citaData.fecha,
          citaData.hora_inicio,
          citaData.hora_fin,
          id
        );

        if (!disponible) {
          console.log("⚠️ [updateCita] Profesional no disponible en BD");
          return res.status(409).json({
            success: false,
            message: "El profesional ya tiene una cita registrada en ese horario",
          });
        }

        // 2️⃣ Verificar en Google Calendar (eventos personales/externos)
        console.log("🔍 [updateCita] Verificando disponibilidad en Google Calendar...");
        const poolDb = require('../config/db');
        const profRes = await poolDb.query('SELECT email FROM users WHERE id = $1', [citaData.profesional_id]);
        const profEmail = profRes.rows[0]?.email;

        const gcDisp = await verificarDisponibilidadGoogleCalendar(
          profEmail,
          citaData.fecha,
          citaData.hora_inicio,
          citaData.hora_fin,
          citaExistente.google_event_id || null  // excluir el evento propio al editar
        );

        if (!gcDisp.disponible) {
          const c = gcDisp.conflicto;
          console.log("⚠️ [updateCita] Conflicto en Google Calendar:", c);
          return res.status(409).json({
            success: false,
            message: `El profesional tiene un compromiso en ese horario: "${c.titulo}" (${c.inicio} - ${c.fin})`
          });
        }
        console.log("✅ [updateCita] Horario libre en Google Calendar");
      }

      console.log("💾 [updateCita] Actualizando...");

      // ✅ Si el estado cambia a "cancelada" y la cita tenía crédito asignado:
      //    devolver las horas Y limpiar el credito_id
      const estadosQueConsumen = ["programada", "confirmada", "realizada", "no_asistio"];
      if (
        citaData.estado === "cancelada" &&
        citaExistente.credito_id &&
        estadosQueConsumen.includes(citaExistente.estado)
      ) {
        await devolverYLimpiarCredito(id, citaExistente, "updateCita");
        citaData.credito_id = null; // propagar el null al UPDATE
      }

      const citaActualizada = await CitaModel.updateCita(id, citaData, userId);
      console.log("✅ [updateCita] Cita actualizada");

      // ✅ GOOGLE CALENDAR: actualizar evento si existe
      if (citaExistente.google_event_id) {
        try {
          const citaCompleta = await CitaModel.getCitaById(id);
          await actualizarEventoCalendario(citaExistente.google_event_id, {
            id,
            profesional_email:   citaCompleta.profesional_email,
            profesional_nombre:  citaCompleta.profesional_nombre,
            profesional_id:      citaCompleta.profesional_id,
            trabajador_nombre:   citaCompleta.trabajador_nombre,
            trabajador_cedula:   citaCompleta.trabajador_cedula,
            fecha:               citaData.fecha,
            hora_inicio:         citaData.hora_inicio,
            hora_fin:            citaData.hora_fin,
            modalidad_cita:      citaData.modalidad_cita,
            observaciones_informe: citaData.observaciones_informe
          });
        } catch (gcError) {
          console.error("⚠️ [updateCita] Error actualizando Google Calendar:", gcError);
        }
      }

      res.json({
        success: true,
        message: "Cita actualizada exitosamente",
        data: citaActualizada,
      });
    } catch (error) {
      console.error("❌ [updateCita] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar la cita",
        error: error.message,
      });
    }
  },

  /**
   * Eliminar cita
   */
  async deleteCita(req, res) {
    try {
      console.log("📥 [deleteCita] ID:", req.params.id);
      const { id } = req.params;

      // ✅ NUEVO: Obtener cita antes de eliminar para devolver horas
      const cita = await CitaModel.getCitaById(id);
      
      if (!cita) {
        console.log("⚠️ [deleteCita] Cita no encontrada");
        return res.status(404).json({
          success: false,
          message: "Cita no encontrada",
        });
      }

      // ✅ Si la cita tenía crédito asignado, devolver las horas antes de eliminar
      if (cita.credito_id) {
        try {
          console.log("♻️ [deleteCita] Devolviendo horas al crédito...");
          await devolverHorasCita(cita.credito_id, cita.hora_inicio, cita.hora_fin);
          console.log("✅ [deleteCita] Horas devueltas al crédito");
        } catch (error) {
          console.error("⚠️ [deleteCita] Error al devolver horas:", error);
        }
      }

      // ✅ GOOGLE CALENDAR: eliminar evento si existe
      if (cita.google_event_id) {
        try {
          const citaCompleta = await CitaModel.getCitaById(id);
          await eliminarEventoCalendario(cita.google_event_id, citaCompleta.profesional_email);
        } catch (gcError) {
          console.error("⚠️ [deleteCita] Error eliminando de Google Calendar:", gcError);
        }
      }

      const citaEliminada = await CitaModel.deleteCita(id);

      console.log("✅ [deleteCita] Cita eliminada");
      res.json({
        success: true,
        message: "Cita eliminada exitosamente",
        data: citaEliminada,
      });
    } catch (error) {
      console.error("❌ [deleteCita] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar la cita",
        error: error.message,
      });
    }
  },

  /**
   * 🔍 Obtener citas para el calendario (por rango de fechas)
   * CON LOGGING DETALLADO
   */
  async getCitasCalendario(req, res) {
    try {
      console.log("\n🎨 ========================================");
      console.log("🎨 [CALENDARIO] Iniciando getCitasCalendario");
      console.log("🎨 ========================================");
      
      const { fecha_inicio, fecha_fin } = req.query;
      console.log("📅 [CALENDARIO] Fecha inicio:", fecha_inicio);
      console.log("📅 [CALENDARIO] Fecha fin:", fecha_fin);

      if (!fecha_inicio || !fecha_fin) {
        console.log("⚠️ [CALENDARIO] Faltan fechas");
        return res.status(400).json({
          success: false,
          message: "Se requieren fecha_inicio y fecha_fin",
        });
      }

      const filters = {
        profesional_id: req.query.profesional_id,
        modalidad_programa: req.query.modalidad_programa,
        estado: req.query.estado,  // ✅ NUEVO: Agregar filtro de estado
      };
      console.log("🔍 [CALENDARIO] Filtros:", filters);

      console.log("💾 [CALENDARIO] Consultando BD...");
      const citas = await CitaModel.getCitasPorRango(fecha_inicio, fecha_fin, filters);
      console.log("✅ [CALENDARIO] Citas obtenidas de BD:", citas.length);
      
      if (citas.length > 0) {
        console.log("📋 [CALENDARIO] Primera cita:", {
          id: citas[0].id,
          trabajador: citas[0].trabajador_nombre,
          fecha: citas[0].fecha,
          hora_inicio: citas[0].hora_inicio,
          estado: citas[0].estado,
          modalidad_cita: citas[0].modalidad_cita
        });
      }

      console.log("🎨 [CALENDARIO] Formateando eventos...");
      // Formatear para FullCalendar con título mejorado
      const eventos = citas.map((cita, index) => {
        // Formatear hora a 12h con AM/PM
        const formatearHora = (hora) => {
          const [horas, minutos] = hora.split(':');
          let h = parseInt(horas);
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return `${h}:${minutos} ${ampm}`;
        };

        // Icono según modalidad
        const icono = cita.modalidad_cita === 'presencial' ? '🏢' : '💻';
        
        // Título base del evento
        const horaInicio = formatearHora(cita.hora_inicio);
        const horaFin = formatearHora(cita.hora_fin);
        const titulo = `${icono} ${cita.trabajador_nombre}`;

        // ✅ CORREGIDO: Asegurar que la fecha sea string en formato ISO
        const fechaISO = cita.fecha instanceof Date 
          ? cita.fecha.toISOString().split('T')[0]
          : cita.fecha.toString().split('T')[0];

        const evento = {
          id: cita.id,
          title: titulo,
          start: `${fechaISO}T${cita.hora_inicio}`,
          end: `${fechaISO}T${cita.hora_fin}`,
          backgroundColor: getColorByEstado(cita.estado),
          borderColor: getColorByEstado(cita.estado),
          className: `estado-${cita.estado}`,
          extendedProps: {
            trabajador_id: cita.trabajador_id,
            trabajador_nombre: cita.trabajador_nombre,
            trabajador_cedula: cita.trabajador_cedula,
            profesional_id: cita.profesional_id,
            profesional_nombre: cita.profesional_nombre,
            modalidad_cita: cita.modalidad_cita,
            estado: cita.estado,
            modalidad_programa: cita.modalidad_programa,
            hora_inicio_formatted: horaInicio,
            hora_fin_formatted: horaFin,
          },
        };

        if (index === 0) {
          console.log("🎨 [CALENDARIO] Evento formateado (primero):", {
            id: evento.id,
            title: evento.title,
            start: evento.start,
            end: evento.end,
            color: evento.backgroundColor,
            className: evento.className
          });
        }

        return evento;
      });

      console.log("✅ [CALENDARIO] Total eventos formateados:", eventos.length);
      console.log("📤 [CALENDARIO] Enviando respuesta...");
      
      res.json({
        success: true,
        data: eventos,
      });
      
      console.log("✅ [CALENDARIO] Respuesta enviada exitosamente");
      console.log("🎨 ========================================\n");
    } catch (error) {
      console.error("❌ [CALENDARIO] ERROR:", error);
      console.error("❌ [CALENDARIO] Stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Error al obtener citas del calendario",
        error: error.message,
      });
    }
  },

  /**
   * ✅ NUEVO: Asignar crédito manualmente a una cita (desde creditos.html)
   * PATCH /api/citas/:id/asignar-credito
   * body: { credito_id }
   */
  async asignarCredito(req, res) {
    try {
      const { id } = req.params;
      const { credito_id } = req.body;

      console.log(`📥 [asignarCredito] Cita ${id} → Crédito ${credito_id ?? 'null (quitar)'}`);

      // Obtener cita actual
      const cita = await CitaModel.getCitaById(id);
      if (!cita) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada' });
      }

      const CreditoModel = require('../models/creditoModel');
      const { calcularDuracionCita } = require('../utils/creditosHelper');
      const horasCita = calcularDuracionCita(cita.hora_inicio, cita.hora_fin);

      // ── QUITAR ASIGNACIÓN (credito_id = null) ──────────────────────────
      if (credito_id === null || credito_id === undefined || credito_id === '') {
        if (!cita.credito_id) {
          return res.status(400).json({ success: false, message: 'Esta cita no tiene formato asignado' });
        }

        // Devolver horas al crédito anterior
        try {
          await CreditoModel.devolverHoras(cita.credito_id, horasCita);
          console.log(`♻️ [asignarCredito] Devueltas ${horasCita}h al crédito ID ${cita.credito_id}`);
        } catch (err) {
          console.error('⚠️ [asignarCredito] Error al devolver horas:', err);
        }

        await CitaModel.actualizarCreditoId(id, null);

        return res.json({
          success: true,
          message: 'Asignación quitada y horas devueltas correctamente',
          data: { cita_id: id, credito_id: null, horas_devueltas: horasCita }
        });
      }

      // ── ASIGNAR CRÉDITO ────────────────────────────────────────────────
      const credito = await CreditoModel.obtenerPorId(credito_id);
      if (!credito) {
        return res.status(404).json({ success: false, message: 'Crédito no encontrado' });
      }

      // Si ya tenía otro crédito, devolver horas al anterior
      if (cita.credito_id && String(cita.credito_id) !== String(credito_id)) {
        try {
          await CreditoModel.devolverHoras(cita.credito_id, horasCita);
          console.log(`♻️ [asignarCredito] Devueltas ${horasCita}h al crédito anterior ID ${cita.credito_id}`);
        } catch (err) {
          console.error('⚠️ [asignarCredito] Error al devolver horas al crédito anterior:', err);
        }
      }

      // Solo consumir si es un crédito diferente al actual
      const mismoCredito = String(cita.credito_id) === String(credito_id);
      if (!mismoCredito) {
        const horasDisponibles = credito.cantidad_horas - credito.horas_consumidas;
        if (horasDisponibles < horasCita) {
          return res.status(400).json({
            success: false,
            message: `Horas insuficientes en "${credito.consecutivo}". Disponibles: ${horasDisponibles.toFixed(2)}h, Requeridas: ${horasCita.toFixed(2)}h`
          });
        }
        await CreditoModel.consumirHoras(credito_id, horasCita);
        console.log(`✅ [asignarCredito] Consumidas ${horasCita}h del crédito "${credito.consecutivo}"`);
      }

      await CitaModel.actualizarCreditoId(id, credito_id);

      console.log(`✅ [asignarCredito] Cita ${id} asignada al crédito ${credito_id}`);
      res.json({
        success: true,
        message: `Cita asignada al formato "${credito.consecutivo}" correctamente`,
        data: { cita_id: id, credito_id, horas_consumidas: horasCita }
      });

    } catch (error) {
      console.error('❌ [asignarCredito] Error:', error);
      res.status(500).json({ success: false, message: 'Error al asignar crédito', error: error.message });
    }
  },

  /**
   * Cambiar estado de una cita
   */
  async cambiarEstado(req, res) {
    try {
      console.log("📥 [cambiarEstado] ID:", req.params.id);
      const { id } = req.params;
      const { estado } = req.body;
      const userId = req.user.id;

      const estadosValidos = ["programada", "confirmada", "realizada", "cancelada", "no_asistio"];
      if (!estadosValidos.includes(estado)) {
        console.log("⚠️ [cambiarEstado] Estado inválido:", estado);
        return res.status(400).json({
          success: false,
          message: "Estado inválido",
        });
      }

      const cita = await CitaModel.getCitaById(id);
      if (!cita) {
        console.log("⚠️ [cambiarEstado] Cita no encontrada");
        return res.status(404).json({
          success: false,
          message: "Cita no encontrada",
        });
      }

      // ✅ Si cancela y tenía crédito asignado: devolver horas Y limpiar credito_id
      const estadosQueConsumen = ["programada", "confirmada", "realizada", "no_asistio"];
      if (estado === "cancelada" && cita.credito_id && estadosQueConsumen.includes(cita.estado)) {
        await devolverYLimpiarCredito(id, cita, "cambiarEstado");
      }

      const citaActualizada = await CitaModel.updateCita(id, { ...cita, estado, credito_id: cita.credito_id }, userId);

      console.log("✅ [cambiarEstado] Estado cambiado a:", estado);
      res.json({
        success: true,
        message: "Estado actualizado exitosamente",
        data: citaActualizada,
      });
    } catch (error) {
      console.error("❌ [cambiarEstado] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al cambiar el estado",
        error: error.message,
      });
    }
  },

  /**
   * Obtener estadísticas de citas
   */
  async getEstadisticas(req, res) {
    try {
      console.log("📥 [getEstadisticas] Iniciando...");
      const filters = {
        fecha_inicio:      req.query.fecha_inicio,
        fecha_fin:         req.query.fecha_fin,
        modalidad_programa: req.query.modalidad_programa,
        profesional_id:    req.query.profesional_id,   // ← faltaba
      };
      console.log("🔍 [getEstadisticas] Filtros:", filters);

      const estadisticas = await CitaModel.getEstadisticas(filters);

      const resultado = {
        total: 0,
        programadas: 0,
        confirmadas: 0,
        realizadas: 0,
        canceladas: 0,
        no_asistio: 0,
      };

      estadisticas.forEach((item) => {
        resultado.total += parseInt(item.cantidad);
        resultado[item.estado] = parseInt(item.cantidad);
      });

      console.log("✅ [getEstadisticas] Resultado:", resultado);
      res.json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error("❌ [getEstadisticas] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener estadísticas",
        error: error.message,
      });
    }
  },

  /**
   * ✅ NUEVO: Obtener trabajadores que tienen citas previas con un profesional
   * Endpoint: GET /api/citas/trabajadores-por-profesional/:profesionalId
   */
  async getTrabajadoresPorProfesional(req, res) {
    try {
      console.log("📥 [getTrabajadoresPorProfesional] Iniciando...");
      const profesionalId = req.params.profesionalId;
      const modalidadPrograma = req.query.modalidad;

      console.log("👨‍⚕️ [getTrabajadoresPorProfesional] Profesional ID:", profesionalId);
      console.log("📋 [getTrabajadoresPorProfesional] Modalidad:", modalidadPrograma);

      if (!profesionalId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere el ID del profesional",
        });
      }

      if (!modalidadPrograma) {
        return res.status(400).json({
          success: false,
          message: "Se requiere la modalidad del programa",
        });
      }

      const trabajadores = await CitaModel.getTrabajadoresPorProfesional(
        profesionalId,
        modalidadPrograma
      );

      console.log("✅ [getTrabajadoresPorProfesional] Trabajadores encontrados:", trabajadores.length);

      res.json({
        success: true,
        data: trabajadores,
      });
    } catch (error) {
      console.error("❌ [getTrabajadoresPorProfesional] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener trabajadores del profesional",
        error: error.message,
      });
    }
  },

  /**
   * Confirmar o cancelar cita desde email
   */
  async confirmarDesdeEmail(req, res) {
    try {
      const { id } = req.params;
      const { accion } = req.query;

      console.log(`📧 [confirmarDesdeEmail] Acción: ${accion} para cita ID: ${id}`);

      // Validar acción
      if (!accion || (accion !== 'confirmar' && accion !== 'cancelar')) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f9fafb; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
              .error { color: #ef4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">❌ Acción no válida</h1>
              <p>La acción solicitada no es válida.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Obtener la cita
      const cita = await CitaModel.getCitaById(id);

      if (!cita) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; background: #f9fafb; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
              .error { color: #ef4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">❌ Cita no encontrada</h1>
              <p>La cita solicitada no existe en el sistema.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Determinar el nuevo estado
      const nuevoEstado = accion === 'confirmar' ? 'confirmada' : 'cancelada';

      // ✅ BLOQUEO DE DOBLE CLIC:
      // Si la cita ya fue procesada (ya no está en "programada"), mostrar
      // página de "ya procesada" con los botones visualmente deshabilitados,
      // sin importar si intenta confirmar o cancelar por segunda vez.
      if (cita.estado !== 'programada') {
        const yaConfirmada = cita.estado === 'confirmada';
        const yaCancelada  = cita.estado === 'cancelada';

        const colorHeader = yaConfirmada
          ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);'
          : yaCancelada
            ? 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);'
            : 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);';

        const iconoHeader = yaConfirmada ? '✅' : yaCancelada ? '❌' : '⚠️';
        const tituloHeader = yaConfirmada
          ? 'Cita ya confirmada'
          : yaCancelada
            ? 'Cita ya cancelada'
            : 'Acción no disponible';
        const mensajeHeader = yaConfirmada
          ? 'Esta cita ya fue confirmada anteriormente.'
          : yaCancelada
            ? 'Esta cita ya fue cancelada anteriormente.'
            : `Esta cita ya fue procesada (estado: ${cita.estado}).`;

        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${tituloHeader} - ST Consultores</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: Arial, sans-serif; background: #f9fafb; padding: 30px 16px; }
              .container { max-width: 600px; margin: 0 auto; background: white;
                           border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.10); overflow: hidden; }
              .header { ${colorHeader} color: white; padding: 30px; text-align: center; }
              .header h1 { font-size: 26px; margin-bottom: 6px; }
              .header p  { font-size: 14px; opacity: 0.9; }
              .body { padding: 28px 30px; }
              .info-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; }
              .label { font-weight: bold; color: #667eea; }
              .btn-group { display: flex; gap: 12px; justify-content: center; margin-top: 28px; flex-wrap: wrap; }
              .btn { padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: bold;
                     border: none; cursor: not-allowed; opacity: 0.45; pointer-events: none;
                     display: inline-flex; align-items: center; gap: 8px; }
              .btn-confirm { background: linear-gradient(135deg, #34d399, #10b981); color: white; }
              .btn-cancel  { background: linear-gradient(135deg, #f87171, #ef4444); color: white; }
              .badge { display: inline-block; padding: 4px 14px; border-radius: 20px;
                       font-size: 13px; font-weight: bold; margin-top: 4px; }
              .badge-confirmada { background: #d1fae5; color: #065f46; }
              .badge-cancelada  { background: #fee2e2; color: #991b1b; }
              .badge-otra       { background: #fef3c7; color: #92400e; }
              .notice { margin-top: 20px; padding: 14px 16px; background: #f3f4f6;
                        border-radius: 8px; font-size: 13px; color: #6b7280; text-align: center; }
              .footer { text-align: center; padding: 16px; font-size: 12px; color: #9ca3af;
                        border-top: 1px solid #f3f4f6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${iconoHeader} ${tituloHeader}</h1>
                <p>${mensajeHeader}</p>
              </div>
              <div class="body">
                <h3 style="margin-bottom:14px;color:#374151;font-size:15px;">Detalles de la Cita</h3>
                <div class="info-row">
                  <span class="label">Trabajador:</span> ${cita.trabajador_nombre}
                </div>
                <div class="info-row">
                  <span class="label">Profesional:</span> ${cita.profesional_nombre}
                </div>
                <div class="info-row">
                  <span class="label">Fecha:</span>
                  ${new Date(cita.fecha).toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                </div>
                <div class="info-row">
                  <span class="label">Hora:</span>
                  ${formatearHoraAmPm(cita.hora_inicio)} - ${formatearHoraAmPm(cita.hora_fin)}
                </div>
                <div class="info-row" style="border-bottom:none;">
                  <span class="label">Estado actual:</span>
                  <span class="badge badge-${cita.estado === 'confirmada' ? 'confirmada' : cita.estado === 'cancelada' ? 'cancelada' : 'otra'}">
                    ${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}
                  </span>
                </div>

                <!-- Botones deshabilitados visualmente -->
                <div class="btn-group">
                  <button class="btn btn-confirm" disabled>✓ Sí, Confirmar</button>
                  <button class="btn btn-cancel"  disabled>✗ No, Cancelar</button>
                </div>

                <div class="notice">
                  Esta acción ya fue procesada. Los botones han sido deshabilitados.<br>
                  Puede cerrar esta ventana.
                </div>
              </div>
              <div class="footer">ST Consultores © 2026 &nbsp;|&nbsp; Mensaje automático</div>
            </div>
          </body>
          </html>
        `);
      }

      // ✅ Si cancela y tenía crédito asignado: devolver horas Y limpiar credito_id.
      const estadosQueConsumen = ["programada", "confirmada", "realizada", "no_asistio"];
      if (nuevoEstado === "cancelada" && cita.credito_id && estadosQueConsumen.includes(cita.estado)) {
        await devolverYLimpiarCredito(id, cita, "confirmarDesdeEmail");
      }

      // Actualizar el estado
      await CitaModel.cambiarEstado(id, nuevoEstado);

      console.log(`✅ [confirmarDesdeEmail] Cita ${id} cambiada a estado: ${nuevoEstado}`);

      // Respuesta HTML de éxito
      const estiloEstado = accion === 'confirmar' 
        ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;'
        : 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;';

      const icono = accion === 'confirmar' ? '✅' : '❌';
      const titulo = accion === 'confirmar' ? 'Cita Confirmada' : 'Cita Cancelada';
      const mensaje = accion === 'confirmar' 
        ? 'La cita ha sido confirmada exitosamente.'
        : 'La cita ha sido cancelada.';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${titulo} - ST Consultores</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px 20px;
              background: #f9fafb;
              margin: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              ${estiloEstado}
              padding: 30px;
              border-radius: 10px;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
            }
            .details {
              text-align: left;
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
              margin-top: 20px;
            }
            .detail-row {
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .label {
              font-weight: bold;
              color: #667eea;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${icono} ${titulo}</h1>
            </div>
            <p style="font-size: 18px;">${mensaje}</p>
            
            <div class="details">
              <h3>Detalles de la Cita:</h3>
              <div class="detail-row">
                <span class="label">Trabajador:</span> ${cita.trabajador_nombre}
              </div>
              <div class="detail-row">
                <span class="label">Profesional:</span> ${cita.profesional_nombre}
              </div>
              <div class="detail-row">
                <span class="label">Fecha:</span> ${new Date(cita.fecha).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div class="detail-row">
                <span class="label">Hora:</span> ${formatearHoraAmPm(cita.hora_inicio)} - ${formatearHoraAmPm(cita.hora_fin)}
              </div>
              <div class="detail-row">
                <span class="label">Estado:</span> <strong>${nuevoEstado.toUpperCase()}</strong>
              </div>
            </div>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Puede cerrar esta ventana.
            </p>
          </div>
          <script>
            // Prevenir que el usuario vuelva atrás y haga click de nuevo
            history.pushState(null, null, location.href);
            window.onpopstate = function() {
              history.go(1);
            };
            
            // Deshabilitar el botón de retroceso
            (function() {
              if (window.history && window.history.pushState) {
                window.history.pushState('forward', null, '');
                window.addEventListener('popstate', function() {
                  window.history.pushState('forward', null, '');
                });
              }
            })();
          </script>
        </body>
        </html>
      `);

    } catch (error) {
      console.error("❌ [confirmarDesdeEmail] Error:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
            .error { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">❌ Error</h1>
            <p>Ocurrió un error al procesar la solicitud.</p>
            <p style="color: #6b7280; font-size: 14px;">${error.message}</p>
          </div>
        </body>
        </html>
      `);
    }
  }
};

// ============================================================
// HELPER: Devolver horas al crédito Y limpiar credito_id de la cita
// Se usa en los tres puntos donde una cita puede cancelarse:
//   updateCita, cambiarEstado, confirmarDesdeEmail
// ============================================================
async function devolverYLimpiarCredito(citaId, cita, contexto) {
  const CreditoModel = require('../models/creditoModel');
  const { calcularDuracionCita } = require('../utils/creditosHelper');

  try {
    const horasCita = calcularDuracionCita(cita.hora_inicio, cita.hora_fin);

    console.log(`♻️ [${contexto}] Devolviendo ${horasCita}h al crédito ID ${cita.credito_id}...`);
    await CreditoModel.devolverHoras(cita.credito_id, horasCita);
    console.log(`✅ [${contexto}] Horas devueltas`);

    // Limpiar credito_id en la cita para que el modal muestre estado correcto
    await CitaModel.actualizarCreditoId(citaId, null);
    console.log(`✅ [${contexto}] credito_id limpiado en cita ${citaId}`);

    // Actualizar el objeto local para que el spread en updateCita propague null
    cita.credito_id = null;

  } catch (err) {
    console.error(`⚠️ [${contexto}] Error al devolver/limpiar crédito:`, err);
    // No bloquear el cambio de estado si falla la devolución
  }
}

// Función auxiliar para obtener color por estado
function getColorByEstado(estado) {
  const colores = {
    confirmada: "#10B981",
    programada: "#F59E0B",
    realizada: "#3B82F6",
    cancelada: "#EF4444",
    no_asistio: "#6B7280",
  };
  const color = colores[estado] || "#6B7280";
  console.log(`🎨 [Color] Estado: ${estado} → Color: ${color}`);
  return color;
}

// Función auxiliar para formatear hora a formato 12 horas con AM/PM
function formatearHoraAmPm(hora) {
  // hora viene como "09:00:00" o "09:00"
  const [horas, minutos] = hora.split(':');
  let h = parseInt(horas);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 se convierte en 12
  return `${h}:${minutos} ${ampm}`;
}

module.exports = CitasController;