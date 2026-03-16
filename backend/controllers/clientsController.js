// backend/controllers/clientsController.js
const clientModel = require("../models/clientModel");

// Crear nuevo cliente
exports.createClient = async (req, res) => {
  try {
    const {
      cedula,
      nombre,
      vinculo,
      cedula_trabajador, // ✅ NUEVO: Cédula del trabajador
      nombre_trabajador, // ✅ NUEVO: Nombre del trabajador
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
      modalidad,
      sexo,
      cargo,
      fecha_nacimiento,
      direccion,
      estado_civil,
      fecha_ingreso,
    } = req.body;

    // Validaciones básicas
    if (!cedula || !nombre) {
      return res.status(400).json({ message: "Cédula y nombre son requeridos" });
    }

    // ✅ NUEVO: Validar que la modalidad sea válida
    if (!modalidad) {
      return res.status(400).json({ message: "La modalidad es requerida" });
    }

    const modalidadesValidas = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];
    if (!modalidadesValidas.includes(modalidad)) {
      return res.status(400).json({ message: "Modalidad no válida" });
    }

    // ✅ NUEVA VALIDACIÓN: Si es Familiar Trabajador, validar campos adicionales
    if (vinculo === 'Familiar Trabajador') {
      if (!cedula_trabajador || !nombre_trabajador) {
        return res.status(400).json({ 
          message: 'Para Familiar Trabajador debe proporcionar cédula y nombre del trabajador' 
        });
      }

      // Validar formato de cédula del trabajador
      if (!/^\d+$/.test(cedula_trabajador)) {
        return res.status(400).json({ 
          message: 'La cédula del trabajador debe contener solo números' 
        });
      }

      // Validar formato de nombre del trabajador
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ'\s]+$/.test(nombre_trabajador)) {
        return res.status(400).json({ 
          message: 'El nombre del trabajador solo debe contener letras' 
        });
      }
    }

    // Sexo y cargo son opcionales en ambas modalidades (requeridos solo en SVE por el frontend)

    // Obtener el ID del profesional del token JWT
    const profesional_id = req.user?.id;

    if (!profesional_id) {
      return res.status(401).json({ message: "No se pudo identificar al profesional" });
    }

    const newClient = await clientModel.createClient({
      cedula,
      nombre,
      vinculo: vinculo || null,
      cedula_trabajador: vinculo === 'Familiar Trabajador' ? cedula_trabajador : null, // ✅ NUEVO
      nombre_trabajador: vinculo === 'Familiar Trabajador' ? nombre_trabajador : null, // ✅ NUEVO
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
      modalidad,
      sexo:             sexo             || null,
      cargo:            cargo            || null,
      fecha_nacimiento: fecha_nacimiento || null,
      direccion:        direccion        || null,
      estado_civil:     estado_civil     || null,
      fecha_ingreso:    fecha_ingreso    || null,
    });

    res.status(201).json(newClient);
  } catch (err) {
    console.error("Error creando cliente:", err);

    // ✅ Error 23505: violación de unicidad en PostgreSQL (cédula duplicada)
    if (err.code === '23505' && err.constraint === 'clients_cedula_key') {
      return res.status(409).json({ 
        message: "Este trabajador ya fue registrado por otro profesional." 
      });
    }

    res.status(500).json({ message: "Error al crear cliente" });
  }
};

