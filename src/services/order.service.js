const db = require("../config/db");

exports.createOrder = async (userId, items, total) => {

  const [result] = await db.query(
    "INSERT INTO orders (user_id, total, status, estado_entrega) VALUES (?, ?, 'Pendiente', 'Pendiente')",
    [userId, total]
  );

  const orderId = result.insertId;

  // INSERTAR ITEMS
  for (const item of items) {
    await db.query(
      "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
      [
        orderId,
        item.productId,
        item.quantity,
        item.price
      ]
    );
  }

  return orderId;
};

exports.getOrdersByUser = async (userId) => {

  const [orders] = await db.query(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  return orders;
};

exports.getAllOrders = async () => {

  const [orders] = await db.query(`
    SELECT 
      o.*,
      u.email AS user_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `);

  return orders;
};

exports.updateOrderStatus = async (orderId, status) => {

  await db.query(
    "UPDATE orders SET status = ? WHERE id = ?",
    [status, orderId]
  );

};

exports.updateEstadoEntrega = async (orderId, estadoEntrega) => {

  await db.query(
    "UPDATE orders SET estado_entrega = ? WHERE id = ?",
    [estadoEntrega, orderId]
  );

};