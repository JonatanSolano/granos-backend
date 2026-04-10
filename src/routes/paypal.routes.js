import express from "express";
import { createPayPalOrder, capturePayPalOrder } from "../controllers/paypal.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/create-order", verifyToken, createPayPalOrder);
router.post("/capture-order", verifyToken, capturePayPalOrder);

export default router;