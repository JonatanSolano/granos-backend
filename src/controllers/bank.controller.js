import {
  validarTarjeta,
  procesarPago,
  consultarTarjeta
} from "../external/bank.service.js";

export async function validateCard(req, res) {
  try {
    const {
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv
    } = req.body;

    if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !cvv) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: "Todos los campos de la tarjeta son obligatorios.",
        message: "Todos los campos de la tarjeta son obligatorios.",
        code: "MISSING_CARD_FIELDS"
      });
    }

    const result = await validarTarjeta({
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: result.mensaje,
        message: result.mensaje,
        code: "CARD_VALIDATION_FAILED"
      });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      mensaje: result.mensaje,
      message: result.mensaje,
      code: "CARD_VALIDATION_OK",
      tarjeta: {
        numeroTarjeta: result.tarjeta.numero_tarjeta,
        nombreTitular: result.tarjeta.nombre_titular,
        tipoTarjeta: result.tarjeta.tipo_tarjeta,
        marca: result.tarjeta.marca,
        estado: result.tarjeta.estado
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: "Error interno al validar tarjeta.",
      message: "Error interno al validar tarjeta.",
      code: "INTERNAL_CARD_VALIDATION_ERROR",
      detail: error.message
    });
  }
}

export async function processPayment(req, res) {
  try {
    const {
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv,
      monto,
      referenciaExterna
    } = req.body;

    if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !cvv || !monto) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: "Todos los datos del pago son obligatorios.",
        message: "Todos los datos del pago son obligatorios.",
        code: "MISSING_PAYMENT_FIELDS"
      });
    }

    const result = await procesarPago({
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv,
      monto,
      referenciaExterna
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: result.mensaje,
        message: result.mensaje,
        code: "BANK_PAYMENT_REJECTED",
        banco: result,
        bank: result
      });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      mensaje: result.mensaje,
      message: result.mensaje,
      code: "BANK_PAYMENT_APPROVED",
      transactionReference: result.referenciaBanco || null,
      banco: result,
      bank: result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: "Error interno al procesar pago.",
      message: "Error interno al procesar pago.",
      code: "INTERNAL_BANK_PAYMENT_ERROR",
      detail: error.message
    });
  }
}

export async function getCardInfo(req, res) {
  try {
    const { numeroTarjeta } = req.params;

    const result = await consultarTarjeta(numeroTarjeta);

    if (!result.ok) {
      return res.status(404).json({
        ok: false,
        success: false,
        mensaje: result.mensaje,
        message: result.mensaje,
        code: "CARD_NOT_FOUND"
      });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      mensaje: result.mensaje,
      message: result.mensaje,
      code: "CARD_FOUND",
      tarjeta: result.tarjeta
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: "Error interno al consultar tarjeta.",
      message: "Error interno al consultar tarjeta.",
      code: "INTERNAL_CARD_QUERY_ERROR",
      detail: error.message
    });
  }
}