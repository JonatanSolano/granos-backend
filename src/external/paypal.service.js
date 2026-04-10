function getPayPalConfig() {
  return {
    baseUrl: (process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com").trim(),
    clientId: (process.env.PAYPAL_CLIENT_ID || "").trim(),
    clientSecret: (process.env.PAYPAL_CLIENT_SECRET || "").trim(),
  };
}

function validarCredencialesPayPal() {
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();

  console.log("[PayPal] baseUrl:", baseUrl);
  console.log("[PayPal] clientId cargado:", !!clientId, "len:", clientId.length);
  console.log(
    "[PayPal] clientId preview:",
    clientId ? `${clientId.slice(0, 6)}...${clientId.slice(-6)}` : "VACIO"
  );
  console.log(
    "[PayPal] clientSecret cargado:",
    !!clientSecret,
    "len:",
    clientSecret.length
  );
  console.log(
    "[PayPal] clientSecret preview:",
    clientSecret ? `${clientSecret.slice(0, 4)}...${clientSecret.slice(-4)}` : "VACIO"
  );

  if (!clientId || !clientSecret) {
    throw new Error("Faltan credenciales PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET");
  }

  return { clientId, clientSecret, baseUrl };
}

async function parsearRespuesta(response) {
  const rawText = await response.text();

  if (!rawText || rawText.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (_) {
    return { raw: rawText };
  }
}

function extraerMensajePayPal(data, fallback) {
  if (!data) return fallback;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data.error_description) {
    return data.error_description;
  }

  if (data.message) {
    return data.message;
  }

  if (data.name && data.details?.length > 0) {
    const detail = data.details[0];
    if (detail?.description) {
      return `${data.name}: ${detail.description}`;
    }
  }

  if (data.details?.length > 0) {
    const detail = data.details[0];
    if (detail?.description) {
      return detail.description;
    }
  }

  if (data.name) {
    return data.name;
  }

  return fallback;
}

async function obtenerAccessToken() {
  const { clientId, clientSecret, baseUrl } = validarCredencialesPayPal();

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await parsearRespuesta(response);

  console.log("[PayPal] OAuth status:", response.status);
  console.log("[PayPal] OAuth response:", data);

  if (!response.ok) {
    throw new Error(
      extraerMensajePayPal(
        data,
        "No se pudo obtener access token de PayPal"
      )
    );
  }

  if (!data.access_token) {
    throw new Error("PayPal no devolvió access_token válido");
  }

  return data.access_token;
}

export async function crearOrdenPayPal({
  orderId,
  monto,
  moneda = "USD",
}) {
  const { baseUrl } = getPayPalConfig();
  const montoNormalizado = Number(monto);

  if (Number.isNaN(montoNormalizado) || montoNormalizado <= 0) {
    throw new Error("El monto enviado a PayPal es inválido");
  }

  const accessToken = await obtenerAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `ORDER-${orderId}`,
          amount: {
            currency_code: moneda,
            value: montoNormalizado.toFixed(2),
          },
        },
      ],
    }),
  });

  const data = await parsearRespuesta(response);

  console.log("[PayPal] Create order status:", response.status);
  console.log("[PayPal] Create order response:", data);

  if (!response.ok) {
    throw new Error(
      extraerMensajePayPal(
        data,
        "No se pudo crear la orden PayPal"
      )
    );
  }

  if (!data.id) {
    throw new Error("PayPal no devolvió un id de orden válido");
  }

  return data;
}

export async function capturarOrdenPayPal(paypalOrderId) {
  const { baseUrl } = getPayPalConfig();

  if (!paypalOrderId) {
    throw new Error("Falta paypalOrderId para capturar la orden");
  }

  const accessToken = await obtenerAccessToken();

  const response = await fetch(
    `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation",
      },
    }
  );

  const data = await parsearRespuesta(response);

  console.log("[PayPal] Capture order status:", response.status);
  console.log("[PayPal] Capture order response:", data);

  if (!response.ok) {
    throw new Error(
      extraerMensajePayPal(
        data,
        "No se pudo capturar la orden PayPal"
      )
    );
  }

  return data;
}