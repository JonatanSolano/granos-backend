import express from "express";
import * as productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();


// CLIENTES
router.get("/active", productController.getActiveProducts);
router.get("/search", productController.searchProducts);
router.get("/:id", productController.getProductById);


// ADMIN
router.get("/", verifyToken, isAdmin, productController.getProducts);

router.post("/", verifyToken, isAdmin, productController.createProduct);

router.put("/:id", verifyToken, isAdmin, productController.updateProduct);

router.put("/:id/stock", verifyToken, isAdmin, productController.updateStock);

router.patch("/:id/toggle", verifyToken, isAdmin, productController.toggleProductStatus);

router.delete("/:id", verifyToken, isAdmin, productController.deleteProduct);


export default router;