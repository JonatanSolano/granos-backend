import pool from "../config/bank.db.js";

function generarReferenciaBanco(prefijo = "BANK") {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function registrarTransaccion({
  numeroTarjeta,
  tipoTransaccion,
  monto,
  referenciaBanco,
  referenciaExterna,
  estado,
  detalle
}) {
  try {
    await pool.query(
      `
      INSERT INTO transacciones_bancarias
      (
        numero_tarjeta,
        tipo_transaccion,
        monto,
        referencia_banco,
        referencia_externa,
        estado,
        detalle,
        fecha_transaccion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        numeroTarjeta,
        tipoTransaccion,
        monto,
        referenciaBanco,
        referenciaExterna || null,
        estado,
        detalle || null
      ]
    );
  } catch (_error) {
    // No bloquea el flujo si falla la bitácora
  }
}

export async function consultarTarjeta(numeroTarjeta) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      numero_tarjeta,
      nombre_titular,
      fecha_expiracion,
      cvv,
      tipo_tarjeta,
      marca,
      saldo,
      limite_credito,
      estado
    FROM tarjetas
    WHERE numero_tarjeta = ?
    LIMIT 1
    `,
    [numeroTarjeta]
  );

  if (!rows.length) {
    return {
      ok: false,
      mensaje: "La tarjeta no existe."
    };
  }

  return {
    ok: true,
    mensaje: "Tarjeta encontrada.",
    tarjeta: rows[0]
  };
}

export async function validarTarjeta({
  numeroTarjeta,
  nombreTitular,
  fechaExpiracion,
  cvv
}) {
  const result = await consultarTarjeta(numeroTarjeta);

  if (!result.ok) {
    return result;
  }

  const tarjeta = result.tarjeta;

  if (String(tarjeta.estado || "").toLowerCase() !== "activa") {
    return {
      ok: false,
      mensaje: "La tarjeta se encuentra inactiva."
    };
  }

  if (
    String(tarjeta.nombre_titular).trim().toLowerCase() !==
    String(nombreTitular).trim().toLowerCase()
  ) {
    return {
      ok: false,
      mensaje: "El nombre del titular no coincide."
    };
  }

  if (String(tarjeta.fecha_expiracion).trim() !== String(fechaExpiracion).trim()) {
    return {
      ok: false,
      mensaje: "La fecha de expiración no coincide."
    };
  }

  if (String(tarjeta.cvv).trim() !== String(cvv).trim()) {
    return {
      ok: false,
      mensaje: "El CVV no coincide."
    };
  }

  return {
    ok: true,
    mensaje: "Tarjeta válida.",
    tarjeta
  };
}

export async function procesarPago({
  numeroTarjeta,
  nombreTitular,
  fechaExpiracion,
  cvv,
  monto,
  referenciaExterna
}) {
  const validacion = await validarTarjeta({
    numeroTarjeta,
    nombreTitular,
    fechaExpiracion,
    cvv
  });

  if (!validacion.ok) {
    return validacion;
  }

  const tarjeta = validacion.tarjeta;
  const montoNumero = Number(monto);

  if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
    return {
      ok: false,
      mensaje: "El monto del pago no es válido."
    };
  }

  const referenciaBanco = generarReferenciaBanco("BANK");

  if (String(tarjeta.tipo_tarjeta).toLowerCase() === "debito") {
    const saldoActual = Number(tarjeta.saldo || 0);

    if (saldoActual < montoNumero) {
      await registrarTransaccion({
        numeroTarjeta,
        tipoTransaccion: "PAGO_DEBITO",
        monto: montoNumero,
        referenciaBanco,
        referenciaExterna,
        estado: "RECHAZADA",
        detalle: "Fondos insuficientes"
      });

      return {
        ok: false,
        mensaje: "Fondos insuficientes en la tarjeta de débito.",
        referenciaBanco
      };
    }

    await pool.query(
      `
      UPDATE tarjetas
      SET saldo = saldo - ?
      WHERE id = ?
      `,
      [montoNumero, tarjeta.id]
    );

    await registrarTransaccion({
      numeroTarjeta,
      tipoTransaccion: "PAGO_DEBITO",
      monto: montoNumero,
      referenciaBanco,
      referenciaExterna,
      estado: "APROBADA",
      detalle: "Pago aprobado con tarjeta débito"
    });

    return {
      ok: true,
      mensaje: "Pago aprobado con tarjeta débito.",
      referenciaBanco
    };
  }

  if (String(tarjeta.tipo_tarjeta).toLowerCase() === "credito") {
    const limiteActual = Number(tarjeta.limite_credito || 0);

    if (limiteActual < montoNumero) {
      await registrarTransaccion({
        numeroTarjeta,
        tipoTransaccion: "PAGO_CREDITO",
        monto: montoNumero,
        referenciaBanco,
        referenciaExterna,
        estado: "RECHAZADA",
        detalle: "Límite insuficiente"
      });

      return {
        ok: false,
        mensaje: "Límite insuficiente en la tarjeta de crédito.",
        referenciaBanco
      };
    }

    await pool.query(
      `
      UPDATE tarjetas
      SET limite_credito = limite_credito - ?
      WHERE id = ?
      `,
      [montoNumero, tarjeta.id]
    );

    await registrarTransaccion({
      numeroTarjeta,
      tipoTransaccion: "PAGO_CREDITO",
      monto: montoNumero,
      referenciaBanco,
      referenciaExterna,
      estado: "APROBADA",
      detalle: "Pago aprobado con tarjeta crédito"
    });

    return {
      ok: true,
      mensaje: "Pago aprobado con tarjeta crédito.",
      referenciaBanco
    };
  }

  return {
    ok: false,
    mensaje: "Tipo de tarjeta no soportado."
  };
}

export async function consultarCuentaSinpe(telefono) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      telefono,
      nombre_titular,
      saldo
    FROM cuentas_sinpe
    WHERE telefono = ?
    LIMIT 1
    `,
    [telefono]
  );

  if (!rows.length) {
    return {
      ok: false,
      mensaje: "La cuenta SINPE no existe."
    };
  }

  return {
    ok: true,
    mensaje: "Cuenta SINPE encontrada.",
    cuenta: {
      ...rows[0],
      activo: true
    }
  };
}

export async function procesarPagoSinpe({
  telefono,
  monto,
  referenciaExterna
}) {
  const consulta = await consultarCuentaSinpe(telefono);

  if (!consulta.ok) {
    return consulta;
  }

  const cuenta = consulta.cuenta;
  const montoNumero = Number(monto);

  if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
    return {
      ok: false,
      mensaje: "El monto del pago SINPE no es válido."
    };
  }

  const saldoActual = Number(cuenta.saldo || 0);

  if (saldoActual < montoNumero) {
    await registrarTransaccion({
      numeroTarjeta: telefono,
      tipoTransaccion: "PAGO_SINPE",
      monto: montoNumero,
      referenciaBanco: generarReferenciaBanco("SINPE"),
      referenciaExterna,
      estado: "RECHAZADA",
      detalle: "Saldo insuficiente en cuenta SINPE"
    });

    return {
      ok: false,
      mensaje: "Saldo insuficiente en la cuenta SINPE."
    };
  }

  const referenciaBanco = generarReferenciaBanco("SINPE");

  await pool.query(
    `
    UPDATE cuentas_sinpe
    SET saldo = saldo - ?
    WHERE id = ?
    `,
    [montoNumero, cuenta.id]
  );

  await registrarTransaccion({
    numeroTarjeta: telefono,
    tipoTransaccion: "PAGO_SINPE",
    monto: montoNumero,
    referenciaBanco,
    referenciaExterna,
    estado: "APROBADA",
    detalle: "Pago aprobado con SINPE"
  });

  return {
    ok: true,
    mensaje: "Pago aprobado con SINPE.",
    referenciaBanco
  };
}

export async function obtenerTarjetasPrueba() {
  const [rows] = await pool.query(
    `
    SELECT
      numero_tarjeta AS numeroTarjeta,
      nombre_titular AS nombreTitular,
      fecha_expiracion AS fechaExpiracion,
      cvv,
      tipo_tarjeta AS tipoTarjeta,
      marca,
      estado
    FROM tarjetas
    WHERE LOWER(estado) = 'activa'
    ORDER BY id ASC
    LIMIT 10
    `
  );

  return rows.map((row) => ({
    ...row,
    activo: true
  }));
}

export async function obtenerCuentasSinpePrueba() {
  const [rows] = await pool.query(
    `
    SELECT
      telefono,
      nombre_titular AS nombreTitular,
      saldo
    FROM cuentas_sinpe
    ORDER BY id ASC
    LIMIT 10
    `
  );

  return rows.map((row) => ({
    ...row,
    activo: true
  }));
}