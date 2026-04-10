import tsePool from "../config/tse.db.js";

function limpiarCedula(cedula = "") {
  return String(cedula).replace(/\D/g, "").trim();
}

export async function getCiudadanoByCedula(req, res) {
  try {
    const { cedula } = req.params;
    const cedulaLimpia = limpiarCedula(cedula);

    if (!cedulaLimpia) {
      return res.status(400).json({
        success: false,
        message: "La cédula es obligatoria.",
        data: null,
      });
    }

    const [rows] = await tsePool.query(
      `
      SELECT
        cedula,
        nombre_completo,
        fecha_nacimiento,
        provincia,
        canton,
        distrito,
        domicilio_electoral,
        centro_votacion
      FROM ciudadanos
      WHERE cedula = ?
      LIMIT 1
      `,
      [cedulaLimpia]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Ciudadano no encontrado en TSE simulado.",
        data: null,
      });
    }

    const ciudadano = rows[0];

    return res.status(200).json({
      success: true,
      message: "Ciudadano encontrado.",
      data: {
        cedula: ciudadano.cedula,
        nombreCompleto: ciudadano.nombre_completo,
        fechaNacimiento: ciudadano.fecha_nacimiento,
        provincia: ciudadano.provincia,
        canton: ciudadano.canton,
        distrito: ciudadano.distrito,
        domicilioElectoral: ciudadano.domicilio_electoral,
        centroVotacion: ciudadano.centro_votacion,
      },
    });
  } catch (error) {
    console.error("Error en TSE simulado al consultar ciudadano:", error);

    return res.status(500).json({
      success: false,
      message: "Error interno del TSE simulado.",
      detail: error.message,
      data: null,
    });
  }
}