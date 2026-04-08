// backend/utils/googleCalendarService.js
// Integración con Google Calendar API usando Service Account

const { google } = require('googleapis');
const path = require('path');
const fs   = require('fs');
const { getMeetLink } = require('../config/meetLinks');

const CREDENTIALS_PATH = path.join(__dirname, '../config/google-service-account.json');
const SCOPES           = ['https://www.googleapis.com/auth/calendar'];
const TIMEZONE         = 'America/Bogota';

// ============================================================
// DIAGNÓSTICO INICIAL — se ejecuta al cargar el módulo
// ============================================================
console.log('🔧 [GoogleCalendar] Módulo cargado');
console.log('🔧 [GoogleCalendar] Ruta de credenciales:', CREDENTIALS_PATH);

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error('❌ [GoogleCalendar] ARCHIVO DE CREDENCIALES NO ENCONTRADO');
  console.error('   → Crea el archivo en:', CREDENTIALS_PATH);
} else {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    console.log('✅ [GoogleCalendar] Credenciales encontradas:');
    console.log('   tipo:', creds.type);
    console.log('   proyecto:', creds.project_id);
    console.log('   client_email:', creds.client_email);
    if (creds.type !== 'service_account') {
      console.error('❌ [GoogleCalendar] El archivo NO es de tipo service_account');
    }
  } catch (e) {
    console.error('❌ [GoogleCalendar] Error leyendo credenciales:', e.message);
  }
}

// ============================================================
// HELPERS
// ============================================================

function construirDatetime(fecha, hora) {
  if (!fecha || !hora) {
    console.error('❌ Fecha u hora inválida:', fecha, hora);
    return null;
  }

  // Extraer YYYY-MM-DD directamente del string para evitar
  // que new Date() interprete la fecha en UTC y desfase un día
  const soloFecha = String(fecha).split('T')[0]; // "2026-04-19"
  const [anio, mes, dia] = soloFecha.split('-');

  // Extraer HH:MM de la hora
  const [h, m] = String(hora).split(':');
  const hh = (h || '00').padStart(2, '0');
  const mm = (m || '00').padStart(2, '0');

  // Construir con offset fijo de Colombia -05:00
  return `${anio}-${mes}-${dia}T${hh}:${mm}:00-05:00`;
}

// ============================================================
// CREAR EVENTO
// ============================================================

