import express from "express";
import { consultarCedulaTSE } from "../controllers/integrations.controller.js";

const router = express.Router();

// GET /api/integrations/tse/cedula/:cedula
router.get("/tse/cedula/:cedula", consultarCedulaTSE);

export default router;