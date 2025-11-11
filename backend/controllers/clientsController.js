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

// Obtener todos los clientes
exports.getClients = async (req, res) => {
  try {
    const clients = await clientModel.getClients();
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

    if (!updatedClient) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

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
    const deletedClient = await clientModel.deleteClient(id);

    if (!deletedClient) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    res.json({ message: "Cliente eliminado correctamente", client: deletedClient });
  } catch (err) {
    console.error("Error eliminando cliente:", err);
    res.status(500).json({ message: "Error al eliminar cliente." });
  }
};