async function crearEventoCalendario(citaData) {
  console.log('\n📅 ══════════════════════════════════════════');
  console.log('📅 [GoogleCalendar] INICIANDO crearEventoCalendario');
  console.log('📅 ══════════════════════════════════════════');

  const {
    id, profesional_email, profesional_nombre, profesional_id,
    trabajador_nombre, trabajador_cedula,
    fecha, hora_inicio, hora_fin, modalidad_cita, observaciones_informe
  } = citaData;

  // LOG 1 — datos recibidos
  console.log('📋 [LOG-1] Datos recibidos:');
  console.log('   cita_id:', id);
  console.log('   profesional_email:', profesional_email);
  console.log('   profesional_nombre:', profesional_nombre);
  console.log('   trabajador_nombre:', trabajador_nombre);
  console.log('   fecha:', fecha);
  console.log('   hora_inicio:', hora_inicio, '→ hora_fin:', hora_fin);

  // LOG 2 — verificar email
  if (!profesional_email) {
    console.warn('⚠️ [LOG-2] DETENIDO: el profesional no tiene email registrado');
    return { success: false, razon: 'sin_email' };
  }
  console.log('✅ [LOG-2] Email del profesional verificado:', profesional_email);

  // LOG 3 — verificar credenciales
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ [LOG-3] DETENIDO: archivo de credenciales no encontrado');
    return { success: false, razon: 'credenciales_no_encontradas' };
  }
  console.log('✅ [LOG-3] Archivo de credenciales existe');

  // LOG 4 — construir fechas
  const startDateTime = construirDatetime(fecha, hora_inicio);
  const endDateTime   = construirDatetime(fecha, hora_fin);
  console.log('✅ [LOG-4] Fechas construidas:');
  console.log('   start:', startDateTime);
  console.log('   end:', endDateTime);
  console.log('   timezone:', TIMEZONE);

  // LOG 5 — autenticación SIN impersonación (Gmail personal)
  // La Service Account actúa como sí misma sobre el calendario compartido
  console.log('🔐 [LOG-5] Creando cliente autenticado con Service Account...');
  console.log('   Modo: acceso directo al calendario compartido (Gmail personal)');
  console.log('   calendarId que se usará:', profesional_email);

  let auth;
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES
      // ✅ SIN clientOptions.subject — no impersonamos (requiere Google Workspace)
      // El calendario ya está compartido con la Service Account directamente
    });
    console.log('✅ [LOG-5] Objeto auth creado');
  } catch (authError) {
    console.error('❌ [LOG-5] Error al crear auth:', authError.message);
    return { success: false, razon: authError.message };
  }

  // LOG 6 — obtener token (prueba real de conectividad)
  console.log('🔑 [LOG-6] Intentando obtener access token de Google...');
  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (tokenResponse.token) {
      console.log('✅ [LOG-6] Access token obtenido correctamente');
      console.log('   Token (primeros 20 chars):', tokenResponse.token.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ [LOG-6] Token vacío — posible problema de delegación');
    }
  } catch (tokenError) {
    console.error('❌ [LOG-6] ERROR al obtener token:');
    console.error('   Mensaje:', tokenError.message);
    console.error('   Código:', tokenError.code);
    if (tokenError.message.includes('invalid_grant')) {
      console.error('   → CAUSA: Domain-Wide Delegation no está configurado o el email del profesional no pertenece al dominio');
    }
    if (tokenError.message.includes('unauthorized_client')) {
      console.error('   → CAUSA: La Service Account no tiene permisos de delegación en Google Workspace Admin');
    }
    // No detenemos aquí — intentamos igual el insert para ver si falla en otro punto
  }

  // LOG 7 — construir evento
  const meetLink = getMeetLink(profesional_id);
  console.log('✅ [LOG-7] Meet link:', meetLink || '(ninguno configurado)');

  const descripcion = [
    `📋 Cita agendada por ST Consultores`,
    ``,
    `👤 Trabajador: ${trabajador_nombre} (CC: ${trabajador_cedula})`,
    `👨‍⚕️ Profesional: ${profesional_nombre}`,
    `📅 Modalidad: ${modalidad_cita === 'virtual' ? 'Virtual' : 'Presencial'}`,
    meetLink ? `🎥 Enlace Meet: ${meetLink}` : '',
    observaciones_informe ? `\n📝 Observaciones: ${observaciones_informe}` : '',
    ``,
    `🔗 Cita #${id} — Sistema ST Consultores`
  ].filter(Boolean).join('\n');

  const evento = {
    summary: `Cita - ${trabajador_nombre}`,
    description: descripcion,
    start: { dateTime: startDateTime },
    end:   { dateTime: endDateTime   },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email',  minutes: 30 },
        { method: 'popup',  minutes: 15 }
      ]
    },
    extendedProperties: {
      private: {
        stconsultores_cita_id: String(id),
        creado_por: 'ST Consultores'
      }
    }
  };

  console.log('✅ [LOG-7] Evento construido:', JSON.stringify({
    summary: evento.summary,
    start: evento.start,
    end: evento.end
  }, null, 2));

  // LOG 8 — llamada a Google Calendar API
  console.log('📡 [LOG-8] Enviando evento a Google Calendar API...');
  console.log('   calendarId: primary');
  console.log('   email destino:', profesional_email);

  // 🧪 DEBUG CRÍTICO (AGREGAR AQUÍ)
console.log('🧪 EVENTO COMPLETO RAW:');
console.dir(evento, { depth: null });

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: profesional_email,  // ✅ el calendario compartido con la Service Account
      resource: evento,
      conferenceDataVersion: 0
    });

    // LOG 9 — resultado
    console.log('🎉 [LOG-9] ¡ÉXITO! Evento creado en Google Calendar:');
    console.log('   Event ID:', response.data.id);
    console.log('   Status:', response.data.status);
    console.log('   Link:', response.data.htmlLink);
    console.log('   Creador:', response.data.creator?.email);
    console.log('   Organizador:', response.data.organizer?.email);

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    };

  } catch (insertError) {
    console.error('❌ [LOG-9] ERROR al insertar evento en Google Calendar:');
    console.error('   Mensaje:', insertError.message);
    console.error('   Código HTTP:', insertError.code);
    console.error('   Errores detallados:', JSON.stringify(insertError.errors || [], null, 2));

    // Diagnóstico por código de error
    if (insertError.code === 401) {
      console.error('   → CAUSA 401: Token inválido o expirado. Verifica la Service Account.');
    } else if (insertError.code === 403) {
      console.error('   → CAUSA 403: Sin permisos.');
      console.error('     SI USAS GMAIL PERSONAL: el calendario debe compartirse manualmente');
      console.error('       con el email de la Service Account (termina en @...iam.gserviceaccount.com)');
      console.error('     SI USAS GOOGLE WORKSPACE: verifica Domain-Wide Delegation en admin.google.com');
    } else if (insertError.code === 404) {
      console.error('   → CAUSA 404: Calendario no encontrado');
    } else if (insertError.code === 400) {
      console.error('   → CAUSA 400: Datos del evento inválidos');
    }

    return { success: false, razon: `${insertError.code}: ${insertError.message}` };
  }
}

// ============================================================
// ACTUALIZAR EVENTO
// ============================================================

