// backend/models/userModel.js
const pool = require("../config/db");
const bcrypt = require("bcrypt");

// Buscar usuario por cédula
exports.findByCedula = async (cedula) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE cedula = $1 AND activo = true",
    [cedula]
  );
  return result.rows[0];
};

// Buscar usuario por ID
exports.findById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

// Crear nuevo usuario
exports.createUser = async (data) => {
  const { cedula, nombre, email, password, rol } = data;
  
  // Hashear la contraseña
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const result = await pool.query(
    `INSERT INTO users (cedula, nombre, email, password, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, cedula, nombre, email, rol, activo, created_at`,
    [cedula, nombre, email, hashedPassword, rol || 'profesional']
  );

  return result.rows[0];
};

// Verificar contraseña
exports.verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

// Obtener todos los usuarios (sin contraseñas)
exports.getAllUsers = async () => {
  const result = await pool.query(
    "SELECT id, cedula, nombre, email, rol, activo, created_at FROM users ORDER BY id DESC"
  );
  return result.rows;
};

// Desactivar usuario
exports.deactivateUser = async (id) => {
  const result = await pool.query(
    "UPDATE users SET activo = false WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows[0];
};

// ============================================
// ACTUALIZAR CONTRASEÑA
// ============================================
exports.updatePassword = async (userId, newPassword) => {
  // Hashear la nueva contraseña
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  
  const result = await pool.query(
    "UPDATE users SET password = $1 WHERE id = $2 RETURNING id",
    [hashedPassword, userId]
  );
  
  return result.rows[0];
};

// Agregar estos métodos al final de tu userModel.js existente

// Buscar usuario por email
exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return result.rows[0];
};

// Actualizar usuario (sin cambiar contraseña)
exports.updateUser = async (userId, data) => {
  const { nombre, email, rol } = data;
  
  const result = await pool.query(
    `UPDATE users 
     SET nombre = $1, email = $2, rol = $3
     WHERE id = $4
     RETURNING id, cedula, nombre, email, rol, activo, created_at`,
    [nombre, email, rol, userId]
  );
  
  return result.rows[0];
};

// Cambiar estado activo/inactivo
exports.toggleUserStatus = async (userId, newStatus) => {
  const result = await pool.query(
    `UPDATE users 
     SET activo = $1 
     WHERE id = $2
     RETURNING id, cedula, nombre, email, rol, activo, created_at`,
    [newStatus, userId]
  );
  
  return result.rows[0];
};

// Eliminar usuario permanentemente
exports.deleteUser = async (userId) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [userId]
  );
  
  return result.rows[0];
};