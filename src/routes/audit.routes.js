import express from "express";
import auditController from "../controllers/audit.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/logs",
  verifyToken,
  isAdmin,
  auditController.getAuditLogs
);

export default router;