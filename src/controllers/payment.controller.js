import {
  procesarPagoPedido,
  obtenerDatosPruebaPago
} from "../services/payment.service.js";

function normalizarMetodoPago(valor = "") {
  return String(valor).trim().toLowerCase();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export async function processOrderPayment(req, res) {
  try {
    const {
      orderId,
      metodoPago,
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv,
      monto,
      telefono
    } = req.body;

    if (!orderId || !metodoPago) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: "Faltan datos obligatorios para procesar el pago.",
        message: "Faltan datos obligatorios para procesar el pago.",
        code: "MISSING_REQUIRED_FIELDS"
      });
    }

    const metodoPagoNormalizado = normalizarMetodoPago(metodoPago);

    if (!["tarjeta", "sinpe"].includes(metodoPagoNormalizado)) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: "Método de pago no soportado.",
        message: "Método de pago no soportado.",
        code: "UNSUPPORTED_PAYMENT_METHOD",
        metodoPago: metodoPagoNormalizado,
        paymentMethod: metodoPagoNormalizado
      });
    }

    if (metodoPagoNormalizado === "tarjeta") {
      if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !cvv) {
        return res.status(400).json({
          ok: false,
          success: false,
          mensaje: "Faltan datos obligatorios de la tarjeta.",
          message: "Faltan datos obligatorios de la tarjeta.",
          code: "MISSING_CARD_FIELDS",
          metodoPago: "tarjeta",
          paymentMethod: "tarjeta"
        });
      }
    }

    if (metodoPagoNormalizado === "sinpe") {
      const telefonoSinpe = telefono || numeroTarjeta;

      if (!telefonoSinpe) {
        return res.status(400).json({
          ok: false,
          success: false,
          mensaje: "Falta el número telefónico SINPE.",
          message: "Falta el número telefónico SINPE.",
          code: "MISSING_SINPE_PHONE",
          metodoPago: "sinpe",
          paymentMethod: "sinpe"
        });
      }
    }

    const montoNumerico =
      monto !== undefined && monto !== null ? toNumber(monto) : undefined;

    if (
      monto !== undefined &&
      monto !== null &&
      (!Number.isFinite(montoNumerico) || montoNumerico <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: "El monto enviado es inválido.",
        message: "El monto enviado es inválido.",
        code: "INVALID_AMOUNT"
      });
    }

    const userId = req.user?.id || req.user?.userId || null;
    const userRole = req.user?.role || req.user?.rol || null;

    const result = await procesarPagoPedido({
      orderId: Number(orderId),
      metodoPago: metodoPagoNormalizado,
      numeroTarjeta,
      nombreTitular,
      fechaExpiracion,
      cvv,
      telefono: telefono || numeroTarjeta,
      monto: montoNumerico,
      reqUserId: userId,
      reqUserRole: userRole
    });

    if (!result.ok) {
      return res.status(result.httpStatus || 400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: "Error interno al procesar pago del pedido.",
      message: "Error interno al procesar pago del pedido.",
      code: "INTERNAL_PAYMENT_ERROR",
      detail: error.message
    });
  }
}

export async function getPaymentTestData(req, res) {
  try {
    const result = await obtenerDatosPruebaPago();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: "Error obteniendo datos de prueba de pago.",
      message: "Error obteniendo datos de prueba de pago.",
      code: "INTERNAL_TEST_DATA_ERROR",
      detail: error.message
    });
  }
}