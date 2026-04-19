import axios from "axios";

const BCCR_BASE_URL =
  process.env.BCCR_BASE_URL ||
  "https://apim.bccr.fi.cr/SDDE/api/Bccr.Ge.SDDE.Publico.Indicadores.API";

const BCCR_TOKEN = process.env.BCCR_TOKEN;

// Códigos históricos usados para tipo de cambio
const INDICADOR_COMPRA = process.env.BCCR_INDICADOR_COMPRA || "317";
const INDICADOR_VENTA = process.env.BCCR_INDICADOR_VENTA || "318";

function formatDateForBCCR(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function buildHeaders() {
  if (!BCCR_TOKEN) {
    throw new Error("No se encontró BCCR_TOKEN en las variables de entorno.");
  }

  return {
    Authorization: `Bearer ${BCCR_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function pickSeriesArray(data) {
  if (!data) return [];

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.series)) return data.series;
  if (Array.isArray(data.Serie)) return data.Serie;
  if (Array.isArray(data.Datos)) return data.Datos;

  return [];
}

function parseValor(item) {
  const candidates = [
    item?.valor,
    item?.Valor,
    item?.value,
    item?.Value,
    item?.monto,
    item?.Monto,
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") {
      const n = Number(String(c).replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
  }

  return null;
}

function parseFecha(item) {
  return (
    item?.fecha ||
    item?.Fecha ||
    item?.date ||
    item?.Date ||
    new Date().toISOString().split("T")[0]
  );
}

async function consultarIndicador(codigo, fechaInicio, fechaFin) {
  const url = `${BCCR_BASE_URL}/indicadoresEconomicos/${codigo}/series`;

  const response = await axios.get(url, {
    headers: buildHeaders(),
    params: {
      fechaInicio,
      fechaFin,
      idioma: "ES",
    },
    timeout: 15000,
  });

  const rows = pickSeriesArray(response.data);

  if (!rows.length) {
    return {
      valor: null,
      fecha: new Date().toISOString().split("T")[0],
      raw: response.data,
    };
  }

  // Tomamos el último valor disponible
  const last = rows[rows.length - 1];

  return {
    valor: parseValor(last),
    fecha: parseFecha(last),
    raw: response.data,
  };
}

export async function obtenerTipoCambioBCCR() {
  const hoy = new Date();
  const fechaFin = formatDateForBCCR(hoy);

  // margen pequeño por si hoy no tiene dato aún
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 3);
  const fechaInicio = formatDateForBCCR(ayer);

  try {
    const [compraRes, ventaRes] = await Promise.all([
      consultarIndicador(INDICADOR_COMPRA, fechaInicio, fechaFin),
      consultarIndicador(INDICADOR_VENTA, fechaInicio, fechaFin),
    ]);

    return {
      ok: true,
      compra: compraRes.valor,
      venta: ventaRes.valor,
      fecha: ventaRes.fecha || compraRes.fecha,
      fuente: "BCCR",
    };
  } catch (error) {
    const status = error.response?.status || error.status || 500;
    const detail =
      error.response?.data ||
      error.detail ||
      error.message ||
      "Error desconocido";

    throw {
      status,
      message: "No se pudo obtener el tipo de cambio desde BCCR.",
      detail,
    };
  }
}

export async function obtenerTipoCambioMock() {
  return {
    ok: true,
    compra: 461.92,
    venta: 467.22,
    fecha: new Date().toISOString().split("T")[0],
    fuente: "BCCR-MOCK",
  };
}

export async function obtenerTipoCambio() {
  const useMock =
    String(process.env.USE_BCCR_MOCK || "false").toLowerCase() === "true";

  if (useMock) {
    return obtenerTipoCambioMock();
  }

  return obtenerTipoCambioBCCR();
}