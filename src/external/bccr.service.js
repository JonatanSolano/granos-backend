// src/external/bccr.service.js

const BCCR_BASE_URL =
  process.env.BCCR_BASE_URL ||
  "https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx";

const BCCR_EMAIL = process.env.BCCR_EMAIL || "";
const BCCR_TOKEN = process.env.BCCR_TOKEN || "";
const BCCR_NAME = process.env.BCCR_NAME || "GRANOS_LA_TRADICION";

// Códigos del BCCR
// 317 = compra
// 318 = venta
export const INDICATOR_CODES = {
  compra: "317",
  venta: "318",
};

export function formatDateDDMMYYYY(date = new Date()) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function decodeXmlEntities(text = "") {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractStringNode(xml = "") {
  const match = xml.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
  return match ? match[1].trim() : xml.trim();
}

function getTagValue(xml = "", tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function parseNumericValue(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchIndicatorXml({
  indicator,
  startDate,
  endDate,
  subLevels = "N",
}) {
  if (!BCCR_EMAIL || !BCCR_TOKEN || !BCCR_NAME) {
    throw new Error(
      "Faltan variables de entorno del BCCR. Debes definir BCCR_EMAIL, BCCR_TOKEN y BCCR_NAME."
    );
  }

  const params = new URLSearchParams({
    Indicador: String(indicator),
    FechaInicio: startDate,
    FechaFinal: endDate,
    Nombre: BCCR_NAME,
    SubNiveles: subLevels,
    CorreoElectronico: BCCR_EMAIL,
    Token: BCCR_TOKEN,
  });

  const url = `${BCCR_BASE_URL}/ObtenerIndicadoresEconomicosXML?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/xml, application/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `BCCR respondió con estado ${response.status} ${response.statusText}`
    );
  }

  const xmlText = await response.text();

  if (!xmlText || !xmlText.trim()) {
    throw new Error("El BCCR devolvió una respuesta vacía.");
  }

  return xmlText;
}

function parseIndicatorResponse(xmlText = "") {
  const outerString = extractStringNode(xmlText);
  const innerXml = decodeXmlEntities(outerString);

  if (!innerXml) {
    return [];
  }

  if (
    /No se encontraron datos/i.test(innerXml) ||
    /No hay datos/i.test(innerXml) ||
    /nothing/i.test(innerXml)
  ) {
    return [];
  }

  const results = [];

  const rowRegex =
    /<INGC011_CAT_INDICADORECONOMIC[^>]*>([\s\S]*?)<\/INGC011_CAT_INDICADORECONOMIC>/gi;

  let match;

  while ((match = rowRegex.exec(innerXml)) !== null) {
    const rowXml = match[1];

    const indicator =
      getTagValue(rowXml, "COD_INDICADORINTERNO") ||
      getTagValue(rowXml, "COD_INDICADOR");

    const date =
      getTagValue(rowXml, "DES_FECHA") ||
      getTagValue(rowXml, "Fecha");

    const rawValue =
      getTagValue(rowXml, "NUM_VALOR") ||
      getTagValue(rowXml, "Valor");

    const value = parseNumericValue(rawValue);

    results.push({
      indicatorCode: indicator ? String(indicator) : null,
      date: date || null,
      value,
      rawValue,
    });
  }

  return results.filter((row) => row.value !== null);
}

export async function getIndicatorByCode(indicatorCode, date = new Date()) {
  const formattedDate = formatDateDDMMYYYY(date);

  const xmlText = await fetchIndicatorXml({
    indicator: indicatorCode,
    startDate: formattedDate,
    endDate: formattedDate,
    subLevels: "N",
  });

  const rows = parseIndicatorResponse(xmlText);

  if (!rows.length) {
    return {
      indicatorCode: String(indicatorCode),
      date: formattedDate,
      value: null,
      source: "BCCR",
    };
  }

  const latestRow = rows[rows.length - 1];

  return {
    indicatorCode: String(indicatorCode),
    date: latestRow.date || formattedDate,
    value: latestRow.value,
    source: "BCCR",
  };
}

export async function getExchangeRate(date = new Date()) {
  const [compra, venta] = await Promise.all([
    getIndicatorByCode(INDICATOR_CODES.compra, date),
    getIndicatorByCode(INDICATOR_CODES.venta, date),
  ]);

  return {
    source: "BCCR",
    consultedAt: new Date().toISOString(),
    requestedDate: formatDateDDMMYYYY(date),
    compra,
    venta,
  };
}