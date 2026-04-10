import express from "express";

import {
  createOrder,
  getOrders,
  getAllOrders,
  updateOrderStatus,
  updateOrderDeliveryStatus,
  deleteOrder
} from "../controllers/orders.controller.js";

import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", verifyToken, createOrder);
router.get("/", verifyToken, getOrders);

// ADMIN
router.get("/admin/all", verifyToken, isAdmin, getAllOrders);
router.put("/:id/status", verifyToken, updateOrderStatus);
router.put("/:id/delivery-status", verifyToken, isAdmin, updateOrderDeliveryStatus);
router.delete("/:id", verifyToken, deleteOrder);

export default router;