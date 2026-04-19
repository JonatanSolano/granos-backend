export async function consultarCuentaSinpe(telefono) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      telefono,
      nombre_titular,
      saldo,
      activo
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
    cuenta: rows[0]
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

  if (!cuenta.activo) {
    return {
      ok: false,
      mensaje: "La cuenta SINPE está inactiva."
    };
  }

  const saldoActual = Number(cuenta.saldo || 0);

  if (saldoActual < montoNumero) {
    return {
      ok: false,
      mensaje: "Saldo insuficiente en la cuenta SINPE."
    };
  }

  const referenciaBanco = `SINPE-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await pool.query(
    `
    UPDATE cuentas_sinpe
    SET saldo = saldo - ?
    WHERE id = ?
    `,
    [montoNumero, cuenta.id]
  );

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
        telefono,
        "PAGO_SINPE",
        montoNumero,
        referenciaBanco,
        referenciaExterna || null,
        "APROBADA",
        "Pago aprobado con SINPE"
      ]
    );
  } catch (_error) {
    // no bloquea el flujo si falla la bitácora
  }

  return {
    ok: true,
    mensaje: "Pago aprobado con SINPE.",
    referenciaBanco
  };
}