import jwt from "jsonwebtoken";
import authService from "../services/auth.service.js";


// =====================================
// 🔐 Verificar Token
// =====================================

export const verifyToken = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {

      return res.status(401).json({
        message: "Token requerido",
      });

    }

    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({
        message: "Formato de token inválido",
      });

    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.id) {

      return res.status(403).json({
        message: "Token inválido",
      });

    }

    req.user = decoded;

    // Auditoría opcional de acceso protegido
    try {

      await authService.logAudit(
        decoded.id,
        "ACCESS_PROTECTED_ROUTE",
        "auth",
        `Acceso a ruta protegida ${req.originalUrl}`,
        req.ip
      );

    } catch (auditError) {

      console.warn("Audit warning:", auditError.message);

    }

    next();

  } catch (error) {

    console.error("Token error:", error.message);

    if (error.name === "TokenExpiredError") {

      return res.status(403).json({
        message: "Token expirado",
      });

    }

    if (error.name === "JsonWebTokenError") {

      return res.status(403).json({
        message: "Token inválido",
      });

    }

    return res.status(403).json({
      message: "Error de autenticación",
    });

  }

};


// =====================================
// 👑 Verificar ADMIN
// =====================================

export const isAdmin = (req, res, next) => {

  if (!req.user || req.user.role !== "admin") {

    return res.status(403).json({
      message: "Acceso solo para administradores",
    });

  }

  next();

};


// =====================================
// 🔐 Verificar Roles Dinámicos
// =====================================

export const requireRole = (roles = []) => {

  return (req, res, next) => {

    if (!req.user) {

      return res.status(401).json({
        message: "Usuario no autenticado",
      });

    }

    if (!roles.includes(req.user.role)) {

      return res.status(403).json({
        message: "No tiene permisos para esta acción",
      });

    }

    next();

  };

};