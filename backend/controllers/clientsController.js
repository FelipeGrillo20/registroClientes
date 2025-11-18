// backend/controllers/clientsController.js
const clientModel = require("../models/clientModel");

// Crear nuevo cliente
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
      email,
      telefono,
      contacto_emergencia_nombre,
      contacto_emergencia_parentesco,
      contacto_emergencia_telefono,
    } = req.body;

    // Validaciones básicas
    if (!cedula || !nombre) {
      return res.status(400).json({ message: "Cédula y nombre son requeridos" });
    }

    // Obtener el ID del profesional del token JWT
    const profesional_id = req.user?.id;

    if (!profesional_id) {
      return res.status(401).json({ message: "No se pudo identificar al profesional" });
    }

    const newClient = await clientModel.createClient({
      cedula,
      nombre,
      vinculo: vinculo || null,
      sede: sede || null,
      tipo_entidad_pagadora: tipo_entidad_pagadora || null,
      entidad_pagadora_especifica: entidad_pagadora_especifica || null,
      empresa_id: empresa_id || null,
      email: email || null,
      telefono: telefono || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      profesional_id,
    });

    res.status(201).json(newClient);
  } catch (err) {
    console.error("Error creando cliente:", err);
    res.status(500).json({ message: "Error al crear cliente" });
  }
};

// Obtener todos los clientes
exports.getClients = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    let clients;

    // Si es admin, ver todos los clientes
    if (userRole === 'admin') {
      clients = await clientModel.getClients();
    } 
    // Si es profesional, ver solo sus clientes
    else if (userRole === 'profesional') {
      clients = await clientModel.getClientsByProfesional(userId);
    }
    else {
      return res.status(403).json({ message: "No tienes permisos para ver clientes" });
    }

    res.json(clients);
  } catch (err) {
    console.error("Error obteniendo clientes:", err);
    res.status(500).json({ message: "Error al obtener clientes" });
  }
};

// Obtener cliente por ID
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await clientModel.getClientById(id);

    if (!client) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos: admin puede ver todos, profesional solo los suyos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && client.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver este cliente" });
    }

    res.json(client);
  } catch (err) {
    console.error("Error obteniendo cliente:", err);
    res.status(500).json({ message: "Error al obtener cliente" });
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
      email,
      telefono,
      contacto_emergencia_nombre,
      contacto_emergencia_parentesco,
      contacto_emergencia_telefono,
      fecha_cierre, // ⭐ AGREGAR fecha_cierre
    } = req.body;

    // Verificar que el cliente existe
    const existingClient = await clientModel.getClientById(id);
    if (!existingClient) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos: admin puede editar todos, profesional solo los suyos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && existingClient.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para editar este cliente" });
    }

    // Validaciones básicas
    if (!cedula || !nombre) {
      return res.status(400).json({ message: "Cédula y nombre son requeridos" });
    }

    const updatedClient = await clientModel.updateClient(id, {
      cedula,
      nombre,
      vinculo: vinculo || null,
      sede: sede || null,
      tipo_entidad_pagadora: tipo_entidad_pagadora || null,
      entidad_pagadora_especifica: entidad_pagadora_especifica || null,
      empresa_id: empresa_id || null,
      email: email || null,
      telefono: telefono || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      fecha_cierre: fecha_cierre || null, // ⭐ AGREGAR fecha_cierre
    });

    res.json(updatedClient);
  } catch (err) {
    console.error("Error actualizando cliente:", err);
    res.status(500).json({ message: "Error al actualizar cliente" });
  }
};

// Eliminar cliente
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el cliente existe
    const existingClient = await clientModel.getClientById(id);
    if (!existingClient) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos: admin puede eliminar todos, profesional solo los suyos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && existingClient.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este cliente" });
    }

    const deletedClient = await clientModel.deleteClient(id);
    res.json({ 
      message: "Cliente eliminado correctamente", 
      client: deletedClient 
    });
  } catch (err) {
    console.error("Error eliminando cliente:", err);
    res.status(500).json({ message: "Error al eliminar cliente" });
  }
};