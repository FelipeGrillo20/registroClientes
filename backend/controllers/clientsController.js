// backend/controllers/clientsController.js

const clientModel = require("../models/clientModel");

// Crear un nuevo cliente
exports.createClient = async (req, res) => {
  try {
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
    } = req.body;

    // Validaciones mínimas
    if (!cedula || !nombre || !email || !vinculo || !tipo_entidad_pagadora || !empresa_id) {
      return res.status(400).json({ 
        message: "Cédula, nombre, email, vínculo, entidad pagadora y empresa son requeridos." 
      });
    }

    // ⭐ NUEVO: Obtener el ID del profesional del token JWT
    const profesionalId = req.user.id;

    const newClient = await clientModel.createClient({
      cedula,
      nombre,
      vinculo,
      sede,
      tipo_entidad_pagadora,
      entidad_pagadora_especifica: entidad_pagadora_especifica || null,
      empresa_id,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado,
      email,
      telefono,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      profesional_id: profesionalId, // ← NUEVO: Asignar profesional
    });

    res.status(201).json(newClient);
  } catch (err) {
    console.error("Error creando cliente:", err);
    
    // Verificar si es error de cédula duplicada (PostgreSQL code 23505)
    if (err.code === '23505' && err.constraint && err.constraint.includes('cedula')) {
      return res.status(400).json({ 
        message: "Ya existe un cliente registrado con esa cédula",
        error: "duplicate_cedula" 
      });
    }
    
    // Verificar si es error de email duplicado
    if (err.code === '23505' && err.constraint && err.constraint.includes('email')) {
      return res.status(400).json({ 
        message: "Ya existe un cliente registrado con ese email",
        error: "duplicate_email" 
      });
    }
    
    // Error genérico
    res.status(500).json({ message: "Error al crear cliente." });
  }
};

// ⭐ MODIFICADO: Obtener clientes según el rol del usuario
exports.getClients = async (req, res) => {
  try {
    const userRole = req.user.rol; // Del token JWT
    const userId = req.user.id;    // Del token JWT
    
    let clients;
    
    if (userRole === 'admin') {
      // Admin ve TODOS los clientes
      clients = await clientModel.getClients();
    } else {
      // Profesionales solo ven sus propios clientes
      clients = await clientModel.getClientsByProfesional(userId);
    }
    
    res.json(clients);
  } catch (err) {
    console.error("Error obteniendo clientes:", err);
    res.status(500).json({ message: "Error al obtener clientes." });
  }
};

// Obtener cliente por ID
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await clientModel.getClientById(id);

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    // ⭐ NUEVO: Verificar permisos (profesionales solo ven sus clientes)
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    if (userRole !== 'admin' && client.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permisos para ver este cliente" 
      });
    }

    res.json(client);
  } catch (err) {
    console.error("Error obteniendo cliente:", err);
    res.status(500).json({ message: "Error al obtener cliente." });
  }
};

// Actualizar cliente
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

    // ⭐ NUEVO: Verificar permisos antes de actualizar
    const client = await clientModel.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }
    
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    if (userRole !== 'admin' && client.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permisos para editar este cliente" 
      });
    }

    const updatedClient = await clientModel.updateClient(id, {
      cedula,
      nombre,
      vinculo,
      sede,
      tipo_entidad_pagadora,
      entidad_pagadora_especifica: entidad_pagadora_especifica || null,
      empresa_id,
      actividad,
      modalidad,
      fecha,
      columna1,
      estado,
      email,
      telefono,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
    });

    res.json(updatedClient);
  } catch (err) {
    console.error("Error actualizando cliente:", err);
    
    // Verificar errores de duplicados al actualizar
    if (err.code === '23505' && err.constraint && err.constraint.includes('cedula')) {
      return res.status(400).json({ 
        message: "Ya existe otro cliente con esa cédula",
        error: "duplicate_cedula" 
      });
    }
    
    if (err.code === '23505' && err.constraint && err.constraint.includes('email')) {
      return res.status(400).json({ 
        message: "Ya existe otro cliente con ese email",
        error: "duplicate_email" 
      });
    }
    
    res.status(500).json({ message: "Error al actualizar cliente." });
  }
};

// Eliminar cliente
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ⭐ NUEVO: Verificar permisos antes de eliminar
    const client = await clientModel.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }
    
    const userRole = req.user.rol;
    const userId = req.user.id;
    
    if (userRole !== 'admin' && client.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permisos para eliminar este cliente" 
      });
    }

    const deletedClient = await clientModel.deleteClient(id);

    res.json({ message: "Cliente eliminado correctamente", client: deletedClient });
  } catch (err) {
    console.error("Error eliminando cliente:", err);
    res.status(500).json({ message: "Error al eliminar cliente." });
  }
};