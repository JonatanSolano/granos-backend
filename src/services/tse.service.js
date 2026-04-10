const TSE_SIMULADO_BASE_URL =
  process.env.TSE_SIMULADO_BASE_URL || "http://localhost:4000";

function limpiarCedula(cedula = "") {
  return String(cedula).replace(/\D/g, "").trim();
}

export async function consultarCiudadanoPorCedula(cedula) {
  const cedulaLimpia = limpiarCedula(cedula);

  if (!cedulaLimpia) {
    throw new Error("La cédula es obligatoria.");
  }

  const url = `${TSE_SIMULADO_BASE_URL}/api/tse/ciudadanos/${cedulaLimpia}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("El TSE simulado devolvió una respuesta inválida.");
  }

  if (response.status === 404) {
    return {
      found: false,
      data: null,
      message:
        payload?.message || "Ciudadano no encontrado en TSE simulado.",
    };
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        `Error consultando TSE simulado: ${response.status} ${response.statusText}`
    );
  }

  const ciudadano = payload?.data || payload;

  return {
    found: true,
    message: payload?.message || "Ciudadano encontrado.",
    data: {
      cedula: ciudadano.cedula ?? cedulaLimpia,
      nombreCompleto:
        ciudadano.nombreCompleto ??
        ciudadano.nombre_completo ??
        "",
      fechaNacimiento:
        ciudadano.fechaNacimiento ??
        ciudadano.fecha_nacimiento ??
        null,
      provincia: ciudadano.provincia ?? "",
      canton: ciudadano.canton ?? "",
      distrito: ciudadano.distrito ?? "",
      domicilioElectoral:
        ciudadano.domicilioElectoral ??
        ciudadano.domicilio_electoral ??
        "",
      centroVotacion:
        ciudadano.centroVotacion ??
        ciudadano.centro_votacion ??
        "",
    },
  };
}