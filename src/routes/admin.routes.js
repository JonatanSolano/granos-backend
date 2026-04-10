import express from "express";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";
import {
  getDashboardStats,
  getSalesChart,
  getLowStockProducts,
  getDailySales,
  getNewClients
} from "../controllers/admin.controller.js";

const router = express.Router();


// DASHBOARD
router.get("/dashboard", verifyToken, isAdmin, getDashboardStats);


// VENTAS POR MES
router.get("/sales-chart", verifyToken, isAdmin, getSalesChart);


// STOCK BAJO
router.get("/low-stock", verifyToken, isAdmin, getLowStockProducts);


// VENTAS DIARIAS
router.get("/daily-sales", verifyToken, isAdmin, getDailySales);


// CLIENTES NUEVOS
router.get("/new-clients", verifyToken, isAdmin, getNewClients);


export default router;