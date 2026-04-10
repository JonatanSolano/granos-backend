// src/routes/economy.routes.js

import express from "express";
import { getTipoCambio } from "../controllers/economy.controller.js";

const router = express.Router();

// GET /api/economia/tipo-cambio
router.get("/tipo-cambio", getTipoCambio);

export default router;