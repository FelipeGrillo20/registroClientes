// backend/middleware/adminMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_temporal_2024";

// Middleware para verificar que el usuario sea admin
exports.isAdmin = async (req, res, next) => {
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

    // Verificar que el rol sea admin
    if (decoded.rol !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: "Acceso denegado - Se requieren permisos de administrador" 
      });
    }

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
    
    console.error("Error en middleware admin:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al verificar permisos" 
    });
  }
};