import pool from "../config/db.js";

// ======================================
// DASHBOARD ADMIN / ESTADÍSTICAS PRO
// ======================================
export const getDashboardStats = async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT COUNT(*) AS totalUsuarios FROM users WHERE role = 'cliente'"
    );

    const [orders] = await pool.query(
      "SELECT COUNT(*) AS totalPedidos FROM orders"
    );

    const [sales] = await pool.query(
      "SELECT IFNULL(SUM(total),0) AS ventasTotales FROM orders WHERE status != 'Cancelado'"
    );

    const [pendingOrders] = await pool.query(
      "SELECT COUNT(*) AS pedidosPendientes FROM orders WHERE status = 'Pendiente'"
    );

    const [completedOrders] = await pool.query(
      "SELECT COUNT(*) AS pedidosCompletados FROM orders WHERE status = 'Completado'"
    );

    const [cancelledOrders] = await pool.query(
      "SELECT COUNT(*) AS pedidosCancelados FROM orders WHERE status = 'Cancelado'"
    );

    const [deliveryPending] = await pool.query(
      "SELECT COUNT(*) AS entregasPendientes FROM orders WHERE estado_entrega = 'Pendiente' AND status = 'Completado'"
    );

    const [deliveryOnWay] = await pool.query(
      "SELECT COUNT(*) AS entregasEnCamino FROM orders WHERE estado_entrega = 'En camino' AND status = 'Completado'"
    );

    const [deliveryDelivered] = await pool.query(
      "SELECT COUNT(*) AS entregasEntregadas FROM orders WHERE estado_entrega = 'Entregado' AND status = 'Completado'"
    );

    const [activeProducts] = await pool.query(
      "SELECT COUNT(*) AS productosActivos FROM products WHERE active = 1"
    );

    const [inactiveProducts] = await pool.query(
      "SELECT COUNT(*) AS productosInactivos FROM products WHERE active = 0"
    );

    const [lowStockCount] = await pool.query(
      "SELECT COUNT(*) AS productosBajoStock FROM products WHERE stock <= 5"
    );

    const [topProducts] = await pool.query(`
      SELECT 
        p.name,
        SUM(oi.quantity) AS vendidos
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id
      ORDER BY vendidos DESC
      LIMIT 5
    `);

    const [leastSoldProduct] = await pool.query(`
      SELECT 
        p.name,
        SUM(oi.quantity) AS vendidos
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id
      ORDER BY vendidos ASC
      LIMIT 1
    `);

    const [bestOrder] = await pool.query(`
      SELECT IFNULL(MAX(total),0) AS pedidoMasAlto
      FROM orders
      WHERE status != 'Cancelado'
    `);

    const [avgTicket] = await pool.query(`
      SELECT IFNULL(AVG(total),0) AS ticketPromedio
      FROM orders
      WHERE status != 'Cancelado'
    `);

    const [monthlySales] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS mes,
        SUM(total) AS ventas
      FROM orders
      WHERE status != 'Cancelado'
      GROUP BY mes
      ORDER BY mes ASC
    `);

    let crecimientoMensual = 0;

    if (monthlySales.length >= 2) {
      const prev = Number(monthlySales[monthlySales.length - 2].ventas || 0);
      const curr = Number(monthlySales[monthlySales.length - 1].ventas || 0);

      if (prev > 0) {
        crecimientoMensual = ((curr - prev) / prev) * 100;
      } else if (curr > 0) {
        crecimientoMensual = 100;
      }
    }

    const topProductoNombre =
      topProducts.length > 0 ? topProducts[0].name : "Sin datos";

    const productoMenosVendido =
      leastSoldProduct.length > 0 ? leastSoldProduct[0].name : "Sin datos";

    const alertas = [];

    if (Number(lowStockCount[0].productosBajoStock) > 0) {
      alertas.push(
        `${lowStockCount[0].productosBajoStock} producto(s) con bajo stock`
      );
    }

    if (Number(deliveryPending[0].entregasPendientes) > 0) {
      alertas.push(
        `${deliveryPending[0].entregasPendientes} pedido(s) pendientes de entrega`
      );
    }

    if (Number(cancelledOrders[0].pedidosCancelados) > 0) {
      alertas.push(
        `${cancelledOrders[0].pedidosCancelados} pedido(s) cancelados`
      );
    }

    res.json({
      totalUsuarios: Number(users[0].totalUsuarios || 0),
      totalPedidos: Number(orders[0].totalPedidos || 0),
      ventasTotales: Number(sales[0].ventasTotales || 0),

      pedidosPendientes: Number(pendingOrders[0].pedidosPendientes || 0),
      pedidosCompletados: Number(completedOrders[0].pedidosCompletados || 0),
      pedidosCancelados: Number(cancelledOrders[0].pedidosCancelados || 0),

      entregasPendientes: Number(deliveryPending[0].entregasPendientes || 0),
      entregasEnCamino: Number(deliveryOnWay[0].entregasEnCamino || 0),
      entregasEntregadas: Number(deliveryDelivered[0].entregasEntregadas || 0),

      productosActivos: Number(activeProducts[0].productosActivos || 0),
      productosInactivos: Number(inactiveProducts[0].productosInactivos || 0),
      productosBajoStock: Number(lowStockCount[0].productosBajoStock || 0),

      ticketPromedio: Number(avgTicket[0].ticketPromedio || 0),
      pedidoMasAlto: Number(bestOrder[0].pedidoMasAlto || 0),
      crecimientoMensual: Number(crecimientoMensual || 0),

      topProductoNombre,
      productoMenosVendido,

      alertas,
      topProductos: topProducts
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    res.status(500).json({
      error: "Error obteniendo estadísticas"
    });
  }
};

// ======================================
// VENTAS POR MES
// ======================================
export const getSalesChart = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS mes,
        SUM(total) AS ventas
      FROM orders
      WHERE status != 'Cancelado'
      GROUP BY mes
      ORDER BY mes ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Sales chart error:", error);

    res.status(500).json({
      error: "Error obteniendo gráfico de ventas"
    });
  }
};

// ======================================
// PRODUCTOS CON BAJO STOCK
// ======================================
export const getLowStockProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT name, stock
      FROM products
      WHERE stock <= 5
      ORDER BY stock ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo productos con bajo stock"
    });
  }
};

// ======================================
// VENTAS DIARIAS
// ======================================
export const getDailySales = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE(created_at) as dia,
        SUM(total) as ventas
      FROM orders
      WHERE status != 'Cancelado'
      GROUP BY dia
      ORDER BY dia DESC
      LIMIT 7
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo ventas diarias"
    });
  }
};

// ======================================
// CLIENTES NUEVOS
// ======================================
export const getNewClients = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at,'%Y-%m') as mes,
        COUNT(*) as clientes
      FROM users
      WHERE role='cliente'
      GROUP BY mes
      ORDER BY mes ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo clientes nuevos"
    });
  }
};