// ✅ ACTUALIZADO: Obtener clientes (con filtro de modalidad para profesionales)
exports.getClients = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;
    
    // ✅ Obtener TODOS los filtros de la query
    const { modalidad, profesional_id, año, mes } = req.query;
    
    console.log('🔍 Filtros recibidos:', { modalidad, profesional_id, año, mes, userRole });

    let clients;

    // Si es admin, ver todos los clientes (puede filtrar por modalidad y profesional)
    if (userRole === 'admin') {
      // ✅ Si hay filtro de profesional específico
      if (profesional_id) {
        console.log(`📊 Admin filtrando por profesional ID: ${profesional_id}`);
        
        if (!modalidad) {
          return res.status(400).json({ 
            message: "Se requiere modalidad cuando se filtra por profesional" 
          });
        }
        
        // Filtrar por profesional Y modalidad
        clients = await clientModel.getClientsByProfesionalAndModalidad(
          parseInt(profesional_id), 
          modalidad
        );
      } 
      // Si solo hay filtro de modalidad
      else if (modalidad) {
        console.log(`📊 Admin filtrando solo por modalidad: ${modalidad}`);
        clients = await clientModel.getClientsWithFilters({ modalidad });
      } 
      // Admin viendo todos
      else {
        console.log(`📊 Admin viendo TODOS los clientes`);
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
      
      console.log(`👤 Profesional ${userId} filtrando por modalidad: ${modalidad}`);
      
      // ✅ Filtrar por profesional Y modalidad
      clients = await clientModel.getClientsByProfesionalAndModalidad(userId, modalidad);
    }
    else {
      return res.status(403).json({ message: "No tienes permisos para ver clientes" });
    }

    // ✅ NUEVO: FILTRO ADICIONAL POR AÑO (si se especifica)
    if (año) {
      clients = clients.filter(client => {
        if (!client.created_at) return false;
        
        const fechaCreacion = new Date(client.created_at);
        const añoCreacion = fechaCreacion.getFullYear();
        
        return añoCreacion === parseInt(año);
      });
      console.log(`📅 Después de filtrar por año ${año}:`, clients.length);
    }
    
    // ✅ NUEVO: FILTRO ADICIONAL POR MES (si se especifica)
    if (mes) {
      clients = clients.filter(client => {
        if (!client.created_at) return false;
        
        const fechaCreacion = new Date(client.created_at);
        const mesCreacion = fechaCreacion.getMonth() + 1; // getMonth() devuelve 0-11
        
        return mesCreacion === parseInt(mes);
      });
      console.log(`📆 Después de filtrar por mes ${mes}:`, clients.length);
    }

    console.log(`✅ Total de clientes retornados: ${clients.length}`);
    res.json(clients);
    
  } catch (err) {
    console.error("❌ Error obteniendo clientes:", err);
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

// ✅ ACTUALIZADO: Actualizar cliente (CON CAMPOS DE FAMILIAR TRABAJADOR Y SVE)
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cedula,
      nombre,
      vinculo,
      cedula_trabajador,
      nombre_trabajador,
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
      modalidad,
      sexo,
      cargo,
      fecha_nacimiento,
      direccion,
      estado_civil,
      fecha_ingreso,
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
    const modalidadFinal = modalidad || existingClient.modalidad;
    if (modalidadFinal) {
      const modalidadesValidas = ['Orientación Psicosocial', 'Sistema de Vigilancia Epidemiológica'];
      if (!modalidadesValidas.includes(modalidadFinal)) {
        return res.status(400).json({ message: "Modalidad no válida" });
      }
    }

    // Sexo y cargo son opcionales en ambas modalidades (requeridos solo en SVE por el frontend)

    // ✅ NUEVA VALIDACIÓN: Si es Familiar Trabajador, validar campos adicionales
    if (vinculo === 'Familiar Trabajador') {
      if (!cedula_trabajador || !nombre_trabajador) {
        return res.status(400).json({ 
          message: 'Para Familiar Trabajador debe proporcionar cédula y nombre del trabajador' 
        });
      }

      // Validar formato de cédula del trabajador
      if (!/^\d+$/.test(cedula_trabajador)) {
        return res.status(400).json({ 
          message: 'La cédula del trabajador debe contener solo números' 
        });
      }

      // Validar formato de nombre del trabajador
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ'\s]+$/.test(nombre_trabajador)) {
        return res.status(400).json({ 
          message: 'El nombre del trabajador solo debe contener letras' 
        });
      }
    }

    const updatedClient = await clientModel.updateClient(id, {
      cedula,
      nombre,
      vinculo: vinculo || null,
      cedula_trabajador: vinculo === 'Familiar Trabajador' ? cedula_trabajador : null,
      nombre_trabajador: vinculo === 'Familiar Trabajador' ? nombre_trabajador : null,
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
      modalidad:        modalidadFinal,
      sexo:             sexo             || null,
      cargo:            cargo            || null,
      fecha_nacimiento: fecha_nacimiento || null,
      direccion:        direccion        || null,
      estado_civil:     estado_civil     || null,
      fecha_ingreso:    fecha_ingreso    || null,
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
// ============================================
// ⭐ NUEVAS FUNCIONES PARA DOCUMENTOS
// ============================================

// Subir documento del cliente
exports.uploadDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: "No se proporcionó ningún archivo" });
    }
    
    // Validar tipo de documento
    const tiposValidos = ['consentimiento', 'historia', 'adicionales'];
    if (!tiposValidos.includes(tipo)) {
      // Eliminar archivo subido si el tipo no es válido
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Tipo de documento inválido" });
    }
    
    // Construir ruta del archivo relativa
    const rutaArchivo = `uploads/consultas/${req.file.filename}`;
    
    // Mapear tipo a campo de base de datos
    const campoDocumento = {
      'consentimiento': 'consentimiento_informado',
      'historia': 'historia_clinica',
      'adicionales': 'documentos_adicionales'
    }[tipo];
    
    // Obtener el cliente para verificar si ya tiene un documento anterior
    const clientModel = require("../models/clientModel");
    const clienteAnterior = await clientModel.getClientById(id);
    
    if (!clienteAnterior) {
      // Eliminar archivo subido si el cliente no existe
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    
    // Verificar permisos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && clienteAnterior.profesional_id !== userId) {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "No tienes permiso para modificar este cliente" });
    }
    
    // Si ya tenía un documento anterior, eliminarlo
    const documentoAnterior = clienteAnterior[campoDocumento];
    if (documentoAnterior) {
      const fs = require('fs');
      const path = require('path');
      const rutaAnteriorCompleta = path.join(__dirname, '..', documentoAnterior);
      if (fs.existsSync(rutaAnteriorCompleta)) {
        try {
          fs.unlinkSync(rutaAnteriorCompleta);
          console.log(`✅ Documento anterior eliminado: ${documentoAnterior}`);
        } catch (err) {
          console.error(`⚠️ Error al eliminar documento anterior: ${err.message}`);
        }
      }
    }
    
    // Actualizar en la base de datos
    const clienteActualizado = await clientModel.updateDocumento(id, campoDocumento, rutaArchivo);
    
    res.json({
      message: "Documento subido correctamente",
      [campoDocumento]: rutaArchivo,
      filename: req.file.filename
    });
    
  } catch (err) {
    console.error("Error subiendo documento:", err);
    
    // Eliminar archivo subido en caso de error
    if (req.file) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    res.status(500).json({ message: "Error al subir documento" });
  }
};

