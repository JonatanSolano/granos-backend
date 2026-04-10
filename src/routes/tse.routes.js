import express from "express";
import { getCiudadanoByCedula } from "../controllers/tse.controller.js";

const router = express.Router();

// GET /api/tse/ciudadanos/:cedula
router.get("/ciudadanos/:cedula", getCiudadanoByCedula);

export default router;