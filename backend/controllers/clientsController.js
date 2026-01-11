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
      subcontratista_id,
      email,
      telefono,
      contacto_emergencia_nombre,
      contacto_emergencia_parentesco,
      contacto_emergencia_telefono,
      modalidad, // ✅ NUEVO: Campo modalidad
    } = req.body;

    // Validaciones básicas
    if (!cedula || !nombre) {
      return res.status(400).json({ message: "Cédula y nombre son requeridos" });
    }

    // ✅ NUEVO: Validar que la modalidad sea válidas
    if (!modalidad) {
      return res.status(400).json({ message: "La modalidad es requerida" });
    }

    const modalidadesValidas = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];
    if (!modalidadesValidas.includes(modalidad)) {
      return res.status(400).json({ message: "Modalidad no válida" });
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
      subcontratista_id: subcontratista_id || null,
      email: email || null,
      telefono: telefono || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      profesional_id,
      modalidad, // ✅ NUEVO: Guardar modalidad
    });

    res.status(201).json(newClient);
  } catch (err) {
    console.error("Error creando cliente:", err);
    res.status(500).json({ message: "Error al crear cliente" });
  }
};

// ✅ ACTUALIZADO: Obtener clientes (con filtro de modalidad para profesionales)
exports.getClients = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;
    const { modalidad } = req.query; // ✅ NUEVO: Recibir modalidad desde query params

    let clients;

    // Si es admin, ver todos los clientes (puede filtrar por modalidad opcionalmente)
    if (userRole === 'admin') {
      if (modalidad) {
        // Admin filtrando por modalidad
        clients = await clientModel.getClientsWithFilters({ modalidad });
      } else {
        // Admin viendo todos
        clients = await clientModel.getClients();
      }
    } 
    // Si es profesional, ver solo sus clientes (DEBE filtrar por modalidad)
    else if (userRole === 'profesional') {
      if (!modalidad) {
        return res.status(400).json({ 
          message: "Los profesionales deben especificar una modalidad" 
        });
      }
      
      // ✅ NUEVO: Filtrar por profesional Y modalidad
      clients = await clientModel.getClientsByProfesionalAndModalidad(userId, modalidad);
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

// Obtener clientes con filtros avanzados (profesional, modalidad y fechas)
exports.getClientsWithFilters = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    // Solo admin puede usar estos filtros
    if (userRole !== 'admin') {
      return res.status(403).json({ message: "No tienes permisos para usar estos filtros" });
    }

    const { profesional_id, modalidad, fecha_inicio, fecha_fin } = req.query;

    const clients = await clientModel.getClientsWithFilters({
      profesional_id: profesional_id || null,
      modalidad: modalidad || null, // ✅ NUEVO: Filtro de modalidad
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null
    });

    res.json(clients);
  } catch (err) {
    console.error("Error obteniendo clientes con filtros:", err);
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

// ✅ ACTUALIZADO: Actualizar cliente (CON CAMPO MODALIDAD)
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

    // ✅ NUEVO: Validar modalidad si se proporciona
    if (modalidad) {
      const modalidadesValidas = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];
      if (!modalidadesValidas.includes(modalidad)) {
        return res.status(400).json({ message: "Modalidad no válida" });
      }
    }

    const updatedClient = await clientModel.updateClient(id, {
      cedula,
      nombre,
      vinculo: vinculo || null,
      sede: sede || null,
      tipo_entidad_pagadora: tipo_entidad_pagadora || null,
      entidad_pagadora_especifica: entidad_pagadora_especifica || null,
      empresa_id: empresa_id || null,
      subcontratista_id: subcontratista_id || null,
      email: email || null,
      telefono: telefono || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_parentesco: contacto_emergencia_parentesco || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      fecha_cierre: fecha_cierre || null,
      recomendaciones_finales: recomendaciones_finales || null,
      consultas_sugeridas: consultas_sugeridas || null,
      fecha_cierre_sve: fecha_cierre_sve || null,
      recomendaciones_finales_sve: recomendaciones_finales_sve || null,
      modalidad: modalidad || existingClient.modalidad // ✅ NUEVO: Mantener modalidad existente si no se proporciona
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