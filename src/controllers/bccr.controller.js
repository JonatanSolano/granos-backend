import { obtenerTipoCambio } from "../services/bccr.service.js";

/**
 * GET /api/bccr/tipo-cambio
 */
export async function getTipoCambio(req, res) {
  try {
    const data = await obtenerTipoCambio();

    return res.status(200).json({
      success: true,
      message: "Tipo de cambio obtenido correctamente.",
      data
    });
  } catch (error) {
    const status = error.status || 500;

    return res.status(status).json({
      success: false,
      message: error.message || "Error al consultar el tipo de cambio.",
      detail: error.detail || null
    });
  }
}