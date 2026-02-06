// backend/routes/clients.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const clientsController = require("../controllers/clientsController");

// ⭐ CONFIGURACIÓN DE MULTER PARA SUBIDA DE ARCHIVOS
// Crear directorio si no existe
const uploadDir = path.join(__dirname, '../uploads/consultas');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⭐ SOLUCIÓN DEFINITIVA: No usar req.body ni req.params en filename
// Multer procesa archivos ANTES de parsear el body
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único y seguro
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = path.extname(file.originalname);
    const nombreBase = path.basename(file.originalname, extension);
    const nombreSanitizado = nombreBase.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Formato final: timestamp_random_nombreOriginal.ext
    const nombreFinal = `${timestamp}_${randomStr}_${nombreSanitizado}${extension}`;
    
    console.log(`📎 Multer guardando archivo: ${nombreFinal}`);
    cb(null, nombreFinal);
  }
});

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log(`✅ Archivo aceptado: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } else {
    console.log(`❌ Archivo rechazado: ${file.originalname} (${file.mimetype})`);
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF y Word'), false);
  }
};

// Configurar multer con límite de tamaño y filtro
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  },
  fileFilter: fileFilter
});

// ============================================
// RUTAS EXISTENTES DE CLIENTES
// ============================================

// Crear un nuevo cliente
router.post("/", clientsController.createClient);

// ⭐ NUEVO: Obtener clientes con filtros avanzados (debe ir ANTES de "/:id")
router.get("/filters", clientsController.getClientsWithFilters);

// Obtener todos los clientes
router.get("/", clientsController.getClients);

// Obtener un cliente por ID
router.get("/:id", clientsController.getClientById);

// Actualizar un cliente
router.put("/:id", clientsController.updateClient);

// Eliminar un cliente
router.delete("/:id", clientsController.deleteClient);

// ============================================
// ⭐ NUEVAS RUTAS PARA DOCUMENTOS
// ============================================

// Subir documento
router.post("/:id/documentos", upload.single('documento'), clientsController.uploadDocumento);

// Obtener documentos del cliente
router.get("/:id/documentos", clientsController.getDocumentos);

// Eliminar documento específico
router.delete("/:id/documentos/:tipo", clientsController.deleteDocumento);

module.exports = router;