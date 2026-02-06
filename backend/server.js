// backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// ⭐ ACTIVAR DOTENV PRIMERO (antes de importar rutas/modelos)
dotenv.config();

// Ahora sí importar rutas y middleware
const clientsRoutes = require("./routes/clients");
const consultasRoutes = require("./routes/consultas");
const empresasRoutes = require("./routes/empresas");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/authMiddleware");
const statsRoutes = require("./routes/stats");
const mesaTrabajoSveRoutes = require("./routes/mesaTrabajoSve");
const consultasSveRoutes = require("./routes/consultasSve");

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://registroclientesfront.onrender.com', 'https://tu-dominio-custom.com']
    : '*',
  credentials: true
}));
app.use(express.json());

// ⭐ CONFIGURACIÓN MEJORADA PARA HOSTINGER VPS
// Servir archivos estáticos con headers específicos para PDFs
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Sirviendo archivos estáticos desde:', uploadsPath);

app.use('/uploads', (req, res, next) => {
  // ⭐ Headers especiales para archivos PDF y Word
  const ext = path.extname(req.path).toLowerCase();
  
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline'); // Para mostrar en navegador
  } else if (ext === '.doc') {
    res.setHeader('Content-Type', 'application/msword');
  } else if (ext === '.docx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  
  // Headers CORS para archivos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  next();
}, express.static(uploadsPath, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Rutas públicas (sin autenticación)
app.use("/api/auth", authRoutes);

// Rutas protegidas (requieren autenticación)
app.use("/api/clients", authMiddleware.verifyToken, clientsRoutes);
app.use("/api/consultas", authMiddleware.verifyToken, consultasRoutes);
app.use("/api/empresas", authMiddleware.verifyToken, empresasRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/mesa-trabajo-sve", authMiddleware.verifyToken, mesaTrabajoSveRoutes);
app.use("/api/consultas-sve", authMiddleware.verifyToken, consultasSveRoutes);

// Ruta de prueba (pública)
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API funcionando - Sistema de Gestión de Clientes",
    status: "OK",
    environment: process.env.NODE_ENV || "development"
  });
});

// Ruta protegida de prueba
app.get("/api/protected", authMiddleware.verifyToken, (req, res) => {
  res.json({ 
    message: "Acceso autorizado", 
    user: req.user 
  });
});

// Health check para monitoreo
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({ 
    error: "Algo salió mal en el servidor",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Configuración del puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🏢 Servidor VPS: Hostinger`);
  console.log(`🔒 Rutas protegidas con JWT`);
  console.log(`📋 Rutas disponibles:`);
  console.log(`   - GET  / (Info de la API)`);
  console.log(`   - GET  /health (Health check)`);
  console.log(`   - POST /api/auth/login (Login)`);
  console.log(`   - POST /api/auth/register (Registro)`);
  console.log(`   - GET  /api/clients (Clientes) 🔒`);
  console.log(`   - GET  /api/consultas (Consultas) 🔒`);
  console.log(`   - GET  /api/empresas (Empresas) 🔒`);
  console.log(`   - GET  /uploads/* (Archivos adjuntos) 📎`);
});