async function actualizarEventoCalendario(googleEventId, citaData) {
  const { profesional_email, profesional_id, trabajador_nombre, trabajador_cedula,
          profesional_nombre, fecha, hora_inicio, hora_fin, modalidad_cita,
          observaciones_informe, id } = citaData;

  console.log(`📅 [GoogleCalendar] actualizarEvento → ID: ${googleEventId}, email: ${profesional_email}`);

  if (!profesional_email || !googleEventId) {
    console.warn('⚠️ [GoogleCalendar] actualizarEvento: faltan datos, omitiendo');
    return { success: false };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES
      // Sin subject — acceso directo al calendario compartido
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const meetLink = getMeetLink(profesional_id);

    const descripcion = [
      `📋 Cita agendada por ST Consultores`,
      `👤 Trabajador: ${trabajador_nombre} (CC: ${trabajador_cedula})`,
      `👨‍⚕️ Profesional: ${profesional_nombre}`,
      `📅 Modalidad: ${modalidad_cita === 'virtual' ? 'Virtual' : 'Presencial'}`,
      meetLink ? `🎥 Enlace Meet: ${meetLink}` : '',
      `🔗 Cita #${id} — Sistema ST Consultores`
    ].filter(Boolean).join('\n');

    await calendar.events.update({
      calendarId: profesional_email,  // ✅ calendario compartido
      eventId: googleEventId,
      resource: {
        summary: `Cita - ${trabajador_nombre}`,
        description: descripcion,
        start: { dateTime: construirDatetime(fecha, hora_inicio) },
        end:   { dateTime: construirDatetime(fecha, hora_fin)    }
      }
    });

    console.log(`✅ [GoogleCalendar] Evento ${googleEventId} actualizado`);
    return { success: true };

  } catch (error) {
    console.error(`❌ [GoogleCalendar] Error al actualizar evento ${googleEventId}:`, error.message, '| Código:', error.code);
    return { success: false, razon: error.message };
  }
}

// ============================================================
// ELIMINAR EVENTO
// ============================================================

async function eliminarEventoCalendario(googleEventId, profesional_email) {
  console.log(`📅 [GoogleCalendar] eliminarEvento → ID: ${googleEventId}, email: ${profesional_email}`);

  if (!profesional_email || !googleEventId) {
    console.warn('⚠️ [GoogleCalendar] eliminarEvento: faltan datos, omitiendo');
    return { success: false };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES
      // Sin subject — acceso directo al calendario compartido
    });
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: profesional_email,  // ✅ calendario compartido
      eventId: googleEventId
    });

    console.log(`✅ [GoogleCalendar] Evento ${googleEventId} eliminado`);
    return { success: true };

  } catch (error) {
    if (error.code === 410 || error.code === 404) {
      console.warn(`⚠️ [GoogleCalendar] Evento ${googleEventId} ya no existe`);
      return { success: true };
    }
    console.error(`❌ [GoogleCalendar] Error al eliminar ${googleEventId}:`, error.message, '| Código:', error.code);
    return { success: false, razon: error.message };
  }
}

module.exports = {
  crearEventoCalendario,
  actualizarEventoCalendario,
  eliminarEventoCalendario,
  verificarDisponibilidadGoogleCalendar
};

// ============================================================
// VERIFICAR DISPONIBILIDAD EN GOOGLE CALENDAR — Freebusy API
// ============================================================

/**
 * Consulta la Freebusy API de Google para detectar si el profesional
 * tiene algún compromiso que se solape con el horario solicitado.
 *
 * Usa freebusy en lugar de events.list porque:
 *  - Detecta solapamiento real (evento que empieza antes y termina dentro)
 *  - No requiere leer los detalles de cada evento (privacidad)
 *  - Es la API correcta para consultas de disponibilidad
 *
 * @param {string}  profesional_email  - Email del profesional
 * @param {string}  fecha              - Fecha de la cita (ISO o YYYY-MM-DD)
 * @param {string}  hora_inicio        - "09:00" o "09:00:00"
 * @param {string}  hora_fin           - "10:00" o "10:00:00"
 * @param {string|null} googleEventIdExcluir - ID del evento propio a excluir (para ediciones)
 * @returns {{ disponible: boolean, conflicto: { inicio, fin } | null }}
 */
