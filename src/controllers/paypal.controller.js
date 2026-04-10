import {
  crearOrdenPayPalPedido,
  capturarPagoPayPalPedido
} from "../services/paypal-payment.service.js";

export async function createPayPalOrder(req, res) {
  try {
    console.log("[/api/paypal/create-order] body:", req.body);
    console.log("[/api/paypal/create-order] user:", req.user);

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Falta el orderId"
      });
    }

    const userId = req.user?.id || req.user?.userId || null;
    const userRole = req.user?.role || req.user?.rol || null;

    const result = await crearOrdenPayPalPedido({
      orderId,
      reqUserId: userId,
      reqUserRole: userRole,
    });

    console.log("[/api/paypal/create-order] result ok");
    return res.json(result);
  } catch (error) {
    console.error("[/api/paypal/create-order] error:", error.message);

    return res.status(500).json({
      ok: false,
      mensaje: error.message || "Error al crear la orden PayPal",
      detail: error.message || "Error al crear la orden PayPal"
    });
  }
}

export async function capturePayPalOrder(req, res) {
  try {
    console.log("[/api/paypal/capture-order] body:", req.body);
    console.log("[/api/paypal/capture-order] user:", req.user);

    const { orderId, paypalOrderId } = req.body;

    if (!orderId || !paypalOrderId) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan orderId o paypalOrderId"
      });
    }

    const userId = req.user?.id || req.user?.userId || null;
    const userRole = req.user?.role || req.user?.rol || null;

    const result = await capturarPagoPayPalPedido({
      orderId,
      paypalOrderId,
      reqUserId: userId,
      reqUserRole: userRole,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    console.log("[/api/paypal/capture-order] result ok");
    return res.json(result);
  } catch (error) {
    console.error("[/api/paypal/capture-order] error:", error.message);

    return res.status(500).json({
      ok: false,
      mensaje: error.message || "Error al capturar el pago PayPal",
      detail: error.message || "Error al capturar el pago PayPal"
    });
  }
}