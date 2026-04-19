import express from "express";
import {
  validateCard,
  processPayment,
  getCardInfo,
  getTestCards,
  getTestSinpeAccounts
} from "../controllers/bank.controller.js";

const router = express.Router();

router.get("/test-cards", getTestCards);
router.get("/test-sinpe", getTestSinpeAccounts);

router.post("/validate-card", validateCard);
router.post("/process-payment", processPayment);
router.get("/card/:numeroTarjeta", getCardInfo);

export default router;