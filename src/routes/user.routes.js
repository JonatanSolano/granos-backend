import express from "express";

import {
  getProfile,
  updateProfile,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  updateUser
} from "../controllers/user.controller.js";

import {
  verifyToken,
  isAdmin
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ======================================
// PERFIL USUARIO AUTENTICADO
// ======================================

router.get("/profile", verifyToken, getProfile);

router.put("/profile", verifyToken, updateProfile);

// ======================================
// ADMIN - LISTAR USUARIOS
// ======================================

router.get("/", verifyToken, isAdmin, getAllUsers);

// ======================================
// ADMIN - BLOQUEAR / DESBLOQUEAR
// ======================================

router.put(
  "/:id/status",
  verifyToken,
  isAdmin,
  toggleUserStatus
);

// ======================================
// ADMIN - ELIMINAR USUARIO
// ======================================

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  deleteUser
);

// ======================================
// ADMIN - ACTUALIZAR USUARIO
// ======================================

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  updateUser
);

export default router;