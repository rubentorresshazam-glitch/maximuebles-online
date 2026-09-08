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

// ✅ Guardar WhatsApp y datos de facturación
router.post('/actualizar-factura', pedidoController.actualizarFactura);

// ✅ Generar factura PDF y devolverla para descarga
router.post('/generar-factura-pdf', pedidoController.generarFacturaPDF);

module.exports = router;