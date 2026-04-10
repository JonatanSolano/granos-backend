import bankDb from "../config/bank.db.js";

function generarReferencia() {
  return `BANK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function registrarTransaccion({
  numeroTarjeta,
  monto,
  tipoMovimiento,
  estado,
  referenciaExterna = null,
  detalle = null
}) {
  await bankDb.execute(
    `
    INSERT INTO transacciones_bancarias
    (numero_tarjeta, monto, tipo_movimiento, estado, referencia_externa, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [numeroTarjeta, monto, tipoMovimiento, estado, referenciaExterna, detalle]
  );
}

export async function validarTarjeta({
  numeroTarjeta,
  nombreTitular,
  fechaExpiracion,
  cvv
}) {
  const [rows] = await bankDb.execute(
    `
    SELECT *
    FROM tarjetas
    WHERE numero_tarjeta = ?
      AND nombre_titular = ?
      AND fecha_expiracion = ?
      AND cvv = ?
    LIMIT 1
    `,
    [numeroTarjeta, nombreTitular, fechaExpiracion, cvv]
  );

  if (rows.length === 0) {
    return {
      ok: false,
      mensaje: "Tarjeta inválida"
    };
  }

  const tarjeta = rows[0];

  if (tarjeta.estado !== "activa") {
    return {
      ok: false,
      mensaje: `Tarjeta ${tarjeta.estado}`
    };
  }

  return {
    ok: true,
    mensaje: "Tarjeta válida",
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
    await registrarTransaccion({
      numeroTarjeta,
      monto,
      tipoMovimiento: "debito",
      estado: "rechazada",
      referenciaExterna,
      detalle: validacion.mensaje
    });

    return {
      ok: false,
      mensaje: validacion.mensaje
    };
  }

  const tarjeta = validacion.tarjeta;
  const montoNumerico = Number(monto);

  if (Number.isNaN(montoNumerico) || montoNumerico <= 0) {
    await registrarTransaccion({
      numeroTarjeta,
      monto,
      tipoMovimiento: "debito",
      estado: "rechazada",
      referenciaExterna,
      detalle: "Monto inválido"
    });

    return {
      ok: false,
      mensaje: "Monto inválido"
    };
  }

  if (tarjeta.tipo_tarjeta === "debito") {
    if (Number(tarjeta.saldo) < montoNumerico) {
      await registrarTransaccion({
        numeroTarjeta,
        monto,
        tipoMovimiento: "debito",
        estado: "rechazada",
        referenciaExterna,
        detalle: "Fondos insuficientes"
      });

      return {
        ok: false,
        mensaje: "Fondos insuficientes"
      };
    }

    const nuevoSaldo = Number(tarjeta.saldo) - montoNumerico;

    await bankDb.execute(
      `
      UPDATE tarjetas
      SET saldo = ?
      WHERE id = ?
      `,
      [nuevoSaldo, tarjeta.id]
    );

    const referenciaBanco = generarReferencia();

    await registrarTransaccion({
      numeroTarjeta,
      monto,
      tipoMovimiento: "debito",
      estado: "aprobada",
      referenciaExterna: referenciaExterna || referenciaBanco,
      detalle: "Pago aprobado"
    });

    return {
      ok: true,
      mensaje: "Pago aprobado",
      referenciaBanco,
      tipoTarjeta: tarjeta.tipo_tarjeta,
      saldoRestante: nuevoSaldo
    };
  }

  if (tarjeta.tipo_tarjeta === "credito") {
    if (Number(tarjeta.limite_credito) < montoNumerico) {
      await registrarTransaccion({
        numeroTarjeta,
        monto,
        tipoMovimiento: "debito",
        estado: "rechazada",
        referenciaExterna,
        detalle: "Límite insuficiente"
      });

      return {
        ok: false,
        mensaje: "Límite insuficiente"
      };
    }

    const nuevoLimite = Number(tarjeta.limite_credito) - montoNumerico;

    await bankDb.execute(
      `
      UPDATE tarjetas
      SET limite_credito = ?
      WHERE id = ?
      `,
      [nuevoLimite, tarjeta.id]
    );

    const referenciaBanco = generarReferencia();

    await registrarTransaccion({
      numeroTarjeta,
      monto,
      tipoMovimiento: "debito",
      estado: "aprobada",
      referenciaExterna: referenciaExterna || referenciaBanco,
      detalle: "Pago aprobado"
    });

    return {
      ok: true,
      mensaje: "Pago aprobado",
      referenciaBanco,
      tipoTarjeta: tarjeta.tipo_tarjeta,
      limiteDisponible: nuevoLimite
    };
  }

  await registrarTransaccion({
    numeroTarjeta,
    monto,
    tipoMovimiento: "debito",
    estado: "rechazada",
    referenciaExterna,
    detalle: "Tipo de tarjeta no soportado"
  });

  return {
    ok: false,
    mensaje: "Tipo de tarjeta no soportado"
  };
}

