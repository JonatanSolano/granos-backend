import axios from "axios";

const BCCR_BASE_URL =
  process.env.BCCR_BASE_URL ||
  "https://sdd.bccr.fi.cr/IndicadoresEconomicos/api";

const BCCR_TOKEN = process.env.BCCR_TOKEN;

/**
 * Normaliza distintos posibles formatos de respuesta del API
 * para dejar un objeto estándar en el proyecto.
 */
function normalizarTipoCambio(data) {
  // Caso 1: el API ya devuelve compra/venta directos
  if (
    data &&
    typeof data === "object" &&
    data.compra !== undefined &&
    data.venta !== undefined
  ) {
    return {
      compra: Number(data.compra),
      venta: Number(data.venta),
      fecha: data.fecha || new Date().toISOString().split("T")[0],
      fuente: "BCCR"
    };
  }

  // Caso 2: viene una lista / arreglo de indicadores
  if (Array.isArray(data)) {
    const compraItem = data.find((item) =>
      String(item?.nombre || item?.indicador || "")
        .toLowerCase()
        .includes("compra")
    );

    const ventaItem = data.find((item) =>
      String(item?.nombre || item?.indicador || "")
        .toLowerCase()
        .includes("venta")
    );

    return {
      compra: compraItem ? Number(compraItem.valor ?? compraItem.value ?? 0) : null,
      venta: ventaItem ? Number(ventaItem.valor ?? ventaItem.value ?? 0) : null,
      fecha:
        compraItem?.fecha ||
        ventaItem?.fecha ||
        new Date().toISOString().split("T")[0],
      fuente: "BCCR"
    };
  }

  // Caso 3: el API devuelve un objeto con items internos
  if (data?.items && Array.isArray(data.items)) {
    return normalizarTipoCambio(data.items);
  }

  // Caso 4: fallback total
  return {
    compra: null,
    venta: null,
    fecha: new Date().toISOString().split("T")[0],
    fuente: "BCCR",
    raw: data
  };
}

/**
 * Construye headers de autenticación.
 */
function buildHeaders() {
  if (!BCCR_TOKEN) {
    throw new Error(
      "No se encontró BCCR_TOKEN en las variables de entorno."
    );
  }

  return {
    Authorization: `Bearer ${BCCR_TOKEN}`,
    Accept: "application/json"
  };
}

/**
 * Intenta consultar el API del BCCR.
 *
 * NOTA:
 * Como el endpoint exacto puede variar según el estándar/API del portal,
 * aquí dejamos una estrategia flexible:
 *
 * 1) Primero intenta un endpoint directo configurable en .env
 * 2) Si no existe, usa un endpoint por defecto para tu integración
 *
 * Puedes ajustar BCCR_TIPO_CAMBIO_PATH cuando ya confirmes el path exacto.
 */
export async function obtenerTipoCambioBCCR() {
  const endpointPath =
    process.env.BCCR_TIPO_CAMBIO_PATH || "/tipocambio";

  const url = `${BCCR_BASE_URL}${endpointPath}`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      timeout: 15000
    });

    const normalizado = normalizarTipoCambio(response.data);

    return {
      ok: true,
      ...normalizado
    };
  } catch (error) {
    const status = error.response?.status || 500;
    const detalle =
      error.response?.data || error.message || "Error desconocido";

    throw {
      status,
      message: "No se pudo obtener el tipo de cambio desde BCCR.",
      detail: detalle
    };
  }
}

/**
 * Método de respaldo para desarrollo/demo.
 * Útil si el API real no está listo todavía.
 */
export async function obtenerTipoCambioMock() {
  return {
    ok: true,
    compra: 461.92,
    venta: 467.22,
    fecha: new Date().toISOString().split("T")[0],
    fuente: "BCCR-MOCK"
  };
}

/**
 * Método principal del sistema:
 * - Si USE_BCCR_MOCK=true, devuelve datos simulados
 * - Si no, intenta el API real
 */
export async function obtenerTipoCambio() {
  const useMock = String(process.env.USE_BCCR_MOCK || "false").toLowerCase() === "true";

  if (useMock) {
    return obtenerTipoCambioMock();
  }

  return obtenerTipoCambioBCCR();
}