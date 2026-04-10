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
    transactionReference: banco?.referenciaBanco || null,
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
  reqUserId = null,
  reqUserRole = null
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

    const [users] = await connection.execute(
      `
      SELECT id, cedula, phone, name, email
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [reqUserId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return buildError({
        mensaje: "Usuario autenticado no encontrado.",
        code: "AUTH_USER_NOT_FOUND",
        metodoPago,
        orderId,
        httpStatus: 404
      });
    }

    const usuario = users[0];
    const cedulaUsuario = String(usuario.cedula ?? "").trim();
    const telefonoUsuario = String(usuario.phone ?? "").trim();

    if (!cedulaUsuario) {
      await connection.rollback();
      return buildError({
        mensaje: "El usuario no tiene cédula registrada para validar el medio de pago.",
        code: "USER_WITHOUT_CEDULA",
        metodoPago,
        orderId,
        httpStatus: 400
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

    if (metodoPagoNormalizado === "tarjeta") {
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

      const cedulaTitularTarjeta = String(
        tarjetaConsulta.tarjeta?.cedula_titular ?? ""
      ).trim();

      if (!cedulaTitularTarjeta || cedulaTitularTarjeta !== cedulaUsuario) {
        await connection.rollback();
        return buildError({
          mensaje: "La tarjeta no pertenece al usuario autenticado.",
          code: "CARD_OWNERSHIP_MISMATCH",
          metodoPago: "tarjeta",
          orderId,
          monto: montoFinal,
          httpStatus: 403
        });
      }
    }

    if (metodoPagoNormalizado === "sinpe") {
      const cuentaSinpeConsulta = await consultarCuentaSinpe(telefono);

      if (!cuentaSinpeConsulta.ok) {
        await connection.rollback();
        return buildError({
          mensaje: cuentaSinpeConsulta.mensaje || "Número SINPE no registrado.",
          code: "SINPE_ACCOUNT_NOT_FOUND",
          metodoPago: "sinpe",
          orderId,
          monto: montoFinal,
          httpStatus: 404
        });
      }

      const cedulaCuentaSinpe = String(
        cuentaSinpeConsulta.cuenta?.cedula ?? ""
      ).trim();

      if (!cedulaCuentaSinpe || cedulaCuentaSinpe !== cedulaUsuario) {
        await connection.rollback();
        return buildError({
          mensaje: "La cuenta SINPE no pertenece al usuario autenticado.",
          code: "SINPE_OWNERSHIP_MISMATCH",
          metodoPago: "sinpe",
          orderId,
          monto: montoFinal,
          httpStatus: 403
        });
      }

      if (telefonoUsuario && String(telefono).trim() !== telefonoUsuario) {
        await connection.rollback();
        return buildError({
          mensaje: "El número SINPE no coincide con el teléfono registrado del usuario.",
          code: "SINPE_PHONE_MISMATCH",
          metodoPago: "sinpe",
          orderId,
          monto: montoFinal,
          httpStatus: 403
        });
      }
    }

    let respuestaBanco;

    if (metodoPagoNormalizado === "sinpe") {
      respuestaBanco = await procesarPagoSinpe({
        telefono,
        monto: montoFinal,
        referenciaExterna: `ORDER-${orderId}`
      });
    } else {
      respuestaBanco = await procesarPago({
        numeroTarjeta,
        nombreTitular,
        fechaExpiracion,
        cvv,
        monto: montoFinal,
        referenciaExterna: `ORDER-${orderId}`
      });
    }

    const paymentStatus = respuestaBanco.ok ? "approved" : "rejected";

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
      [orderId, metodoPagoNormalizado, paymentStatus, montoFinal]
    );

    const paymentId = paymentInsert.insertId;

    if (!respuestaBanco.ok) {
      await connection.commit();

      return buildError({
        mensaje: respuestaBanco.mensaje || "El pago fue rechazado.",
        code:
          metodoPagoNormalizado === "sinpe"
            ? "SINPE_PAYMENT_REJECTED"
            : "CARD_PAYMENT_REJECTED",
        metodoPago: metodoPagoNormalizado,
        orderId,
        paymentId,
        monto: montoFinal,
        banco: respuestaBanco,
        httpStatus: 400
      });
    }

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

    await connection.commit();

    return {
      ok: true,
      success: true,
      mensaje: respuestaBanco.mensaje || "Pago procesado correctamente.",
      message: respuestaBanco.mensaje || "Pago procesado correctamente.",
      code: "PAYMENT_PROCESSED",
      metodoPago: metodoPagoNormalizado,
      paymentMethod: metodoPagoNormalizado,
      orderId,
      paymentId,
      monto: montoFinal,
      amount: montoFinal,
      paymentStatus: "approved",
      estadoPedidoActualizado: "Completado",
      orderStatusUpdated: "Completado",
      transactionReference: respuestaBanco.referenciaBanco || `ORDER-${orderId}`,
      banco: respuestaBanco,
      bank: respuestaBanco
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function obtenerDatosPruebaPago() {
  const [tarjetas, sinpe] = await Promise.all([
    obtenerTarjetasPrueba(),
    obtenerCuentasSinpePrueba()
  ]);

  return {
    ok: true,
    success: true,
    mensaje: "Datos de prueba obtenidos correctamente.",
    message: "Datos de prueba obtenidos correctamente.",
    code: "PAYMENT_TEST_DATA_OK",
    data: {
      tarjetas,
      sinpe
    }
  };
}