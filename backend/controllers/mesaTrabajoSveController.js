// backend/controllers/mesaTrabajoSveController.js
const mesaTrabajoModel = require("../models/mesaTrabajoSveModel");
const clientModel = require("../models/clientModel");

// Crear nueva Mesa de Trabajo SVE
exports.createMesaTrabajo = async (req, res) => {
  try {
    const {
      cliente_id,
      criterio_inclusion,
      motivo_evaluacion,
      diagnostico,
      codigo_diagnostico
    } = req.body;

    // Validaciones básicas
    if (!cliente_id || !criterio_inclusion || !motivo_evaluacion || !diagnostico || !codigo_diagnostico) {
      return res.status(400).json({ 
        message: "Todos los campos son requeridos" 
      });
    }

    // Verificar que el cliente existe
    const cliente = await clientModel.getClientById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Verificar permisos: admin puede crear para cualquiera, profesional solo para sus clientes
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para crear Mesa de Trabajo para este cliente" 
      });
    }

    // Verificar si ya existe Mesa de Trabajo para este cliente
    const yaExiste = await mesaTrabajoModel.clienteTieneMesaTrabajo(cliente_id);
    if (yaExiste) {
      return res.status(400).json({ 
        message: "Este cliente ya tiene una Mesa de Trabajo registrada. Use PUT para actualizar." 
      });
    }

    const newMesaTrabajo = await mesaTrabajoModel.createMesaTrabajo({
      cliente_id,
      criterio_inclusion,
      motivo_evaluacion,
      diagnostico,
      codigo_diagnostico
    });

    res.status(201).json(newMesaTrabajo);
  } catch (err) {
    console.error("Error creando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al crear Mesa de Trabajo" });
  }
};

// Obtener todas las Mesas de Trabajo
exports.getAllMesasTrabajo = async (req, res) => {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    let mesasTrabajo;

    if (userRole === 'admin') {
      mesasTrabajo = await mesaTrabajoModel.getAllMesasTrabajo();
    } else if (userRole === 'profesional') {
      mesasTrabajo = await mesaTrabajoModel.getMesasTrabajoByProfesional(userId);
    } else {
      return res.status(403).json({ message: "No tienes permisos para ver Mesas de Trabajo" });
    }

    res.json(mesasTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesas de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesas de Trabajo" });
  }
};

// Obtener Mesa de Trabajo por ID de cliente
exports.getMesaTrabajoByClienteId = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const mesaTrabajo = await mesaTrabajoModel.getMesaTrabajoByClienteId(cliente_id);

    if (!mesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada para este cliente" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver esta Mesa de Trabajo" });
    }

    res.json(mesaTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesa de Trabajo" });
  }
};

// Obtener Mesa de Trabajo por ID
exports.getMesaTrabajoById = async (req, res) => {
  try {
    const { id } = req.params;
    const mesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);

    if (!mesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(mesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "No tienes permiso para ver esta Mesa de Trabajo" });
    }

    res.json(mesaTrabajo);
  } catch (err) {
    console.error("Error obteniendo Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al obtener Mesa de Trabajo" });
  }
};

// Actualizar Mesa de Trabajo
exports.updateMesaTrabajo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      criterio_inclusion,
      motivo_evaluacion,
      diagnostico,
      codigo_diagnostico
    } = req.body;

    // Validaciones
    if (!criterio_inclusion || !motivo_evaluacion || !diagnostico || !codigo_diagnostico) {
      return res.status(400).json({ 
        message: "Todos los campos son requeridos" 
      });
    }

    // Verificar que existe
    const existingMesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!existingMesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingMesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para editar esta Mesa de Trabajo" 
      });
    }

    const updatedMesaTrabajo = await mesaTrabajoModel.updateMesaTrabajo(id, {
      criterio_inclusion,
      motivo_evaluacion,
      diagnostico,
      codigo_diagnostico
    });

    res.json(updatedMesaTrabajo);
  } catch (err) {
    console.error("Error actualizando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al actualizar Mesa de Trabajo" });
  }
};

