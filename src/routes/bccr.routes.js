import express from "express";
import { getTipoCambio } from "../controllers/bccr.controller.js";

const router = express.Router();

/**
 * ======================================
 * BCCR - BANCO CENTRAL COSTA RICA
 * ======================================
 */

/**
 * 🔹 Obtener tipo de cambio del día
 * Método: GET
 * URL: /api/bccr/tipo-cambio
 * Acceso: Público
 */
router.get("/tipo-cambio", getTipoCambio);

/**
 * 🔹 Ruta de prueba (opcional)
 * Sirve para verificar que el módulo BCCR está activo
 */
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Módulo BCCR funcionando correctamente"
  });
});

export default router;