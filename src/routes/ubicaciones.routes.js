import express from "express";
import {
  getPaises,
  getHijos,
  getRutaByUbicacionId,
} from "../controllers/ubicaciones.controller.js";

const router = express.Router();

router.get("/paises", getPaises);
router.get("/hijos/:idPadre", getHijos);
router.get("/ruta/:idUbicacion", getRutaByUbicacionId);

export default router;