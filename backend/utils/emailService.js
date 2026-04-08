// backend/utils/emailService.js
const nodemailer = require('nodemailer');
const { getMeetLink } = require('../config/meetLinks');

// ── Un solo transporter ──────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'stconsultoresnotificaciones@gmail.com',
    pass: 'rjdw lqyz qocj iere'
  }
});

transporter.verify(function(error) {
  if (error) {
    console.log('❌ Error en configuración de email:', error);
  } else {
    console.log('✅ Servidor de email listo para enviar mensajes');
  }
});

// ============================================================
// UTILIDADES COMPARTIDAS
// ============================================================

function formatearHoraAmPm(hora) {
  const [horas, minutos] = hora.split(':');
  let h = parseInt(horas);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${minutos} ${ampm}`;
}

function formatearFecha(fecha) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(fecha).toLocaleDateString('es-ES', options);
}

function estilosBase() {
  return `
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
    .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .label { font-weight: bold; color: #667eea; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  `;
}

/** Filas de detalle compartidas por todos los templates */
function filasDetalle({ trabajador_nombre, trabajador_cedula, profesional_nombre,
                        horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita }) {
  return `
    <div class="info-row"><span class="label">Trabajador:</span> ${trabajador_nombre} (CC: ${trabajador_cedula})</div>
    <div class="info-row"><span class="label">Profesional:</span> ${profesional_nombre}</div>
    <div class="info-row"><span class="label">Fecha:</span> ${formatearFecha(fecha)}</div>
    <div class="info-row"><span class="label">Hora:</span> ${horaInicioFormateada} - ${horaFinFormateada}</div>
    <div class="info-row"><span class="label">Modalidad:</span> ${modalidad_cita}</div>
  `;
}

/** Bloque del enlace Meet (se omite si no hay enlace configurado) */
function bloqueMeet(meetLink) {
  if (!meetLink) return '';
  return `
    <div class="info-row" style="background-color:#f0fdf4;border-left:4px solid #10b981;padding:12px 16px;border-radius:0 6px 6px 0;">
      <span class="label" style="color:#059669;">🎥 Enlace Meet:</span>
      <a href="${meetLink}" target="_blank"
         style="color:#059669;font-weight:bold;text-decoration:none;word-break:break-all;">
        ${meetLink}
      </a>
    </div>
  `;
}

/** Bloque de botones Confirmar / Cancelar */
function bloqueConfirmacion(id) {
  const base = process.env.BACKEND_URL || 'http://localhost:5000';
  return `
    <div style="margin-top:30px;padding:20px;background-color:#f3f4f6;border-radius:8px;text-align:center;">
      <h3 style="margin-bottom:10px;color:#1f2937;">Confirmar Cita</h3>
      <p style="color:#6b7280;margin-bottom:25px;">¿Desea confirmar su asistencia a esta cita?</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;">
        <tr>
          <td align="center" style="padding:8px;">
            <a href="${base}/api/citas/${id}/confirmar?accion=confirmar"
               style="display:inline-block;padding:12px 24px;
                      background:linear-gradient(135deg,#34d399 0%,#10b981 100%);
                      color:#ffffff!important;text-decoration:none;border-radius:6px;
                      font-weight:bold;font-size:14px;width:140px;text-align:center;">
              ✓ Sí, Confirmar
            </a>
          </td>
          <td align="center" style="padding:8px;">
            <a href="${base}/api/citas/${id}/confirmar?accion=cancelar"
               style="display:inline-block;padding:12px 24px;
                      background:linear-gradient(135deg,#f87171 0%,#ef4444 100%);
                      color:#ffffff!important;text-decoration:none;border-radius:6px;
                      font-weight:bold;font-size:14px;width:140px;text-align:center;">
              ✗ No, Cancelar
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ============================================================
// TEMPLATE 1: Correo interno (stconsultoresnotificaciones)
// Contenido: detalles + Meet + botones Confirmar/Cancelar
// ============================================================
function templateInterno(datos) {
  const { id, trabajador_nombre, trabajador_cedula, profesional_nombre,
          horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita, meetLink } = datos;
  return `<!DOCTYPE html><html><head><style>
    ${estilosBase()}
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>✅ Cita Agendada</h1>
      <p>Se ha registrado una nueva cita en el sistema</p>
    </div>
    <div class="content">
      <h2>Detalles de la Cita</h2>
      ${filasDetalle({ trabajador_nombre, trabajador_cedula, profesional_nombre, horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita })}
      ${bloqueMeet(meetLink)}
      ${bloqueConfirmacion(id)}
    </div>
    <div class="footer">
      <p>Este es un mensaje automático. Por favor no responder.</p>
      <p>ST Consultores © 2026</p>
    </div>
  </div></body></html>`;
}

// ============================================================
// TEMPLATE 2: Correo al profesional asignado
// Destino: campo email de la tabla users
// Contenido: detalles + enlace Meet (sin botones de acción)
// ============================================================
function templateProfesional(datos) {
  const { trabajador_nombre, trabajador_cedula, profesional_nombre,
          horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita, meetLink } = datos;
  return `<!DOCTYPE html><html><head><style>
    ${estilosBase()}
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>📋 Nueva Cita Asignada</h1>
      <p>Tienes una nueva cita programada</p>
    </div>
    <div class="content">
      <p style="color:#374151;">Hola <strong>${profesional_nombre}</strong>,</p>
      <p style="color:#6b7280;">Se ha agendado una nueva cita en el sistema. A continuación los detalles:</p>
      <h2>Detalles de la Cita</h2>
      ${filasDetalle({ trabajador_nombre, trabajador_cedula, profesional_nombre, horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita })}
      ${bloqueMeet(meetLink)}
      <div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:8px;">
        <p style="margin:0;color:#1e40af;font-size:13px;">
          💡 <strong>Recuerda:</strong> El trabajador recibirá su notificación de confirmación por separado.
          Puedes gestionar el estado de la cita desde el sistema de agendamiento.
        </p>
      </div>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático. Por favor no responder.</p>
      <p>ST Consultores © 2026</p>
    </div>
  </div></body></html>`;
}

// ============================================================
// TEMPLATE 3: Correo al trabajador
// Destino: campo email de la tabla clients
// Contenido: detalles + Meet + botones Confirmar/Cancelar
// ============================================================
function templateTrabajador(datos) {
  const { id, trabajador_nombre, trabajador_cedula, profesional_nombre,
          horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita, meetLink } = datos;
  return `<!DOCTYPE html><html><head><style>
    ${estilosBase()}
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>📅 Cita Programada</h1>
      <p>Tu cita ha sido agendada exitosamente</p>
    </div>
    <div class="content">
      <p style="color:#374151;">Hola <strong>${trabajador_nombre}</strong>,</p>
      <p style="color:#6b7280;">
        Nos complace informarte que tu cita de atención ha sido programada.
        A continuación encuentras los detalles y los botones para confirmar o cancelar tu asistencia:
      </p>
      <h2>Detalles de tu Cita</h2>
      ${filasDetalle({ trabajador_nombre, trabajador_cedula, profesional_nombre, horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita })}
      ${bloqueMeet(meetLink)}
      ${bloqueConfirmacion(id)}
    </div>
    <div class="footer">
      <p>Este es un mensaje automático. Por favor no responder.</p>
      <p>ST Consultores © 2026</p>
    </div>
  </div></body></html>`;
}

// ============================================================
// FUNCIÓN PRINCIPAL — Envía los tres correos en paralelo
// ============================================================
async function enviarNotificacionCitaAgendada(citaData) {
  const {
    id,
    trabajador_nombre,
    trabajador_cedula,
    trabajador_email,
    profesional_nombre,
    profesional_id,
    profesional_email,
    fecha,
    hora_inicio,
    hora_fin,
    modalidad_cita
  } = citaData;

  const horaInicioFormateada = formatearHoraAmPm(hora_inicio);
  const horaFinFormateada    = formatearHoraAmPm(hora_fin);
  const meetLink             = getMeetLink(profesional_id);

  const datosComunes = {
    id, trabajador_nombre, trabajador_cedula, profesional_nombre,
    horaInicioFormateada, horaFinFormateada, fecha, modalidad_cita, meetLink
  };

  const FROM = '"ST Consultores - Notificaciones" <stconsultoresnotificaciones@gmail.com>';

  const envios = [

    // 1️⃣  Correo interno — detalles + Meet + botones Confirmar/Cancelar
    transporter.sendMail({
      from: FROM,
      to: 'stconsultoresnotificaciones@gmail.com',
      subject: '📅 Nueva Cita Agendada - ST Consultores',
      html: templateInterno(datosComunes)
    }).then(info => {
      console.log('✅ [Email interno] Enviado:', info.messageId);
      return { destino: 'interno', ok: true };
    }),

    // 2️⃣  Correo al profesional — detalles + Meet (sin botones de acción)
    profesional_email
      ? transporter.sendMail({
          from: FROM,
          to: profesional_email,
          subject: '📋 Nueva Cita Asignada - ST Consultores',
          html: templateProfesional(datosComunes)
        }).then(info => {
          console.log(`✅ [Email profesional] → ${profesional_email}:`, info.messageId);
          return { destino: 'profesional', ok: true };
        })
      : Promise.resolve({ destino: 'profesional', ok: false, razon: 'sin email registrado' }),

    // 3️⃣  Correo al trabajador — detalles + Meet + botones Confirmar/Cancelar
    trabajador_email
      ? transporter.sendMail({
          from: FROM,
          to: trabajador_email,
          subject: '📅 Tu cita ha sido programada - ST Consultores',
          html: templateTrabajador(datosComunes)
        }).then(info => {
          console.log(`✅ [Email trabajador] → ${trabajador_email}:`, info.messageId);
          return { destino: 'trabajador', ok: true };
        })
      : Promise.resolve({ destino: 'trabajador', ok: false, razon: 'sin email registrado' }),

  ];

  // Ejecutar en paralelo — un fallo no cancela los demás
  const resultados = await Promise.allSettled(envios);

  resultados.forEach(r => {
    if (r.status === 'rejected') {
      console.error('⚠️ [Email] Fallo en uno de los envíos:', r.reason);
    }
  });

  return { success: true, resultados };
}

module.exports = { enviarNotificacionCitaAgendada };