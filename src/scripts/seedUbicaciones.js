import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data/ubicaciones");
const SHOULD_RESET = process.argv.includes("--reset");

async function readJsonFilesFromDirectory() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error("No se encontraron archivos JSON en src/data/ubicaciones");
  }

  const allCountries = [];

  for (const fileName of files) {
    const fullPath = path.join(DATA_DIR, fileName);
    const raw = await fs.readFile(fullPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`El archivo ${fileName} no contiene un arreglo JSON válido.`);
    }

    allCountries.push(...parsed);
  }

  return allCountries;
}

async function countUbicaciones(connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS total FROM ubicaciones"
  );
  return Number(rows[0]?.total ?? 0);
}

async function resetTable(connection) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  await connection.query("TRUNCATE TABLE ubicaciones");
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

function validateNode(node, fileContext = "desconocido") {
  if (!node || typeof node !== "object") {
    throw new Error(`Nodo inválido en ${fileContext}`);
  }

  if (!node.nombre || typeof node.nombre !== "string") {
    throw new Error(`Nodo sin nombre válido en ${fileContext}`);
  }

  if (![1, 2, 3, 4].includes(Number(node.nivel))) {
    throw new Error(`Nodo con nivel inválido (${node.nombre}) en ${fileContext}`);
  }

  if (!node.tipo_sistema || typeof node.tipo_sistema !== "string") {
    throw new Error(`Nodo sin tipo_sistema válido (${node.nombre}) en ${fileContext}`);
  }

  if (!node.tipo_real || typeof node.tipo_real !== "string") {
    throw new Error(`Nodo sin tipo_real válido (${node.nombre}) en ${fileContext}`);
  }

  if (node.children != null && !Array.isArray(node.children)) {
    throw new Error(`children debe ser un arreglo (${node.nombre}) en ${fileContext}`);
  }
}

async function insertNode(connection, node, idPadre = null, paisCodigo = null, fileContext = "desconocido") {
  validateNode(node, fileContext);

  const resolvedPaisCodigo =
    Number(node.nivel) === 1
      ? (node.pais_codigo ?? null)
      : (node.pais_codigo ?? paisCodigo ?? null);

  const [result] = await connection.query(
    `
      INSERT INTO ubicaciones
      (
        nombre,
        nivel,
        tipo_sistema,
        tipo_real,
        id_padre,
        pais_codigo,
        codigo_oficial,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      node.nombre,
      Number(node.nivel),
      node.tipo_sistema,
      node.tipo_real,
      idPadre,
      resolvedPaisCodigo,
      node.codigo_oficial ?? null,
      node.activo ?? 1,
    ]
  );

  const currentId = result.insertId;

  if (Array.isArray(node.children) && node.children.length > 0) {
    for (const child of node.children) {
      await insertNode(
        connection,
        child,
        currentId,
        resolvedPaisCodigo,
        fileContext
      );
    }
  }

  return currentId;
}

async function seedUbicaciones() {
  const connection = await pool.getConnection();

  try {
    const data = await readJsonFilesFromDirectory();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No hay datos válidos para insertar.");
    }

    await connection.beginTransaction();

    const totalActual = await countUbicaciones(connection);

    if (totalActual > 0 && !SHOULD_RESET) {
      throw new Error(
        "La tabla ubicaciones ya tiene datos. Use --reset si desea recargarla."
      );
    }

    if (SHOULD_RESET) {
      console.log("Reiniciando tabla ubicaciones...");
      await resetTable(connection);
    }

    for (const country of data) {
      await insertNode(
        connection,
        country,
        null,
        country.pais_codigo ?? null,
        country.nombre ?? "archivo"
      );
    }

    await connection.commit();

    const totalFinal = await countUbicaciones(connection);

    console.log("=======================================");
    console.log("✅ Seed de ubicaciones completado");
    console.log(`📦 Registros insertados: ${totalFinal}`);
    console.log("=======================================");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error sembrando ubicaciones:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedUbicaciones();