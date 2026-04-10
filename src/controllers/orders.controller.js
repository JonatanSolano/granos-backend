import pool from "../config/db.js";

const UPLOADS_BASE_URL = "http://localhost:4000/uploads/";

// ==================================================
// FORMATEAR URL DE IMAGEN
// ==================================================
const formatImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const trimmed = imageUrl.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/uploads/")) {
    return `http://localhost:4000${trimmed}`;
  }

  return `${UPLOADS_BASE_URL}${trimmed}`;
};

// ==================================================
// CREAR PEDIDO
// ==================================================
export const createOrder = async (req, res) => {
  const userId = req.user.id;
  const { items, total } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (!items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: "El pedido debe contener productos"
      });
    }

    for (const item of items) {
      const [productRows] = await connection.query(
        "SELECT stock FROM products WHERE id = ?",
        [item.productId]
      );

      if (productRows.length === 0) {
        throw new Error("Producto no encontrado");
      }

      const stock = productRows[0].stock;

      if (stock < item.quantity) {
        throw new Error(
          "Stock insuficiente para producto ID " + item.productId
        );
      }
    }

    const [orderResult] = await connection.query(
      "INSERT INTO orders (user_id, total, status, estado_entrega) VALUES (?, ?, 'Pendiente', 'Pendiente')",
      [userId, total]
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items 
         (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.price]
      );

      await connection.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.productId]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Pedido creado correctamente",
      orderId
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      error: "Error creando pedido",
      detail: error.message
    });
  } finally {
    connection.release();
  }
};

// ==================================================
// OBTENER PEDIDOS DEL USUARIO
// ==================================================
export const getOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `
      SELECT o.*, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      `,
      [req.user.id]
    );

    const result = [];

    for (const order of orders) {
      const [items] = await pool.query(
        `
        SELECT 
          oi.quantity,
          oi.price,
          p.id AS productId,
          p.name AS nombre,
          p.price AS precio,
          p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
        `,
        [order.id]
      );

      result.push({
        id: order.id,
        userEmail: order.email,
        items: items.map((i) => ({
          quantity: i.quantity,
          price: Number(i.price),
          product: {
            id: i.productId,
            nombre: i.nombre,
            precio: Number(i.precio),
            imagenUrl: formatImageUrl(i.image_url)
          }
        })),
        total: Number(order.total),
        created_at: order.created_at,
        status: order.status,
        estado_entrega: order.estado_entrega ?? "Pendiente"
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo pedidos",
      detail: error.message
    });
  }
};

// ==================================================
// ADMIN - OBTENER TODOS LOS PEDIDOS
// ==================================================
export const getAllOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      `
      SELECT 
        o.id,
        o.total,
        o.status,
        o.estado_entrega,
        o.created_at,
        u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      `
    );

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo pedidos",
      detail: error.message
    });
  }
};

// ==================================================
// ACTUALIZAR ESTADO DE PAGO
// ==================================================
export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      "SELECT status FROM orders WHERE id = ?",
      [id]
    );

    if (orderRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    const currentStatus = orderRows[0].status;

    if (status === "Cancelado" && currentStatus !== "Cancelado") {
      const [items] = await connection.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [id]
      );

      for (const item of items) {
        await connection.query(
          "UPDATE products SET stock = stock + ? WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
    }

    await connection.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, id]
    );

    await connection.commit();

    res.json({
      message: "Estado actualizado correctamente"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      error: "Error actualizando estado",
      detail: error.message
    });
  } finally {
    connection.release();
  }
};

// ==================================================
// ACTUALIZAR ESTADO DE ENTREGA
// ==================================================
export const updateOrderDeliveryStatus = async (req, res) => {
  const { id } = req.params;
  const { estado_entrega } = req.body;

  try {
    const [orderRows] = await pool.query(
      "SELECT id, status FROM orders WHERE id = ?",
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        error: "Pedido no encontrado"
      });
    }

    if (orderRows[0].status !== "Completado") {
      return res.status(400).json({
        error: "Solo se puede actualizar la entrega de pedidos pagados"
      });
    }

    await pool.query(
      "UPDATE orders SET estado_entrega = ? WHERE id = ?",
      [estado_entrega, id]
    );

    res.json({
      message: "Estado de entrega actualizado correctamente"
    });
  } catch (error) {
    res.status(500).json({
      error: "Error actualizando estado de entrega",
      detail: error.message
    });
  }
};

// ==================================================
// ELIMINAR PEDIDO
// ==================================================
export const deleteOrder = async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM order_items WHERE order_id = ?",
      [id]
    );

    await connection.query(
      "DELETE FROM orders WHERE id = ?",
      [id]
    );

    await connection.commit();

    res.json({
      message: "Pedido eliminado correctamente"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      error: "Error eliminando pedido",
      detail: error.message
    });
  } finally {
    connection.release();
  }
};