// backend/config/db.js
const { Pool } = require("pg");

// Configuración que funciona tanto en local como en Render
const pool = new Pool({
  // Si existe DATABASE_URL (Render), úsala. Si no, usa variables individuales (local)
  connectionString: process.env.DATABASE_URL,
  
  // Configuración para local (si no hay DATABASE_URL)
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  
  // SSL requerido para Render (pero opcional para local)
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

// Conectar y mostrar info de conexión
pool.connect()
  .then(client => {
    console.log("✅ Conectado a PostgreSQL");
    console.log(`📊 Base de datos: ${process.env.DB_NAME || "Render PostgreSQL"}`);
    console.log(`🔗 Host: ${process.env.DB_HOST || "Render managed"}`);
    client.release();
  })
  .catch(err => {
    console.error("❌ Error de conexión a la base de datos:");
    console.error(err.message);
    
    // Mostrar ayuda según el tipo de error
    if (err.code === 'ECONNREFUSED') {
      console.error("💡 Verifica que PostgreSQL esté corriendo");
    } else if (err.code === '28P01') {
      console.error("💡 Usuario o contraseña incorrectos");
    } else if (err.code === '3D000') {
      console.error("💡 La base de datos no existe");
    }
  });

// Manejo de errores de pool
pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en el pool de conexiones:', err);
});

module.exports = pool;
