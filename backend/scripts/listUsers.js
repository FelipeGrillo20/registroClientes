// backend/scripts/listUsers.js
const pool = require('../config/db');

async function listUsers() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              LISTA DE USUARIOS REGISTRADOS                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const result = await pool.query(
      `SELECT id, cedula, nombre, email, rol, activo, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );

    if (result.rows.length === 0) {
      console.log('📭 No hay usuarios registrados\n');
      process.exit(0);
    }

    console.log(`📊 Total de usuarios: ${result.rows.length}\n`);
    console.log('─'.repeat(120));

    result.rows.forEach((user, index) => {
      const estado = user.activo ? '✅ Activo' : '❌ Inactivo';
      const rolEmoji = user.rol === 'admin' ? '👑' : '👤';
      
      console.log(`\n${index + 1}. ${rolEmoji} ${user.nombre}`);
      console.log(`   🆔 ID:        ${user.id}`);
      console.log(`   📝 Cédula:    ${user.cedula}`);
      console.log(`   📧 Email:     ${user.email}`);
      console.log(`   👔 Rol:       ${user.rol}`);
      console.log(`   📊 Estado:    ${estado}`);
      console.log(`   📅 Creado:    ${new Date(user.created_at).toLocaleString('es-CO')}`);
      console.log('─'.repeat(120));
    });

    console.log('\n✅ Listado completado\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error al listar usuarios:', err.message);
    process.exit(1);
  }
}

// Verificar conexión y ejecutar
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error: No se pudo conectar a la base de datos\n');
    process.exit(1);
  }
  
  listUsers();
});