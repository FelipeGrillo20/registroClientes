// backend/scripts/changeUserRole.js
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

async function changeUserRole() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              CAMBIAR ROL DE USUARIO                            ║');
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
      const rolEmoji = user.rol === 'admin' ? '👑' : '👤';
      const estado = user.activo ? '✅' : '❌';
      
      console.log(`${index + 1}. ${rolEmoji} ${user.nombre} (${user.cedula})`);
      console.log(`   📧 ${user.email}`);
      console.log(`   👔 Rol actual: ${user.rol} | Estado: ${estado}`);
      console.log('─'.repeat(120));
    });

    // Solicitar cédula del usuario
    const cedula = await question('\n📝 Ingrese la cédula del usuario: ');

    const userToUpdate = result.rows.find(u => u.cedula === cedula.trim());

    if (!userToUpdate) {
      console.log('\n❌ Error: No se encontró un usuario con esa cédula\n');
      rl.close();
      process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    USUARIO SELECCIONADO                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`👤 Nombre:           ${userToUpdate.nombre}`);
    console.log(`📝 Cédula:           ${userToUpdate.cedula}`);
    console.log(`📧 Email:            ${userToUpdate.email}`);
    console.log(`👔 Rol actual:       ${userToUpdate.rol}`);

    // Mostrar opciones de rol
    console.log('\n📋 Roles disponibles:');
    console.log('   1. admin          👑 (Administrador - Acceso total)');
    console.log('   2. profesional    👤 (Profesional - Acceso estándar)');
    
    const rolOpcion = await question('\nSeleccione nuevo rol (1 o 2): ');
    
    let nuevoRol;
    if (rolOpcion === '1') {
      nuevoRol = 'admin';
    } else if (rolOpcion === '2') {
      nuevoRol = 'profesional';
    } else {
      console.log('\n❌ Error: Opción inválida\n');
      rl.close();
      process.exit(1);
    }

    // Verificar si el rol es el mismo
    if (nuevoRol === userToUpdate.rol) {
      console.log(`\n⚠️  El usuario ya tiene el rol "${nuevoRol}"\n`);
      rl.close();
      process.exit(0);
    }

    // Confirmar cambio
    const rolEmoji = nuevoRol === 'admin' ? '👑' : '👤';
    console.log(`\n${rolEmoji} Nuevo rol seleccionado: ${nuevoRol}`);
    
    const confirmar = await question('\n¿Confirmar cambio de rol? (si/no): ');
    
    if (confirmar.toLowerCase() !== 'si' && confirmar.toLowerCase() !== 's') {
      console.log('\n❌ Operación cancelada\n');
      rl.close();
      process.exit(0);
    }

    // Actualizar rol en la base de datos
    await pool.query(
      'UPDATE users SET rol = $1 WHERE id = $2',
      [nuevoRol, userToUpdate.id]
    );

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ ROL ACTUALIZADO EXITOSAMENTE                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`👤 Usuario:          ${userToUpdate.nombre}`);
    console.log(`📝 Cédula:           ${userToUpdate.cedula}`);
    console.log(`👔 Rol anterior:     ${userToUpdate.rol}`);
    console.log(`${rolEmoji} Rol nuevo:        ${nuevoRol}`);
    
    if (nuevoRol === 'admin') {
      console.log('\n🎉 Este usuario ahora tiene acceso completo de administrador');
      console.log('✨ Podrá gestionar otros usuarios desde su perfil\n');
    } else {
      console.log('\n📌 Este usuario ahora tiene acceso estándar de profesional\n');
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
  
  changeUserRole();
});