// backend/scripts/createAdmin.js
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function createAdminUser() {
  try {
    console.log('🔧 Iniciando creación de usuario administrador...');

    // Datos del admin
    const cedula = '1075214111'; // Cámbialo por tu cédula
    const nombre = 'Felipe Murillo';
    const email = 'admin@ejemplo.com';
    const password = 'admin123'; // Contraseña inicial
    const rol = 'admin';

    // Verificar si ya existe
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE cedula = $1',
      [cedula]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  El usuario administrador ya existe');
      console.log('Cédula:', cedula);
      console.log('Email:', email);
      process.exit(0);
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await pool.query(
      `INSERT INTO users (cedula, nombre, email, password, rol, activo) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, cedula, nombre, email, rol`,
      [cedula, nombre, email, hashedPassword, rol, true]
    );

    console.log('✅ Usuario administrador creado exitosamente!');
    console.log('📋 Datos de acceso:');
    console.log('   Cédula:', cedula);
    console.log('   Contraseña:', password);
    console.log('   Email:', email);
    console.log('   Rol:', rol);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
    process.exit(1);
  }
}

createAdminUser();