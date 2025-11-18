// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_temporal_2024";

// Middleware para verificar token JWT
exports.verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No autorizado - Token no proporcionado" 
      });
    }

    // Verificar y decodificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Agregar datos del usuario al request
    req.user = decoded;
    next();

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Token inválido" 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token expirado" 
      });
    }
    
    console.error("Error en middleware de autenticación:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al verificar token" 
    });
  }
};