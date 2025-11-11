// backend/scripts/generateHash.js
const bcrypt = require('bcrypt');

async function generateHash(password) {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          GENERADOR DE HASH PARA CONTRASEÑA                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log('📝 Contraseña:', password);
    console.log('🔒 Hash generado:', hash);
    
    console.log('\n📋 SQL para actualizar usuario:\n');
    console.log(`UPDATE users SET password = '${hash}' WHERE cedula = '${password}';`);
    
    console.log('\n📋 SQL para crear nuevo usuario:\n');
    console.log(`INSERT INTO users (cedula, nombre, email, password, activo)`);
    console.log(`VALUES ('${password}', 'Usuario Test', 'test@email.com', '${hash}', true);`);
    
    console.log('\n✅ Hash generado exitosamente!\n');
    
  } catch (err) {
    console.error('❌ Error generando hash:', err);
  }
  process.exit(0);
}

// Obtener contraseña del argumento o usar por defecto
const password = process.argv[2] || '123456789';

console.log('Generando hash para contraseña:', password);
generateHash(password);