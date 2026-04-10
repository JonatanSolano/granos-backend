// src/controllers/economy.controller.js

import {
  getExchangeRate,
  getIndicatorByCode,
} from "../external/bccr.service.js";

function parseDateFromQuery(dateString) {
  if (!dateString) return new Date();

  const parsed = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function getTipoCambio(req, res) {
  try {
    const { date, tipo } = req.query;
    const parsedDate = parseDateFromQuery(date);

    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "La fecha enviada no es válida. Usa formato YYYY-MM-DD.",
      });
    }

    if (tipo && !["compra", "venta"].includes(tipo.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "El parámetro 'tipo' solo puede ser 'compra' o 'venta'.",
      });
    }

    if (tipo) {
      const indicatorCode = tipo.toLowerCase() === "compra" ? "317" : "318";
      const result = await getIndicatorByCode(indicatorCode, parsedDate);

      return res.status(200).json({
        success: true,
        message: `Tipo de cambio ${tipo.toLowerCase()} obtenido correctamente desde BCCR.`,
        data: {
          source: result.source,
          tipo: tipo.toLowerCase(),
          indicatorCode: result.indicatorCode,
          date: result.date,
          value: result.value,
        },
      });
    }

    const result = await getExchangeRate(parsedDate);

    return res.status(200).json({
      success: true,
      message: "Tipo de cambio obtenido correctamente desde BCCR.",
      data: result,
    });
  } catch (error) {
    console.error("Error al consultar tipo de cambio BCCR:", error);

    return res.status(500).json({
      success: false,
      message: "No fue posible consultar el tipo de cambio del BCCR.",
      error: error.message,
    });
  }
}