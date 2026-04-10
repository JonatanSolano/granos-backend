import pool from "../config/db.js";

const BASE_URL = "http://localhost:4000/uploads/";

// ======================================
// NORMALIZAR IMAGEN PARA GUARDAR EN DB
// ======================================

const normalizeImageForDatabase = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const trimmed = imageUrl.trim();

  if (!trimmed) {
    return null;
  }

  // Si viene URL completa, guardar solo el nombre del archivo
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const lastPart = trimmed.split("/").pop();
    return lastPart || null;
  }

  // Si viene con /uploads/archivo.jpg, guardar solo archivo.jpg
  if (trimmed.includes("/uploads/")) {
    const lastPart = trimmed.split("/").pop();
    return lastPart || null;
  }

  // Si ya viene solo el nombre del archivo, dejarlo así
  return trimmed;
};

// ======================================
// FORMATEAR IMAGEN PARA RESPUESTA API
// ======================================

const formatProduct = (product) => {
  let finalImageUrl = null;

  if (product.image_url && typeof product.image_url === "string") {
    const trimmed = product.image_url.trim();

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      finalImageUrl = trimmed;
    } else if (trimmed) {
      finalImageUrl = `${BASE_URL}${trimmed}`;
    }
  }

  return {
    ...product,
    image_url: finalImageUrl,
  };
};

// ======================================
// OBTENER TODOS LOS PRODUCTOS
// ======================================

export const getAllProducts = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM products ORDER BY id DESC"
  );

  return rows.map(formatProduct);
};

// ======================================
// OBTENER PRODUCTOS ACTIVOS
// ======================================

export const getActiveProducts = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE active = true ORDER BY id DESC"
  );

  return rows.map(formatProduct);
};

// ======================================
// OBTENER PRODUCTO POR ID
// ======================================

export const getProductById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE id = ?",
    [id]
  );

  if (rows.length === 0) return null;

  return formatProduct(rows[0]);
};

// ======================================
// BUSCAR PRODUCTOS
// ======================================

export const searchProducts = async (query) => {
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE name LIKE ? AND active = true",
    [`%${query}%`]
  );

  return rows.map(formatProduct);
};

// ======================================
// CREAR PRODUCTO
// ======================================

export const createProduct = async (product) => {
  const {
    name,
    description,
    price,
    stock,
    image_url
  } = product;

  const dbImageUrl = normalizeImageForDatabase(image_url);

  const [result] = await pool.query(
    `INSERT INTO products 
    (name, description, price, stock, image_url, active)
    VALUES (?, ?, ?, ?, ?, true)`,
    [
      name,
      description || "",
      price,
      stock || 0,
      dbImageUrl
    ]
  );

  return result.insertId;
};

// ======================================
// ACTUALIZAR PRODUCTO
// ======================================

export const updateProduct = async (id, product) => {
  const {
    name,
    description,
    price,
    stock,
    active,
    image_url
  } = product;

  const dbImageUrl = normalizeImageForDatabase(image_url);

  await pool.query(
    `UPDATE products
     SET name=?, description=?, price=?, stock=?, active=?, image_url=?
     WHERE id=?`,
    [
      name,
      description,
      price,
      stock,
      active,
      dbImageUrl,
      id
    ]
  );
};

// ======================================
// ACTUALIZAR SOLO STOCK
// ======================================

export const updateStock = async (id, stock) => {
  await pool.query(
    "UPDATE products SET stock = ? WHERE id = ?",
    [stock, id]
  );
};

// ======================================
// ACTIVAR / DESACTIVAR PRODUCTO
// ======================================

export const toggleProductStatus = async (id) => {
  await pool.query(
    "UPDATE products SET active = NOT active WHERE id = ?",
    [id]
  );
};

// ======================================
// ELIMINAR PRODUCTO
// ======================================

export const deleteProduct = async (id) => {
  await pool.query(
    "DELETE FROM products WHERE id = ?",
    [id]
  );
};