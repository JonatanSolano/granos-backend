import pool from "../config/db.js";
import {
  procesarPago,
  procesarPagoSinpe,
  obtenerTarjetasPrueba,
  obtenerCuentasSinpePrueba,
  consultarTarjeta,
  consultarCuentaSinpe
} from "../external/bank.service.js";

function normalizarMetodoPago(valor = "") {
  return String(valor).trim().toLowerCase();
}

function normalizarEstadoPedido(order) {
  return String(
    order.status ??
      order.order_status ??
      "pendiente"
  )
    .trim()
    .toLowerCase();
}

function resolverTotalPedido(order) {
  return Number(order.total ?? order.total_amount ?? order.amount ?? 0);
}

function buildError({
  mensaje,
  code,
  metodoPago = null,
  orderId = null,
  paymentId = null,
  monto = null,
  httpStatus = 400,
  banco = null
}) {
  return {
    ok: false,
    success: false,
    mensaje,
    message: mensaje,
    code,
    metodoPago,
    paymentMethod: metodoPago,
    orderId,
    paymentId,
    monto,
    amount: monto,
    paymentStatus: "rejected",
    estadoPedidoActualizado: null,
    orderStatusUpdated: null,
    banco,
    bank: banco,
    httpStatus
  };
}

export async function procesarPagoPedido({
  orderId,
  metodoPago,
  numeroTarjeta,
  nombreTitular,
  fechaExpiracion,
  cvv,
  telefono,
  monto,
  reqUserId = null
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      `
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return buildError({
        mensaje: "El pedido no existe.",
        code: "ORDER_NOT_FOUND",
        metodoPago,
        orderId,
        httpStatus: 404
      });
    }

    const order = orders[0];

    if (reqUserId === null || reqUserId === undefined) {
      await connection.rollback();
      return buildError({
        mensaje: "Usuario no autenticado para procesar el pago.",
        code: "UNAUTHENTICATED_PAYMENT",
        metodoPago,
        orderId,
        httpStatus: 401
      });
    }

    if (Number(order.user_id) !== Number(reqUserId)) {
      await connection.rollback();
      return buildError({
        mensaje: "No tienes permiso para pagar este pedido.",
        code: "ORDER_PAYMENT_FORBIDDEN",
        metodoPago,
        orderId,
        httpStatus: 403
      });
    }

    const estadoActual = normalizarEstadoPedido(order);
    const estadosNoPermitidos = [
      "paid",
      "pagado",
      "cancelled",
      "cancelado",
      "completed",
      "completado"
    ];

    if (estadosNoPermitidos.includes(estadoActual)) {
      await connection.rollback();
      return buildError({
        mensaje: "El pedido no se puede pagar en su estado actual.",
        code: "ORDER_INVALID_STATUS",
        metodoPago,
        orderId,
        httpStatus: 409
      });
    }

    const totalPedido = resolverTotalPedido(order);

    if (!Number.isFinite(totalPedido) || totalPedido <= 0) {
      await connection.rollback();
      return buildError({
        mensaje: "El total del pedido es inválido.",
        code: "INVALID_ORDER_TOTAL",
        metodoPago,
        orderId,
        httpStatus: 400
      });
    }

    const montoFinal = monto ?? totalPedido;

    if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
      await connection.rollback();
      return buildError({
        mensaje: "El monto del pago es inválido.",
        code: "INVALID_PAYMENT_AMOUNT",
        metodoPago,
        orderId,
        monto: montoFinal,
        httpStatus: 400
      });
    }

    if (Number(totalPedido) !== Number(montoFinal)) {
      await connection.rollback();
      return buildError({
        mensaje: "El monto enviado no coincide con el total del pedido.",
        code: "AMOUNT_MISMATCH",
        metodoPago,
        orderId,
        monto: montoFinal,
        httpStatus: 400
      });
    }

    const metodoPagoNormalizado = normalizarMetodoPago(metodoPago);

    if (!["tarjeta", "sinpe"].includes(metodoPagoNormalizado)) {
      await connection.rollback();
      return buildError({
        mensaje: "Método de pago no soportado.",
        code: "UNSUPPORTED_PAYMENT_METHOD",
        metodoPago: metodoPagoNormalizado,
        orderId,
        monto: montoFinal,
        httpStatus: 400
      });
    }

    let bancoResult;

    if (metodoPagoNormalizado === "tarjeta") {
      if (!numeroTarjeta || !nombreTitular || !fechaExpiracion || !cvv) {
        await connection.rollback();
        return buildError({
          mensaje: "Todos los datos de la tarjeta son obligatorios.",
          code: "MISSING_CARD_FIELDS",
          metodoPago: "tarjeta",
          orderId,
          monto: montoFinal,
          httpStatus: 400
        });
      }

      const tarjetaConsulta = await consultarTarjeta(numeroTarjeta);

      if (!tarjetaConsulta.ok) {
        await connection.rollback();
        return buildError({
          mensaje: tarjetaConsulta.mensaje || "Tarjeta no encontrada.",
          code: "CARD_NOT_FOUND",
          metodoPago: "tarjeta",
          orderId,
          monto: montoFinal,
          httpStatus: 404
        });
      }

      bancoResult = await procesarPago({
        numeroTarjeta,
        nombreTitular,
        fechaExpiracion,
        cvv,
        monto: montoFinal,
        referenciaExterna: `ORDER-${orderId}`
      });
    } else {
      const telefonoFinal = String(telefono ?? numeroTarjeta ?? "").trim();

      if (!telefonoFinal) {
        await connection.rollback();
        return buildError({
          mensaje: "Debe indicar el número SINPE.",
          code: "MISSING_SINPE_PHONE",
          metodoPago: "sinpe",
          orderId,
          monto: montoFinal,
          httpStatus: 400
        });
      }

      const cuentaConsulta = await consultarCuentaSinpe(telefonoFinal);

      if (!cuentaConsulta.ok) {
        await connection.rollback();
        return buildError({
          mensaje: cuentaConsulta.mensaje || "Cuenta SINPE no encontrada.",
          code: "SINPE_ACCOUNT_NOT_FOUND",
          metodoPago: "sinpe",
          orderId,
          monto: montoFinal,
          httpStatus: 404
        });
      }

      bancoResult = await procesarPagoSinpe({
        telefono: telefonoFinal,
        monto: montoFinal,
        referenciaExterna: `ORDER-${orderId}`
      });
    }

    if (!bancoResult?.ok) {
      await connection.rollback();
      return buildError({
        mensaje: bancoResult?.mensaje || "El banco rechazó el pago.",
        code: "BANK_PAYMENT_REJECTED",
        metodoPago: metodoPagoNormalizado,
        orderId,
        monto: montoFinal,
        banco: bancoResult,
        httpStatus: 400
      });
    }

    const [paymentInsert] = await connection.execute(
      `
      INSERT INTO payments
      (
        order_id,
        payment_method,
        payment_status,
        amount,
        created_at
      )
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        orderId,
        metodoPagoNormalizado,
        "approved",
        montoFinal
      ]
    );

    const paymentId = paymentInsert.insertId;

    await connection.execute(
      `
      UPDATE orders
      SET status = 'Completado'
      WHERE id = ?
      `,
      [orderId]
    );

    await connection.commit();

    return {
      ok: true,
      success: true,
      mensaje: bancoResult.mensaje || "Pago procesado correctamente.",
      message: bancoResult.mensaje || "Pago procesado correctamente.",
      code: "PAYMENT_SUCCESS",
      metodoPago: metodoPagoNormalizado,
      paymentMethod: metodoPagoNormalizado,
      orderId,
      paymentId,
      monto: montoFinal,
      amount: montoFinal,
      paymentStatus: "approved",
      estadoPedidoActualizado: "Completado",
      orderStatusUpdated: "Completado",
      banco: bancoResult,
      bank: bancoResult
    };
  } catch (error) {
    await connection.rollback();
    return buildError({
      mensaje: "Error interno al procesar el pago del pedido.",
      code: "INTERNAL_ORDER_PAYMENT_ERROR",
      metodoPago,
      orderId,
      monto,
      httpStatus: 500,
      banco: {
        detail: error.message
      }
    });
  } finally {
    connection.release();
  }
}

export async function obtenerDatosPruebaPago() {
  const [tarjetas, cuentasSinpe] = await Promise.all([
    obtenerTarjetasPrueba(),
    obtenerCuentasSinpePrueba()
  ]);

  return {
    ok: true,
    success: true,
    mensaje: "Datos de prueba obtenidos correctamente.",
    message: "Datos de prueba obtenidos correctamente.",
    data: {
      tarjetas,
      sinpe: cuentasSinpe
    }
  };
}