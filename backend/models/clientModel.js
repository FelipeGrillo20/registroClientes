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
    subcontratista_id,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
    profesional_id,
    modalidad, // ✅ NUEVO: Campo modalidad
  } = data;

  const result = await pool.query(
    `INSERT INTO clients 
    (cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica, 
     empresa_id, subcontratista_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     profesional_id, modalidad, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP)
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, subcontratista_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     profesional_id, modalidad]
  );

  return result.rows[0];
};

// Obtener todos los clientes con información de empresa y subcontratista
exports.getClients = async () => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      e.cliente_definitivo,
      s.cliente_final AS subcontratista_nombre,
      s.cliente_definitivo AS subcontratista_definitivo,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN empresas s ON c.subcontratista_id = s.id
    LEFT JOIN users u ON c.profesional_id = u.id
    ORDER BY c.id DESC
  `);
  return result.rows;
};

// ✅ NUEVO: Obtener clientes filtrados por profesional Y modalidad
exports.getClientsByProfesionalAndModalidad = async (profesionalId, modalidad) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      e.cliente_definitivo,
      s.cliente_final AS subcontratista_nombre,
      s.cliente_definitivo AS subcontratista_definitivo,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN empresas s ON c.subcontratista_id = s.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.profesional_id = $1 AND c.modalidad = $2
    ORDER BY c.id DESC
  `, [profesionalId, modalidad]);
  return result.rows;
};

// Obtener clientes filtrados por profesional (SIN filtro de modalidad - para admin)
exports.getClientsByProfesional = async (profesionalId) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      e.cliente_definitivo,
      s.cliente_final AS subcontratista_nombre,
      s.cliente_definitivo AS subcontratista_definitivo,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN empresas s ON c.subcontratista_id = s.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.profesional_id = $1
    ORDER BY c.id DESC
  `, [profesionalId]);
  return result.rows;
};

// ✅ ACTUALIZADO: Obtener clientes con filtros avanzados (profesional, modalidad y fechas)
exports.getClientsWithFilters = async (filters) => {
  const { profesional_id, modalidad, fecha_inicio, fecha_fin } = filters;
  
  let query = `
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      e.cliente_definitivo,
      s.cliente_final AS subcontratista_nombre,
      s.cliente_definitivo AS subcontratista_definitivo,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN empresas s ON c.subcontratista_id = s.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramIndex = 1;
  
  // Filtro por profesional
  if (profesional_id) {
    query += ` AND c.profesional_id = $${paramIndex}`;
    params.push(profesional_id);
    paramIndex++;
  }
  
  // ✅ NUEVO: Filtro por modalidad
  if (modalidad) {
    query += ` AND c.modalidad = $${paramIndex}`;
    params.push(modalidad);
    paramIndex++;
  }
  
  // Filtro por fecha de inicio
  if (fecha_inicio) {
    query += ` AND c.created_at >= $${paramIndex}::timestamp`;
    params.push(fecha_inicio + ' 00:00:00');
    paramIndex++;
  }
  
  // Filtro por fecha de fin
  if (fecha_fin) {
    query += ` AND c.created_at <= $${paramIndex}::timestamp`;
    params.push(fecha_fin + ' 23:59:59');
    paramIndex++;
  }
  
  query += ` ORDER BY c.id DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
};

// Obtener cliente por ID con información de empresa y subcontratista
exports.getClientById = async (id) => {
  const result = await pool.query(`
    SELECT 
      c.*,
      e.tipo_cliente,
      e.nombre_cliente,
      e.cliente_final,
      e.cliente_definitivo,
      s.cliente_final AS subcontratista_nombre,
      s.cliente_definitivo AS subcontratista_definitivo,
      u.nombre AS profesional_nombre
    FROM clients c
    LEFT JOIN empresas e ON c.empresa_id = e.id
    LEFT JOIN empresas s ON c.subcontratista_id = s.id
    LEFT JOIN users u ON c.profesional_id = u.id
    WHERE c.id = $1
  `, [id]);
  return result.rows[0];
};

// ✅ ACTUALIZADO: Actualizar cliente (CON CAMPO MODALIDAD)
exports.updateClient = async (id, data) => {
  const {
    cedula,
    nombre,
    vinculo,
    sede,
    tipo_entidad_pagadora,
    entidad_pagadora_especifica,
    empresa_id,
    subcontratista_id,
    email,
    telefono,
    contacto_emergencia_nombre,
    contacto_emergencia_parentesco,
    contacto_emergencia_telefono,
    fecha_cierre,
    recomendaciones_finales,
    consultas_sugeridas,
    fecha_cierre_sve,
    recomendaciones_finales_sve,
    modalidad // ✅ NUEVO: Campo modalidad
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
      subcontratista_id = $8,
      email = $9,
      telefono = $10,
      contacto_emergencia_nombre = $11,
      contacto_emergencia_parentesco = $12,
      contacto_emergencia_telefono = $13,
      fecha_cierre = $14,
      recomendaciones_finales = $15,
      consultas_sugeridas = $16,
      fecha_cierre_sve = $17,
      recomendaciones_finales_sve = $18,
      modalidad = $19
    WHERE id = $20
    RETURNING *`,
    [cedula, nombre, vinculo, sede, tipo_entidad_pagadora, entidad_pagadora_especifica,
     empresa_id, subcontratista_id, email, telefono,
     contacto_emergencia_nombre, contacto_emergencia_parentesco, contacto_emergencia_telefono,
     fecha_cierre, recomendaciones_finales, consultas_sugeridas,
     fecha_cierre_sve, recomendaciones_finales_sve,
     modalidad, // ✅ NUEVO
     id]
  );

  return result.rows[0];
};

// Eliminar cliente
exports.deleteClient = async (id) => {
  const result = await pool.query("DELETE FROM clients WHERE id = $1 RETURNING *", [id]);
  return result.rows[0];
};