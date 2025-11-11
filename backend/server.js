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

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas públicas (sin autenticación)
app.use("/api/auth", authRoutes);

// Rutas protegidas (requieren autenticación)
app.use("/api/clients", authMiddleware.verifyToken, clientsRoutes);
app.use("/api/consultas", authMiddleware.verifyToken, consultasRoutes);
app.use("/api/empresas", authMiddleware.verifyToken, empresasRoutes);

// Ruta de prueba (pública)
app.get("/", (req, res) => {
  res.send("🚀 API funcionando - Sistema de Gestión de Clientes");
});

// Ruta protegida de prueba
app.get("/api/protected", authMiddleware.verifyToken, (req, res) => {
  res.json({ 
    message: "Acceso autorizado", 
    user: req.user 
  });
});

// Configuración del puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔒 Rutas protegidas con JWT`);
  console.log(`📋 Rutas disponibles:`);
  console.log(`   - /api/clients (Clientes)`);
  console.log(`   - /api/consultas (Consultas y Seguimiento)`);
  console.log(`   - /api/auth (Autenticación)`);
});
