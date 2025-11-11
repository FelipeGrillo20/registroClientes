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
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
  } = data;

  const result = await pool.query(
    `INSERT INTO clients 
    (cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica, 
     empresa_id, actividad, modalidad, fecha, columna1, estado, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, actividad, modalidad, fecha, columna1, estado, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono]
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
      e.cliente_final
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    ORDER BY c.id DESC
  `);
  return result.rows;
};

// Obtener cliente por ID con información de empresa
exports.getClientById = async (id) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
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
    actividad,
    modalidad,
    fecha,
    columna1,
    estado,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
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
      actividad = $8,
      modalidad = $9,
      fecha = $10,
      columna1 = $11,
      estado = $12,
      email = $13,
      telefono = $14,
      contacto_emergencia_nombre = $15,
      contacto_emergencia_parentesco = $16,
      contacto_emergencia_telefono = $17
    WHERE id = $18
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, actividad, modalidad, fecha, columna1, estado, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono, id]
  );

  return result.rows[0];
};

// Eliminar cliente
exports.deleteClient = async (id) => {
  const result = await pool.query("DELETE FROM clients WHERE id = $1 RETURNING *", [id]);
  return result.rows[0];
};