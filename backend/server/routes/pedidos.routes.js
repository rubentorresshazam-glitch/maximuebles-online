const express = require('express');
const router = express.Router();

// ✅ Controlador de pedidos
const pedidoController = require('../controllers/pedidos.controller');

// ======================================
// 🌐 RUTAS DE PEDIDOS
// ======================================
// ✅ Crear pedido → POST /api/pedidos
router.post('/', pedidoController.crearPedido);

// ✅ Ver todos los pedidos (Panel administrativo) → GET /api/pedidos
router.get('/', pedidoController.listarPedidos);

// ✅ Ver mis pedidos como cliente → GET /api/pedidos/mis-pedidos
router.get('/mis-pedidos', pedidoController.verPedidoCliente);

// ✅ Ver detalle de UN pedido → GET /api/pedidos/:id
router.get('/:id', pedidoController.verDetalle);

module.exports = router;