import express from "express";
import {
  processOrderPayment,
  getPaymentTestData
} from "../controllers/payment.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/process", verifyToken, processOrderPayment);
router.get("/test-data", verifyToken, getPaymentTestData);

export default router;