// backend/config/meetLinks.js
// ============================================================
// Configuración de enlaces de Google Meet por profesional
//
// CLAVE: ID del usuario en la tabla "users" de la base de datos
// VALOR: Enlace de Google Meet asignado a ese profesional
//
// Para agregar o editar un enlace:
//  1. Busca el ID del profesional en la BD:
//     SELECT id, nombre FROM users WHERE rol = 'profesional';
//  2. Agrega o edita la entrada en este objeto usando ese ID.
//  3. Guarda el archivo y reinicia el servidor.
//
// Nota: los IDs son números enteros. Asegúrate de usar
// el ID correcto del entorno donde estás trabajando
// (local y producción pueden tener IDs distintos).
// ============================================================

const MEET_LINKS = {
  // ── ENTORNO LOCAL ──────────────────────────────────────────
  // Andrés Felipe Buendía  (reemplaza "2" por el ID real en tu BD local)
  40: 'https://meet.google.com/jca-ejwr-tnp',

  // Agrega aquí los demás profesionales de tu entorno local:
  // 3: 'https://meet.google.com/xxx-xxxx-xxx',
  // 4: 'https://meet.google.com/xxx-xxxx-xxx',

  // ── ENTORNO PRODUCCIÓN (Hostinger) ─────────────────────────
  // Copia las mismas entradas pero con los IDs del servidor:
  // 5: 'https://meet.google.com/jca-ejwr-tnp',  // Andrés Felipe Buendía en producción
  4:  'https://meet.google.com/opn-axgr-nrf',
  42: 'https://meet.google.com/mga-xbsq-mhb',
  45: 'https://meet.google.com/yhz-hybz-tqt',
  46: 'https://meet.google.com/vvk-qcxp-uqp',
  48: 'https://meet.google.com/kma-shyr-zkr',
  50: 'https://meet.google.com/hzb-saqu-sqw',
  44: 'https://meet.google.com/ouj-ejxx-mso',
  47: 'https://meet.google.com/jwp-kuwp-vfs',
  49: 'https://meet.google.com/urf-kbgc-eai',
  51: 'https://meet.google.com/hce-brup-jzi',
};

/**
 * Obtener el enlace de Meet de un profesional por su ID.
 * Retorna null si no tiene enlace configurado.
 * @param {number|string} profesionalId
 * @returns {string|null}
 */
function getMeetLink(profesionalId) {
  const id = parseInt(profesionalId);
  return MEET_LINKS[id] || null;
}

module.exports = { getMeetLink };