import express from "express";
import {
  validateCard,
  processPayment,
  getCardInfo
} from "../controllers/bank.controller.js";

const router = express.Router();

router.post("/validate-card", validateCard);
router.post("/process-payment", processPayment);
router.get("/card/:numeroTarjeta", getCardInfo);

export default router;