// Obtener documentos del cliente
exports.getDocumentos = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientModel = require("../models/clientModel");
    const cliente = await clientModel.getClientById(id);
    
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    
    // Verificar permisos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver los documentos de este cliente" });
    }
    
    res.json({
      consentimiento_informado: cliente.consentimiento_informado,
      historia_clinica: cliente.historia_clinica,
      documentos_adicionales: cliente.documentos_adicionales
    });
    
  } catch (err) {
    console.error("Error obteniendo documentos:", err);
    res.status(500).json({ message: "Error al obtener documentos" });
  }
};

// Eliminar documento del cliente
exports.deleteDocumento = async (req, res) => {
  try {
    const { id, tipo } = req.params;
    
    // Validar tipo de documento
    const tiposValidos = ['consentimiento', 'historia', 'adicionales'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ message: "Tipo de documento inválido" });
    }
    
    // Mapear tipo a campo de base de datos
    const campoDocumento = {
      'consentimiento': 'consentimiento_informado',
      'historia': 'historia_clinica',
      'adicionales': 'documentos_adicionales'
    }[tipo];
    
    // Obtener la ruta del documento antes de eliminarlo
    const clientModel = require("../models/clientModel");
    const cliente = await clientModel.getClientById(id);
    
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    
    // Verificar permisos
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para modificar este cliente" });
    }
    
    const rutaDocumento = cliente[campoDocumento];
    
    // Eliminar archivo físico si existe
    if (rutaDocumento) {
      const fs = require('fs');
      const path = require('path');
      const rutaCompleta = path.join(__dirname, '..', rutaDocumento);
      
      if (fs.existsSync(rutaCompleta)) {
        try {
          fs.unlinkSync(rutaCompleta);
          console.log(`✅ Archivo eliminado: ${rutaDocumento}`);
        } catch (err) {
          console.error(`⚠️ Error al eliminar archivo: ${err.message}`);
        }
      }
    }
    
    // Actualizar en la base de datos (establecer a NULL)
    await clientModel.updateDocumento(id, campoDocumento, null);
    
    res.json({ 
      message: "Documento eliminado correctamente",
      tipo: tipo 
    });
    
  } catch (err) {
    console.error("Error eliminando documento:", err);
    res.status(500).json({ message: "Error al eliminar documento" });
  }
};
// ============================================================
// ⭐ NUEVAS FUNCIONES: ANTECEDENTES DE SALUD
// ============================================================

const pool = require("../config/db");

// GET /api/clients/:clienteId/antecedentes
exports.getAntecedentes = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const result = await pool.query(
      `SELECT * FROM antecedentes_salud
       WHERE client_id = $1
       ORDER BY created_at DESC`,
      [clienteId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error obteniendo antecedentes:", err);
    res.status(500).json({ message: "Error al obtener antecedentes" });
  }
};

// POST /api/clients/:clienteId/antecedentes
exports.createAntecedente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { tipo_antecedente, detalle } = req.body;

    if (!tipo_antecedente || !detalle) {
      return res.status(400).json({ message: "Tipo y detalle son requeridos" });
    }

    const result = await pool.query(
      `INSERT INTO antecedentes_salud (client_id, tipo_antecedente, detalle)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [clienteId, tipo_antecedente, detalle]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creando antecedente:", err);
    res.status(500).json({ message: "Error al crear antecedente" });
  }
};

// PUT /api/clients/:clienteId/antecedentes/:id
exports.updateAntecedente = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_antecedente, detalle } = req.body;

    const result = await pool.query(
      `UPDATE antecedentes_salud
       SET tipo_antecedente = $1, detalle = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [tipo_antecedente, detalle, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Antecedente no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error actualizando antecedente:", err);
    res.status(500).json({ message: "Error al actualizar antecedente" });
  }
};

// DELETE /api/clients/:clienteId/antecedentes/:id
exports.deleteAntecedente = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM antecedentes_salud WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Antecedente no encontrado" });
    }
    res.json({ message: "Antecedente eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando antecedente:", err);
    res.status(500).json({ message: "Error al eliminar antecedente" });
  }
};