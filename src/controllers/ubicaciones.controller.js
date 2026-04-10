import ubicacionesService from "../services/ubicaciones.service.js";

export const getPaises = async (req, res) => {
  try {
    const paises = await ubicacionesService.getPaises();
    return res.status(200).json(paises);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo países",
      detail: error.message,
    });
  }
};

export const getHijos = async (req, res) => {
  try {
    const idPadre = Number(req.params.idPadre);

    if (!Number.isInteger(idPadre) || idPadre <= 0) {
      return res.status(400).json({
        error: "idPadre inválido",
      });
    }

    const hijos = await ubicacionesService.getHijos(idPadre);
    return res.status(200).json(hijos);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo ubicaciones hijas",
      detail: error.message,
    });
  }
};

export const getRutaByUbicacionId = async (req, res) => {
  try {
    const idUbicacion = Number(req.params.idUbicacion);

    if (!Number.isInteger(idUbicacion) || idUbicacion <= 0) {
      return res.status(400).json({
        error: "idUbicacion inválido",
      });
    }

    const path = await ubicacionesService.getRutaByUbicacionId(idUbicacion);

    return res.status(200).json({
      path,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo ruta de ubicación",
      detail: error.message,
    });
  }
};