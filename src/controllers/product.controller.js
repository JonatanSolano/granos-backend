import * as productService from "../services/product.service.js";


// ======================================
// OBTENER TODOS
// ======================================

export const getProducts = async (req, res) => {

  try {

    const products = await productService.getAllProducts();

    res.json(products);

  } catch (error) {

    res.status(500).json({
      error: "Error obteniendo productos"
    });

  }

};


// ======================================
// OBTENER ACTIVOS
// ======================================

export const getActiveProducts = async (req, res) => {

  try {

    const products = await productService.getActiveProducts();

    res.json(products);

  } catch (error) {

    res.status(500).json({
      error: "Error obteniendo productos"
    });

  }

};


// ======================================
// OBTENER POR ID
// ======================================

export const getProductById = async (req, res) => {

  try {

    const product = await productService.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Producto no encontrado"
      });
    }

    res.json(product);

  } catch (error) {

    res.status(500).json({
      error: "Error obteniendo producto"
    });

  }

};


// ======================================
// BUSCAR PRODUCTOS
// ======================================

export const searchProducts = async (req, res) => {

  try {

    const { q } = req.query;

    const products = await productService.searchProducts(q);

    res.json(products);

  } catch (error) {

    res.status(500).json({
      error: "Error buscando productos"
    });

  }

};


// ======================================
// CREAR PRODUCTO
// ======================================

export const createProduct = async (req, res) => {

  try {

    const { name, price, stock } = req.body;

    if (!name || name.length < 3) {
      return res.status(400).json({
        message: "Nombre inválido"
      });
    }

    if (!price || price <= 0) {
      return res.status(400).json({
        message: "Precio inválido"
      });
    }

    if (stock < 0) {
      return res.status(400).json({
        message: "Stock inválido"
      });
    }

    const id = await productService.createProduct(req.body);

    res.status(201).json({
      message: "Producto creado",
      id
    });

  } catch (error) {

    res.status(500).json({
      error: "Error creando producto"
    });

  }

};


// ======================================
// ACTUALIZAR PRODUCTO
// ======================================

export const updateProduct = async (req, res) => {

  try {

    await productService.updateProduct(req.params.id, req.body);

    res.json({
      message: "Producto actualizado"
    });

  } catch (error) {

    res.status(500).json({
      error: "Error actualizando producto"
    });

  }

};


// ======================================
// ACTUALIZAR STOCK
// ======================================

export const updateStock = async (req, res) => {

  try {

    const { stock } = req.body;

    if (stock < 0) {
      return res.status(400).json({
        message: "Stock inválido"
      });
    }

    await productService.updateStock(req.params.id, stock);

    res.json({
      message: "Stock actualizado"
    });

  } catch (error) {

    res.status(500).json({
      error: "Error actualizando stock"
    });

  }

};


// ======================================
// ACTIVAR / DESACTIVAR PRODUCTO
// ======================================

export const toggleProductStatus = async (req, res) => {

  try {

    await productService.toggleProductStatus(req.params.id);

    res.json({
      message: "Estado del producto actualizado"
    });

  } catch (error) {

    res.status(500).json({
      error: "Error actualizando estado"
    });

  }

};


// ======================================
// ELIMINAR PRODUCTO
// ======================================

export const deleteProduct = async (req, res) => {

  try {

    await productService.deleteProduct(req.params.id);

    res.json({
      message: "Producto eliminado"
    });

  } catch (error) {

    res.status(500).json({
      error: "Error eliminando producto"
    });

  }

};