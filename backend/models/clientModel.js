// backend/models/clientModel.js
const pool = require("../config/db");

// Crear un nuevo cliente
exports.createClient = async (data) => {
  const {
    cedula,
    nombre,
    vinculo,
    sede,
    tipo_entidad_pagadora,
    entidad_pagadora_especifica,
    empresa_id,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
    profesional_id,
  } = data;

  const result = await pool.query(
    `INSERT INTO clients 
    (cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica, 
     empresa_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     profesional_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     profesional_id]
  );

  return result.rows[0];
};

// Obtener todos los clientes con información de empresa
exports.getClients = async () => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN users u ON c.profesional_id = u.id
    ORDER BY c.id DESC
  `);
  return result.rows;
};

// ⭐ NUEVO: Obtener clientes filtrados por profesional
exports.getClientsByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.profesional_id = $1
    ORDER BY c.id DESC
  `, [profesionalId]);
  return result.rows;
};

// Obtener cliente por ID con información de empresa
exports.getClientById = async (id) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.id = $1
  `, [id]);
  return result.rows[0];
};

// Actualizar cliente
exports.updateClient = async (id, data) => {
  const {
    cedula,
    nombre,
    vinculo,
    sede,
    tipo_entidad_pagadora,
    entidad_pagadora_especifica,
    empresa_id,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
    fecha_cierre,
    recomendaciones_finales, // ⭐ NUEVO
  } = data;

  const result = await pool.query(
    `UPDATE clients SET
      cedula = $1,
      nombre = $2,
      vinculo = $3,
      sede = $4,
      tipo_entidad_pagadora = $5,
      entidad_pagadora_especifica = $6,
      empresa_id = $7,
      email = $8,
      telefono = $9,
      contacto_emergencia_nombre = $10,
      contacto_emergencia_parentesco = $11,
      contacto_emergencia_telefono = $12,
      fecha_cierre = $13,
      recomendaciones_finales = $14
    WHERE id = $15
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     fecha_cierre, recomendaciones_finales, id]
  );

  return result.rows[0];
};

// Eliminar cliente
exports.deleteClient = async (id) => {
  const result = await pool.query("DELETE FROM clients WHERE id = $1 RETURNING *", [id]);
  return result.rows[0];
};