import express from "express";
import authController from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/verify-mfa", authController.verifyMFA);

router.get("/totp/status", verifyToken, authController.getTotpStatus);
router.post("/totp/setup", verifyToken, authController.setupTotp);
router.post("/totp/confirm", verifyToken, authController.confirmTotp);
router.post("/totp/disable", verifyToken, authController.disableTotp);

router.post("/recover-username", authController.recoverUsername);

router.put("/change-password", verifyToken, authController.changePassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.get("/security-questions", authController.getSecurityQuestions);
router.post(
  "/recovery-security-questions",
  authController.getRecoverySecurityQuestionsByEmail
);
router.post(
  "/security-answers",
  verifyToken,
  authController.saveSecurityAnswers
);

router.post("/verify-security-answers", authController.verifySecurityAnswers);
router.post(
  "/recover-password-security",
  authController.recoverPasswordWithSecurity
);

router.post("/validate-reset-token", authController.validateResetToken);

export default router;