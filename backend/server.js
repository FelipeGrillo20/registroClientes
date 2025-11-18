// backend/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// ⭐ ACTIVAR DOTENV PRIMERO (antes de importar rutas/modelos)
dotenv.config();

// Ahora sí importar rutas y middleware
const clientsRoutes = require("./routes/clients");
const consultasRoutes = require("./routes/consultas");
const empresasRoutes = require("./routes/empresas");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/authMiddleware");
const statsRoutes = require("./routes/stats");

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://registroclientesfront.onrender.com', 'https://tu-dominio-custom.com']
    : '*',
  credentials: true
}));
app.use(express.json());

// Rutas públicas (sin autenticación)
app.use("/api/auth", authRoutes);

// Rutas protegidas (requieren autenticación)
app.use("/api/clients", authMiddleware.verifyToken, clientsRoutes);
app.use("/api/consultas", authMiddleware.verifyToken, consultasRoutes);
app.use("/api/empresas", authMiddleware.verifyToken, empresasRoutes);
app.use("/api/stats", statsRoutes);

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

// Health check para Render
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
  console.log(`🔒 Rutas protegidas con JWT`);
  console.log(`📋 Rutas disponibles:`);
  console.log(`   - GET  / (Info de la API)`);
  console.log(`   - GET  /health (Health check)`);
  console.log(`   - POST /api/auth/login (Login)`);
  console.log(`   - POST /api/auth/register (Registro)`);
  console.log(`   - GET  /api/clients (Clientes) 🔒`);
  console.log(`   - GET  /api/consultas (Consultas) 🔒`);
  console.log(`   - GET  /api/empresas (Empresas) 🔒`);
});
