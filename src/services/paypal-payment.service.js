import pool from "../config/db.js";
import { crearOrdenPayPal, capturarOrdenPayPal } from "../external/paypal.service.js";

export async function crearOrdenPayPalPedido({
  orderId,
  reqUserId = null,
  reqUserRole = null,
}) {
  const connection = await pool.getConnection();

  try {
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
      throw new Error("El pedido no existe");
    }

    const order = orders[0];

    const esAdmin =
      String(reqUserRole || "").toLowerCase() === "admin" ||
      String(reqUserRole || "").toLowerCase() === "administrador";

    if (!esAdmin && reqUserId !== null) {
      if (Number(order.user_id) !== Number(reqUserId)) {
        throw new Error("No tienes permiso para pagar este pedido");
      }
    }

    const totalPedido = Number(
      order.total ??
      order.total_amount ??
      order.amount ??
      0
    );

    if (Number.isNaN(totalPedido) || totalPedido <= 0) {
      throw new Error("El total del pedido es inválido");
    }

    const estadoActual = String(
      order.status ??
      order.order_status ??
      "pendiente"
    ).toLowerCase();

    const estadosNoPermitidos = [
      "paid",
      "pagado",
      "cancelled",
      "cancelado",
      "completed",
      "completado"
    ];

    if (estadosNoPermitidos.includes(estadoActual)) {
      throw new Error("El pedido no se puede pagar en su estado actual");
    }

    const montoUSD = Number((totalPedido / 467.22).toFixed(2));

    if (Number.isNaN(montoUSD) || montoUSD <= 0) {
      throw new Error("El monto en USD es inválido para PayPal");
    }

    const paypalOrder = await crearOrdenPayPal({
      orderId,
      monto: montoUSD,
      moneda: "USD",
    });

    if (!paypalOrder || !paypalOrder.id) {
      throw new Error("PayPal no devolvió un identificador de orden válido");
    }

    return {
      ok: true,
      mensaje: "Orden PayPal creada correctamente",
      orderId,
      totalCRC: totalPedido,
      totalUSD: montoUSD,
      paypalOrderId: paypalOrder.id,
      paypal: paypalOrder,
    };
  } finally {
    connection.release();
  }
}

export async function capturarPagoPayPalPedido({
  orderId,
  paypalOrderId,
  reqUserId = null,
  reqUserRole = null,
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
      throw new Error("El pedido no existe");
    }

    const order = orders[0];

    const esAdmin =
      String(reqUserRole || "").toLowerCase() === "admin" ||
      String(reqUserRole || "").toLowerCase() === "administrador";

    if (!esAdmin && reqUserId !== null) {
      if (Number(order.user_id) !== Number(reqUserId)) {
        throw new Error("No tienes permiso para pagar este pedido");
      }
    }

    const estadoActual = String(
      order.status ??
      order.order_status ??
      "pendiente"
    ).toLowerCase();

    const estadosNoPermitidos = [
      "paid",
      "pagado",
      "cancelled",
      "cancelado",
      "completed",
      "completado"
    ];

    if (estadosNoPermitidos.includes(estadoActual)) {
      throw new Error("El pedido no se puede pagar en su estado actual");
    }

    const totalPedido = Number(
      order.total ??
      order.total_amount ??
      order.amount ??
      0
    );

    if (Number.isNaN(totalPedido) || totalPedido <= 0) {
      throw new Error("El total del pedido es inválido");
    }

    const captura = await capturarOrdenPayPal(paypalOrderId);

    const status = String(captura?.status || "").toUpperCase();
    const approved = status === "COMPLETED";

    const [paymentInsert] = await connection.execute(
      `
      INSERT INTO payments
      (
        order_id,
        payment_method,
        payment_status,
        amount
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        orderId,
        "paypal",
        approved ? "approved" : "rejected",
        totalPedido
      ]
    );

    if (approved) {
      if ("status" in order) {
        await connection.execute(
          `
          UPDATE orders
          SET status = ?
          WHERE id = ?
          `,
          ["Completado", orderId]
        );
      } else if ("order_status" in order) {
        await connection.execute(
          `
          UPDATE orders
          SET order_status = ?
          WHERE id = ?
          `,
          ["Completado", orderId]
        );
      }
    }

    await connection.commit();

    return {
      ok: approved,
      mensaje: approved
        ? "Pago PayPal aprobado"
        : "La captura PayPal no se completó",
      paymentId: paymentInsert.insertId,
      orderId,
      paymentStatus: approved ? "approved" : "rejected",
      estadoPedidoActualizado: approved ? "Completado" : null,
      paypal: captura,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}