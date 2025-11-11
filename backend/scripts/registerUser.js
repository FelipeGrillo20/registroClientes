// backend/scripts/registerUser.js
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const readline = require('readline');

// Interfaz para leer datos desde la terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para hacer preguntas
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Función para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Función para validar cédula (solo números)
function isValidCedula(cedula) {
  return /^\d+$/.test(cedula);
}

// Función principal para registrar usuario
async function registerUser() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          REGISTRO DE NUEVO USUARIO PROFESIONAL                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // 1. SOLICITAR CÉDULA
    let cedula = await question('📝 Ingrese cédula (solo números): ');
    cedula = cedula.trim();

    if (!cedula) {
      console.log('❌ Error: La cédula es obligatoria\n');
      rl.close();
      process.exit(1);
    }

    if (!isValidCedula(cedula)) {
      console.log('❌ Error: La cédula debe contener solo números\n');
      rl.close();
      process.exit(1);
    }

    // Verificar si la cédula ya existe
    const existingCedula = await pool.query(
      'SELECT id FROM users WHERE cedula = $1',
      [cedula]
    );

    if (existingCedula.rows.length > 0) {
      console.log('❌ Error: Ya existe un usuario con esa cédula\n');
      rl.close();
      process.exit(1);
    }

    // 2. SOLICITAR NOMBRE
    let nombre = await question('👤 Ingrese nombre completo: ');
    nombre = nombre.trim();

    if (!nombre) {
      console.log('❌ Error: El nombre es obligatorio\n');
      rl.close();
      process.exit(1);
    }

    // 3. SOLICITAR EMAIL
    let email = await question('📧 Ingrese email: ');
    email = email.trim().toLowerCase();

    if (!email) {
      console.log('❌ Error: El email es obligatorio\n');
      rl.close();
      process.exit(1);
    }

    if (!isValidEmail(email)) {
      console.log('❌ Error: Email inválido\n');
      rl.close();
      process.exit(1);
    }

    // Verificar si el email ya existe
    const existingEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      console.log('❌ Error: Ya existe un usuario con ese email\n');
      rl.close();
      process.exit(1);
    }

    // 4. SOLICITAR CONTRASEÑA
    let password = await question('🔒 Ingrese contraseña (mínimo 6 caracteres): ');

    if (!password || password.length < 6) {
      console.log('❌ Error: La contraseña debe tener al menos 6 caracteres\n');
      rl.close();
      process.exit(1);
    }

    // 5. CONFIRMAR CONTRASEÑA
    let confirmPassword = await question('🔒 Confirme contraseña: ');

    if (password !== confirmPassword) {
      console.log('❌ Error: Las contraseñas no coinciden\n');
      rl.close();
      process.exit(1);
    }

    // 6. SOLICITAR ROL
    console.log('\n📋 Roles disponibles:');
    console.log('   1. profesional (por defecto)');
    console.log('   2. admin');
    
    let rolOpcion = await question('\nSeleccione rol (1 o 2) [1]: ');
    rolOpcion = rolOpcion.trim() || '1';
    
    const rol = rolOpcion === '2' ? 'admin' : 'profesional';

    // 7. MOSTRAR RESUMEN
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                     RESUMEN DE DATOS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`📝 Cédula:      ${cedula}`);
    console.log(`👤 Nombre:      ${nombre}`);
    console.log(`📧 Email:       ${email}`);
    console.log(`🔒 Contraseña:  ${'*'.repeat(password.length)}`);
    console.log(`👔 Rol:         ${rol}`);

    // 8. CONFIRMAR REGISTRO
    const confirmacion = await question('\n¿Desea registrar este usuario? (si/no): ');

    if (confirmacion.toLowerCase() !== 'si' && confirmacion.toLowerCase() !== 's') {
      console.log('\n❌ Registro cancelado\n');
      rl.close();
      process.exit(0);
    }

    // 9. HASHEAR CONTRASEÑA Y REGISTRAR EN BASE DE DATOS
    console.log('\n⏳ Procesando registro...\n');

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (cedula, nombre, email, password, rol, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, cedula, nombre, email, rol, created_at`,
      [cedula, nombre, email, hashedPassword, rol]
    );

    const newUser = result.rows[0];

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ USUARIO REGISTRADO EXITOSAMENTE                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`🆔 ID:              ${newUser.id}`);
    console.log(`📝 Cédula:          ${newUser.cedula}`);
    console.log(`👤 Nombre:          ${newUser.nombre}`);
    console.log(`📧 Email:           ${newUser.email}`);
    console.log(`👔 Rol:             ${newUser.rol}`);
    console.log(`📅 Fecha creación:  ${new Date(newUser.created_at).toLocaleString('es-CO')}`);
    console.log('\n🎉 El usuario ya puede iniciar sesión en el sistema\n');

    rl.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error fatal al registrar usuario:', err.message);
    console.error('\nDetalles técnicos:', err);
    rl.close();
    process.exit(1);
  }
}

// Ejecutar el script
console.log('🚀 Iniciando script de registro...\n');

// Verificar conexión a la base de datos
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error: No se pudo conectar a la base de datos');
    console.error('Verifica que PostgreSQL esté ejecutándose y la configuración sea correcta\n');
    process.exit(1);
  }
  
  console.log('✅ Conexión a base de datos exitosa\n');
  registerUser();
});