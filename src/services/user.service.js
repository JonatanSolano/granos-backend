import pool from "../config/db.js";

const baseSelect = `
  SELECT
    id,
    nombre,
    nivel,
    tipo_sistema AS tipoSistema,
    tipo_real AS tipoReal,
    id_padre AS idPadre,
    pais_codigo AS paisCodigo,
    codigo_oficial AS codigoOficial,
    activo
  FROM ubicaciones
`;

const getPaises = async () => {
  const [rows] = await pool.query(
    `${baseSelect}
     WHERE nivel = 1
       AND activo = 1
     ORDER BY nombre ASC`
  );

  return rows;
};

const getHijos = async (idPadre) => {
  const [rows] = await pool.query(
    `${baseSelect}
     WHERE id_padre = ?
       AND activo = 1
     ORDER BY nombre ASC`,
    [idPadre]
  );

  return rows;
};

const getRutaByUbicacionId = async (idUbicacion) => {
  const path = [];
  let currentId = idUbicacion;

  while (currentId) {
    const [rows] = await pool.query(
      `${baseSelect}
       WHERE id = ?
       LIMIT 1`,
      [currentId]
    );

    if (rows.length === 0) {
      break;
    }

    const current = rows[0];
    path.unshift(current);
    currentId = current.idPadre;
  }

  return path;
};

const validateFinalUbicacion = async (executor, ubicacionId) => {
  if (ubicacionId == null) {
    return null;
  }

  const numericId = Number(ubicacionId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Ubicación inválida.");
  }

  const [rows] = await executor.query(
    `SELECT id, nivel
     FROM ubicaciones
     WHERE id = ?
       AND activo = 1
     LIMIT 1`,
    [numericId]
  );

  if (rows.length === 0) {
    throw new Error("La ubicación seleccionada no existe.");
  }

  if (Number(rows[0].nivel) !== 4) {
    throw new Error("Debe seleccionar una ubicación final válida.");
  }

  return numericId;
};

export default {
  getPaises,
  getHijos,
  getRutaByUbicacionId,
  validateFinalUbicacion,
};