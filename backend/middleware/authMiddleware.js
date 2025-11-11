// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_temporal_2024";

// Middleware para verificar token JWT
exports.verifyToken = (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "No autorizado - Token no proporcionado" 
      });
    }
    
    const token = authHeader.split(" ")[1];
    
    // Verificar y decodificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Agregar datos del usuario al request
    req.user = decoded;
    
    // Continuar con la siguiente función
    next();
    
  } catch (err) {
    console.error("Error verificando token:", err.message);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token expirado - Por favor inicia sesión nuevamente" 
      });
    }
    
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "Token inválido" 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error al verificar autenticación" 
    });
  }
};

// Middleware para verificar rol (opcional para futuras funcionalidades)
exports.verifyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "No autorizado" 
      });
    }
    
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ 
        success: false,
        message: "No tienes permisos para realizar esta acción" 
      });
    }
    
    next();
  };
};