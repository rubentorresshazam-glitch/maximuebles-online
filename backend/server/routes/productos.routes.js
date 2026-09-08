const express = require('express');
const router = express.Router();

// ✅ Controlador de productos
const productoController = require('../controllers/productos.controller');

// ======================================
// 🌐 RUTAS PÚBLICAS — Cualquiera ve los productos
// ======================================
router.get('/', productoController.obtenerTodos);        // Ver todos (con filtro por categoría)
router.get('/:id', productoController.obtenerPorId);    // Ver uno solo por ID

// ======================================
// 🔒 RUTAS ADMINISTRATIVAS — Por ahora libres
// ======================================
// Cuando quieras protegerlas, descomentá: const auth = require('../middlewares/auth');
// y agregá "auth," entre la ruta y el controlador
router.post('/', productoController.crear);             // Crear producto
router.put('/:id', productoController.actualizar);      // Editar producto
router.delete('/:id', productoController.eliminar);    // Eliminar producto

module.exports = router;

// ✅ En productos.routes.js — dentro del listar todos
if (req.query.orden === 'vendidos') {
    // Ordena por cantidad de ventas (más vendidos primero)
    productos = await db.query(`
        SELECT *, COALESCE(vendidos, 0) AS ventas 
        FROM productos 
        ORDER BY ventas DESC, id DESC
    `);
}