import express from "express";
import securityController from "../controllers/security.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// ================================
// OBTENER PREGUNTAS DE RECUPERACIÓN POR EMAIL
// ================================

router.post(
  "/recovery-questions",
  securityController.getRecoveryQuestions
);

// ================================
// GUARDAR RESPUESTAS
// ================================

router.post(
  "/save-answers",
  verifyToken,
  securityController.saveAnswers
);

// ================================
// VERIFICAR RESPUESTAS
// ================================

router.post(
  "/verify-answers",
  securityController.verifyAnswers
);

export default router;