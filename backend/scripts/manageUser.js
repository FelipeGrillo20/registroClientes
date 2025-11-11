// backend/scripts/manageUser.js
const pool = require('../config/db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function manageUser() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║            GESTIÓN DE USUARIOS - ACTIVAR/DESACTIVAR           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Listar usuarios
    const result = await pool.query(
      `SELECT id, cedula, nombre, email, rol, activo 
       FROM users 
       ORDER BY created_at DESC`
    );

    if (result.rows.length === 0) {
      console.log('📭 No hay usuarios registrados\n');
      rl.close();
      process.exit(0);
    }

    console.log('📋 Usuarios disponibles:\n');
    console.log('─'.repeat(120));

    result.rows.forEach((user, index) => {
      const estado = user.activo ? '✅ Activo' : '❌ Inactivo';
      const rolEmoji = user.rol === 'admin' ? '👑' : '👤';
      
      console.log(`${index + 1}. ${rolEmoji} ${user.nombre} (${user.cedula}) - ${estado}`);
      console.log(`   📧 ${user.email} | 🆔 ID: ${user.id}`);
      console.log('─'.repeat(120));
    });

    // Solicitar cédula del usuario a gestionar
    const cedula = await question('\n📝 Ingrese la cédula del usuario a gestionar: ');

    const userToManage = result.rows.find(u => u.cedula === cedula.trim());

    if (!userToManage) {
      console.log('\n❌ Error: No se encontró un usuario con esa cédula\n');
      rl.close();
      process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    USUARIO SELECCIONADO                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`👤 Nombre:      ${userToManage.nombre}`);
    console.log(`📝 Cédula:      ${userToManage.cedula}`);
    console.log(`📧 Email:       ${userToManage.email}`);
    console.log(`👔 Rol:         ${userToManage.rol}`);
    console.log(`📊 Estado:      ${userToManage.activo ? '✅ Activo' : '❌ Inactivo'}`);

    // Determinar acción
    if (userToManage.activo) {
      const confirmar = await question('\n⚠️  ¿Desea DESACTIVAR este usuario? (si/no): ');
      
      if (confirmar.toLowerCase() !== 'si' && confirmar.toLowerCase() !== 's') {
        console.log('\n❌ Operación cancelada\n');
        rl.close();
        process.exit(0);
      }

      await pool.query(
        'UPDATE users SET activo = false WHERE id = $1',
        [userToManage.id]
      );

      console.log('\n✅ Usuario DESACTIVADO exitosamente');
      console.log('🚫 Este usuario ya no podrá iniciar sesión\n');

    } else {
      const confirmar = await question('\n✅ ¿Desea ACTIVAR este usuario? (si/no): ');
      
      if (confirmar.toLowerCase() !== 'si' && confirmar.toLowerCase() !== 's') {
        console.log('\n❌ Operación cancelada\n');
        rl.close();
        process.exit(0);
      }

      await pool.query(
        'UPDATE users SET activo = true WHERE id = $1',
        [userToManage.id]
      );

      console.log('\n✅ Usuario ACTIVADO exitosamente');
      console.log('🎉 Este usuario ya puede iniciar sesión\n');
    }

    rl.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error fatal:', err.message);
    rl.close();
    process.exit(1);
  }
}

// Verificar conexión y ejecutar
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Error: No se pudo conectar a la base de datos\n');
    process.exit(1);
  }
  
  manageUser();
});