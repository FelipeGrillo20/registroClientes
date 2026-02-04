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

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único: clienteID_tipoDoc_timestamp_nombreOriginal
    const clienteId = req.params.id;
    const tipo = req.body.tipo;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const nombreBase = path.basename(file.originalname, extension);
    const nombreSanitizado = nombreBase.replace(/[^a-zA-Z0-9]/g, '_');
    
    const nombreFinal = `${clienteId}_${tipo}_${timestamp}_${nombreSanitizado}${extension}`;
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
    cb(null, true);
  } else {
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