export async function consultarTarjeta(numeroTarjeta) {
  const [rows] = await bankDb.execute(
    `
    SELECT
      numero_tarjeta,
      nombre_titular,
      cedula_titular,
      fecha_expiracion,
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

  if (rows.length === 0) {
    return {
      ok: false,
      mensaje: "Tarjeta no encontrada"
    };
  }

  return {
    ok: true,
    mensaje: "Tarjeta encontrada",
    tarjeta: rows[0]
  };
}

export async function obtenerTarjetasPrueba() {
  const [rows] = await bankDb.execute(
    `
    SELECT
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
    ORDER BY id ASC
    `
  );

  return rows.map((row) => ({
    numeroTarjeta: row.numero_tarjeta,
    nombreTitular: row.nombre_titular,
    fechaExpiracion: row.fecha_expiracion,
    cvv: row.cvv,
    tipoTarjeta: row.tipo_tarjeta,
    marca: row.marca,
    saldo: row.saldo,
    limiteCredito: row.limite_credito,
    estado: row.estado
  }));
}

export async function consultarCuentaSinpe(telefono) {
  const [rows] = await bankDb.execute(
    `
    SELECT
      id,
      telefono,
      cedula,
      nombre_titular,
      saldo,
      activo,
      created_at
    FROM sinpe_cuentas
    WHERE telefono = ?
    LIMIT 1
    `,
    [telefono]
  );

  if (rows.length === 0) {
    return {
      ok: false,
      mensaje: "Número SINPE no registrado"
    };
  }

  return {
    ok: true,
    mensaje: "Cuenta SINPE encontrada",
    cuenta: rows[0]
  };
}

async function registrarTransaccionSinpe({
  telefono,
  nombreTitular,
  monto,
  estado,
  referencia,
  detalle = null
}) {
  await bankDb.execute(
    `
    INSERT INTO transacciones_sinpe
    (telefono, nombre_titular, monto, estado, referencia, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [telefono, nombreTitular, monto, estado, referencia, detalle]
  );
}

export async function procesarPagoSinpe({
  telefono,
  monto,
  referenciaExterna
}) {
  const montoNumerico = Number(monto);

  if (Number.isNaN(montoNumerico) || montoNumerico <= 0) {
    await registrarTransaccionSinpe({
      telefono,
      nombreTitular: "Desconocido",
      monto,
      estado: "rechazada",
      referencia: referenciaExterna || generarReferencia(),
      detalle: "Monto inválido"
    });

    return {
      ok: false,
      mensaje: "Monto inválido"
    };
  }

  const consulta = await consultarCuentaSinpe(telefono);

  if (!consulta.ok) {
    await registrarTransaccionSinpe({
      telefono,
      nombreTitular: "Desconocido",
      monto,
      estado: "rechazada",
      referencia: referenciaExterna || generarReferencia(),
      detalle: consulta.mensaje
    });

    return {
      ok: false,
      mensaje: consulta.mensaje
    };
  }

  const cuenta = consulta.cuenta;

  if (Number(cuenta.activo) !== 1) {
    await registrarTransaccionSinpe({
      telefono,
      nombreTitular: cuenta.nombre_titular,
      monto,
      estado: "rechazada",
      referencia: referenciaExterna || generarReferencia(),
      detalle: "Cuenta SINPE inactiva"
    });

    return {
      ok: false,
      mensaje: "Cuenta SINPE inactiva"
    };
  }

  if (Number(cuenta.saldo) < montoNumerico) {
    await registrarTransaccionSinpe({
      telefono,
      nombreTitular: cuenta.nombre_titular,
      monto,
      estado: "rechazada",
      referencia: referenciaExterna || generarReferencia(),
      detalle: "Fondos insuficientes"
    });

    return {
      ok: false,
      mensaje: "Fondos insuficientes en SINPE"
    };
  }

  const nuevoSaldo = Number(cuenta.saldo) - montoNumerico;
  const referenciaBanco = generarReferencia();

  await bankDb.execute(
    `
    UPDATE sinpe_cuentas
    SET saldo = ?
    WHERE id = ?
    `,
    [nuevoSaldo, cuenta.id]
  );

  await registrarTransaccionSinpe({
    telefono,
    nombreTitular: cuenta.nombre_titular,
    monto,
    estado: "aprobada",
    referencia: referenciaExterna || referenciaBanco,
    detalle: "Pago SINPE aprobado"
  });

  return {
    ok: true,
    mensaje: "Pago SINPE aprobado",
    referenciaBanco,
    saldoRestante: nuevoSaldo,
    titular: cuenta.nombre_titular,
    telefono
  };
}

export async function obtenerCuentasSinpePrueba() {
  const [rows] = await bankDb.execute(
    `
    SELECT
      telefono,
      cedula,
      nombre_titular,
      saldo,
      activo,
      created_at
    FROM sinpe_cuentas
    ORDER BY id ASC
    `
  );

  return rows.map((row) => ({
    telefono: row.telefono,
    cedula: row.cedula,
    nombreTitular: row.nombre_titular,
    saldo: row.saldo,
    activo: Number(row.activo) === 1,
    createdAt: row.created_at
  }));
}