async function verificarDisponibilidadGoogleCalendar(
  profesional_email,
  fecha,
  hora_inicio,
  hora_fin,
  googleEventIdExcluir = null
) {
  console.log('\n🔍 ══════════════════════════════════════════');
  console.log('🔍 [GC-Freebusy] INICIANDO verificación de disponibilidad');
  console.log('🔍 ══════════════════════════════════════════');
  console.log('   profesional_email:', profesional_email);
  console.log('   fecha recibida:', fecha);
  console.log('   hora_inicio:', hora_inicio);
  console.log('   hora_fin:', hora_fin);
  console.log('   googleEventIdExcluir:', googleEventIdExcluir || '(ninguno)');

  // Guard: sin email
  if (!profesional_email) {
    console.warn('⚠️ [FB-1] DETENIDO: sin email');
    return { disponible: true, conflicto: null };
  }
  console.log('✅ [FB-1] Email verificado');

  // Guard: sin credenciales
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.warn('⚠️ [FB-2] DETENIDO: sin credenciales en', CREDENTIALS_PATH);
    return { disponible: true, conflicto: null };
  }
  console.log('✅ [FB-2] Credenciales encontradas');

  // Construir timestamps
  const timeMin = construirDatetime(fecha, hora_inicio);
  const timeMax = construirDatetime(fecha, hora_fin);
  console.log('✅ [FB-3] Timestamps construidos:');
  console.log('   timeMin:', timeMin);
  console.log('   timeMax:', timeMax);

  if (!timeMin || !timeMax) {
    console.warn('⚠️ [FB-3] DETENIDO: fechas inválidas');
    return { disponible: true, conflicto: null };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES
    });
    console.log('✅ [FB-4] Auth creado');

    const calendar = google.calendar({ version: 'v3', auth });

    // ── ESTRATEGIA: events.list con ventana ampliada ─────────────────
    // Usamos events.list en lugar de freebusy porque el permiso actual
    // ("Hacer cambios y gestionar uso compartido") permite leer eventos
    // pero no siempre expone free/busy. Con events.list calculamos el
    // solapamiento nosotros mismos.
    //
    // Ventana: desde 12h antes hasta 12h después del horario solicitado
    // para capturar eventos que empiecen antes y terminen dentro del bloque.
    const tMin = new Date(timeMin).getTime();
    const tMax = new Date(timeMax).getTime();

    const busquedaMin = new Date(tMin - 12 * 60 * 60 * 1000).toISOString();
    const busquedaMax = new Date(tMax + 12 * 60 * 60 * 1000).toISOString();

    console.log('📡 [FB-5] Llamando events.list...');
    console.log('   calendarId:', profesional_email);
    console.log('   busquedaMin:', busquedaMin);
    console.log('   busquedaMax:', busquedaMax);

    const evResponse = await calendar.events.list({
      calendarId:   profesional_email,
      timeMin:      busquedaMin,
      timeMax:      busquedaMax,
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   50
    });

    const eventos = evResponse.data.items || [];
    console.log(`✅ [FB-5] events.list encontró ${eventos.length} evento(s) en ventana ampliada:`);
    eventos.forEach((ev, i) => {
      console.log(`   [${i}] id:"${ev.id}" | title:"${ev.summary}" | status:${ev.status}`);
      console.log(`        start: ${ev.start?.dateTime || ev.start?.date}`);
      console.log(`        end:   ${ev.end?.dateTime   || ev.end?.date}`);
    });

    // ── DETECTAR SOLAPAMIENTO REAL ────────────────────────────────────
    const formatHora = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      let h = d.getHours(), m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
    };

    for (const ev of eventos) {
      if (ev.status === 'cancelled') { console.log(`   Saltando cancelado: ${ev.id}`); continue; }
      if (googleEventIdExcluir && ev.id === googleEventIdExcluir) {
        console.log(`   Saltando evento propio: ${ev.id}`);
        continue;
      }

      const evStart = new Date(ev.start?.dateTime || ev.start?.date + 'T00:00:00').getTime();
      const evEnd   = new Date(ev.end?.dateTime   || ev.end?.date   + 'T23:59:59').getTime();

      // Solapamiento: el evento toca el bloque solicitado de alguna forma
      const solapa = evStart < tMax && evEnd > tMin;

      console.log(`   Revisando "${ev.summary}": evStart=${evStart} evEnd=${evEnd} tMin=${tMin} tMax=${tMax} → solapa=${solapa}`);

      if (solapa) {
        const conflicto = {
          titulo: ev.summary || 'Evento sin título',
          inicio: formatHora(ev.start?.dateTime || ev.start?.date),
          fin:    formatHora(ev.end?.dateTime   || ev.end?.date)
        };
        console.warn(`🚫 [FB-6] Conflicto encontrado: "${conflicto.titulo}" ${conflicto.inicio} - ${conflicto.fin}`);
        return { disponible: false, conflicto };
      }
    }

    console.log('✅ [FB-6] Horario LIBRE — no hay conflictos');
    return { disponible: true, conflicto: null };

  } catch (error) {
    console.error('❌ [FB-ERROR] Error en freebusy:', error.message);
    console.error('   Código:', error.code);
    console.error('   Stack:', error.stack?.split('\n').slice(0,3).join('\n'));
    return { disponible: true, conflicto: null };
  }
}