// Eliminar Mesa de Trabajo
exports.deleteMesaTrabajo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existingMesaTrabajo = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!existingMesaTrabajo) {
      return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });
    }

    // Verificar permisos
    const cliente = await clientModel.getClientById(existingMesaTrabajo.cliente_id);
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ 
        message: "No tienes permiso para eliminar esta Mesa de Trabajo" 
      });
    }

    // Verificar que no haya sesiones SVE registradas para este cliente
    const tieneSesiones = await mesaTrabajoModel.clienteTieneSesionesSVE(existingMesaTrabajo.cliente_id);
    if (tieneSesiones) {
      return res.status(409).json({
        message: "No se puede eliminar la Mesa de Trabajo porque el trabajador tiene sesiones SVE registradas. Elimine primero todas las sesiones."
      });
    }

    const deletedMesaTrabajo = await mesaTrabajoModel.deleteMesaTrabajo(id);
    res.json({ 
      message: "Mesa de Trabajo eliminada correctamente", 
      mesaTrabajo: deletedMesaTrabajo 
    });
  } catch (err) {
    console.error("Error eliminando Mesa de Trabajo:", err);
    res.status(500).json({ message: "Error al eliminar Mesa de Trabajo" });
  }
};
// ============================================================
// SOPORTE MESA DE TRABAJO — upload / download / delete
// Requiere: multer instalado  →  npm install multer
// ============================================================
const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// Carpeta de destino: backend/uploads/soporte-mesa-trabajo/
const UPLOAD_DIR = path.join(__dirname, "../uploads/soporte-mesa-trabajo");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext       = path.extname(file.originalname);
    cb(null, `soporte_${timestamp}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Formato no permitido. Use PDF, Word o Excel."), false);
  }
};

exports.uploadSoporte = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
}).single("soporte");

// POST /api/mesa-trabajo-sve/:id/soporte
exports.subirSoporte = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!mesa) return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });

    const userRole = req.user?.rol;
    const userId   = req.user?.id;
    const cliente  = await clientModel.getClientById(mesa.cliente_id);
    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "Sin permiso para modificar esta Mesa de Trabajo" });
    }

    if (!req.file) return res.status(400).json({ message: "No se recibió ningún archivo" });

    // Eliminar soporte anterior si existe
    if (mesa.soporte_ruta) {
      const rutaAnterior = path.join(UPLOAD_DIR, mesa.soporte_ruta);
      if (fs.existsSync(rutaAnterior)) fs.unlinkSync(rutaAnterior);
    }

    const updated = await mesaTrabajoModel.updateSoporteMesaTrabajo(id, {
      soporte_nombre: req.file.originalname,
      soporte_ruta:   req.file.filename
    });

    // URL pública — servida por Express desde /uploads/ sin autenticación
    const soporte_url = `/uploads/soporte-mesa-trabajo/${req.file.filename}`;

    res.json({
      soporte_nombre: updated.soporte_nombre,
      soporte_ruta:   updated.soporte_ruta,
      soporte_url
    });
  } catch (err) {
    console.error("Error subiendo soporte:", err);
    res.status(500).json({ message: err.message || "Error al subir el soporte" });
  }
};

// GET /api/mesa-trabajo-sve/:id/soporte
// Acepta token por header Authorization O por query param ?token=
// (necesario para abrir/descargar en nueva pestaña del navegador)
exports.descargarSoporte = async (req, res) => {
  try {
    const { id } = req.params;

    // Si el token viene por query param, verificarlo manualmente
    // (el middleware ya lo verificó si vino por header)
    if (!req.user && req.query.token) {
      const jwt = require('jsonwebtoken');
      try {
        req.user = jwt.verify(req.query.token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ success: false, message: "Token inválido" });
      }
    }

    const mesa = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!mesa || !mesa.soporte_ruta) {
      return res.status(404).json({ message: "No hay soporte adjunto para esta Mesa de Trabajo" });
    }

    const userRole = req.user?.rol;
    const userId   = req.user?.id;
    const cliente  = await clientModel.getClientById(mesa.cliente_id);
    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "Sin permiso para acceder a este soporte" });
    }

    const filePath = path.join(UPLOAD_DIR, mesa.soporte_ruta);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Archivo no encontrado en el servidor" });
    }

    // Ver en navegador (inline) o descargar según el parámetro ?download=1
    const disposition = req.query.download === '1'
      ? `attachment; filename="${mesa.soporte_nombre}"`
      : `inline; filename="${mesa.soporte_nombre}"`;

    res.setHeader('Content-Disposition', disposition);
    res.sendFile(filePath);
  } catch (err) {
    console.error("Error descargando soporte:", err);
    res.status(500).json({ message: "Error al obtener el soporte" });
  }
};

// DELETE /api/mesa-trabajo-sve/:id/soporte
exports.eliminarSoporte = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await mesaTrabajoModel.getMesaTrabajoById(id);
    if (!mesa) return res.status(404).json({ message: "Mesa de Trabajo no encontrada" });

    const userRole = req.user?.rol;
    const userId   = req.user?.id;
    const cliente  = await clientModel.getClientById(mesa.cliente_id);
    if (userRole !== 'admin' && cliente.profesional_id !== userId) {
      return res.status(403).json({ message: "Sin permiso para eliminar este soporte" });
    }

    if (mesa.soporte_ruta) {
      const filePath = path.join(UPLOAD_DIR, mesa.soporte_ruta);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await mesaTrabajoModel.updateSoporteMesaTrabajo(id, {
      soporte_nombre: null,
      soporte_ruta:   null
    });

    res.json({ message: "Soporte eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando soporte:", err);
    res.status(500).json({ message: "Error al eliminar el soporte" });
  }
};