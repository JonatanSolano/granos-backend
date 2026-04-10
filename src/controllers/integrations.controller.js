import { consultarCiudadanoPorCedula } from "../external/tse.service.js";

function limpiarCedula(cedula = "") {
  return String(cedula).replace(/\D/g, "").trim();
}

export async function consultarCedulaTSE(req, res) {
  try {
    const { cedula } = req.params;
    const cedulaLimpia = limpiarCedula(cedula);

    if (!cedulaLimpia) {
      return res.status(400).json({
        success: false,
        message: "La cédula es obligatoria.",
        data: null
      });
    }

    if (cedulaLimpia.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La cédula ingresada no es válida.",
        data: null
      });
    }

    const result = await consultarCiudadanoPorCedula(cedulaLimpia);

    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: result.message || "Ciudadano no encontrado en TSE simulado.",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message || "Ciudadano encontrado.",
      data: result.data
    });
  } catch (error) {
    console.error("Error al consultar cédula en TSE simulado:", error);

    return res.status(500).json({
      success: false,
      message: "No fue posible consultar el TSE simulado.",
      detail: error.message,
      data: null
    });
  }
}