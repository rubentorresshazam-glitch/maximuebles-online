const express = require('express');
const router = express.Router();

// ✅ Controlador de productos
const productoController = require('../controllers/productos.controller');

// ======================================
// 🌐 RUTAS PÚBLICAS — Cualquiera ve los productos
// ======================================
router.get('/', productoController.obtenerTodos);        // Ver todos (con filtro por categoría y por más vendidos)
router.get('/:id', productoController.obtenerPorId);    // Ver uno solo por ID

// ======================================
// 🔒 RUTAS ADMINISTRATIVAS — Por ahora libres
// ======================================
// Cuando quieras protegerlas, descomentá: const auth = require('../middlewares/auth');
// y agregá "auth," entre la ruta y el controlador
router.post('/', productoController.crear);              // Crear producto
router.put('/:id', productoController.actualizar);      // Editar producto
router.delete('/:id', productoController.eliminar);     // Eliminar producto

module.exports = router;