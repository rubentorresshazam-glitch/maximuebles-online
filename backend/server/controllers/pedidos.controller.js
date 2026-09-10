const db = require('../config/database');
const { enviarCorreoConFactura } = require('../config/afip-facturacion');

// ✅ Crear pedido — WhatsApp en lugar de correo
exports.crearPedido = async (req, res) => {
  try {
    const { 
      nombre, whatsapp, telefono, direccion, productos, total, notas, sesion_id,
      quiero_factura, dni_comprador, domicilio_comprador
    } = req.body;

    // ✅ Validar datos
    if (!nombre || !whatsapp || !direccion || !productos || productos.length === 0) {
      return res.status(400).json({ 
        ok: false,
        mensaje: 'Faltan datos. Completá nombre, WhatsApp y dirección.' 
      });
    }

    const productosJson = JSON.stringify(productos);
    const sesion = sesion_id || 'invitado';
    const factura = quiero_factura === true || quiero_factura === 'true';

    // ✅ GUARDAR PEDIDO EN LA BASE
    const resultado = await db.query(
      `INSERT INTO pedidos 
       (nombre, whatsapp, telefono, direccion, productos, total, notas, 
        sesion_id, quiero_factura, dni_comprador, domicilio_comprador, estado, fecha) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente', NOW())
       RETURNING id, sesion_id`,
      [
        nombre, whatsapp || null, telefono || null, direccion || '', productosJson, total, notas || '',
        sesion, factura, dni_comprador || null, domicilio_comprador || null
      ]
    );

    const pedidoId = resultado.rows[0].id;
    const sesionIdReal = resultado.rows[0].sesion_id;
    console.log(`✅ Pedido guardado: ID ${pedidoId} — Sesión: ${sesionIdReal}`);

    // ✅ RESPUESTA INMEDIATA AL CLIENTE
    res.status(201).json({
      ok: true,
      mensaje: `¡Gracias ${nombre}! Tu pedido se registró correctamente.`,
      pedidoId: pedidoId,
      sesion_id: sesionIdReal
    });

    // ✅ FACTURA — SE GENERA EN SEGUNDO PLANO
    if (factura) {
      // ⚠️ NO HACER UPDATE ACÁ → afip-facturacion.js YA LO HACE
      enviarCorreoConFactura({
        pedido_id: pedidoId,
        sesion_id: sesionIdReal,  // ✅ IMPORTANTE: pasar sesion_id
        nombre,
        whatsapp,
        dni: dni_comprador,
        domicilio: domicilio_comprador,
        productos,
        total
      }).then((respuestaFactura) => {
        const numeroFactura = respuestaFactura?.exito ? respuestaFactura.numero : 'SIN-FACTURA';
        console.log(`✅ Factura N° ${numeroFactura} generada para pedido ${pedidoId}`);
      }).catch(err => {
        console.log('⚠️ Factura no se pudo generar (pedido guardado OK):', err.message);
      });
    }
  } catch (error) {
    console.error('❌ ERROR AL GUARDAR PEDIDO:', error.message);
    res.status(500).json({ 
      ok: false,
      mensaje: 'Hubo un problema al registrar tu pedido. Intentá nuevamente.' 
    });
  }
};

// ✅ Listar todos los pedidos — CORREGIDO: incluye ruta de factura
exports.listarPedidos = async (req, res) => {
  try {
    const pedidos = await db.query(
      `SELECT id, nombre, whatsapp, telefono, direccion, total, estado, fecha, sesion_id,
              quiero_factura, factura_generada, factura_numero, factura_ruta
       FROM pedidos ORDER BY fecha DESC`
    );
    res.json({ ok: true, datos: pedidos.rows });
  } catch (error) {
    console.error('❌ Error al listar pedidos:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar pedidos' });
  }
};

// ✅ Ver mis pedidos como cliente
exports.verPedidoCliente = async (req, res) => {
  try {
    const sesion_id = req.query.sesion_id;
    if (!sesion_id) {
      return res.status(400).json({ ok: false, mensaje: 'Falta identificación de sesión' });
    }
    const pedidos = await db.query(
      `SELECT *, productos::text FROM pedidos WHERE sesion_id = $1 ORDER BY fecha DESC`,
      [sesion_id]
    );
    const datos = pedidos.rows.map(p => ({
      ...p,
      productos: JSON.parse(p.productos)
    }));
    res.json({ ok: true, datos });
  } catch (error) {
    console.error('❌ Error al cargar pedidos:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar tus pedidos' });
  }
};

// ✅ Ver detalle de un pedido
exports.verDetalle = async (req, res) => {
  try {
    const pedido = await db.query(
      `SELECT *, productos::text FROM pedidos WHERE id = $1`,
      [req.params.id]
    );
    if (!pedido.rows.length) {
      return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    }
    res.json({ 
      ok: true, 
      datos: {
        ...pedido.rows[0],
        productos: JSON.parse(pedido.rows[0].productos)
      }
    });
  } catch (error) {
    console.error('❌ Error al cargar detalle:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle' });
  }
};

// ✅ GUARDAR WHATSAPP DEL CLIENTE DESDE CONFIRMACIÓN
exports.actualizarFactura = async (req, res) => {
  try {
    const { sesion_id, whatsapp } = req.body;
    await db.query(
      `UPDATE pedidos SET whatsapp = $1 WHERE sesion_id = $2`,
      [whatsapp, sesion_id]
    );
    res.json({ ok: true, mensaje: "WhatsApp guardado correctamente" });
  } catch (error) {
    console.error("❌ Error guardando WhatsApp:", error.message);
    res.status(500).json({ ok: false, mensaje: "No se pudo guardar el WhatsApp" });
  }
};

// ✅ GENERAR FACTURA PDF Y DEVOLVER ENLACE DE DESCARGA
exports.generarFacturaPDF = async (req, res) => {
  try {
    const resultado = await enviarCorreoConFactura(req.body);
    
    if (!resultado.exito) {
      return res.status(400).json({ ok: false, mensaje: "No se pudo generar la factura" });
    }
    // ✅ URL PÚBLICA CORRECTA
    res.json({ 
      ok: true, 
      mensaje: "Factura generada con éxito",
      datos: {
        numero: resultado.numero,
        cae: resultado.cae,
        vencimiento: resultado.vencimiento,
        url: resultado.url  // ✅ Ruta pública desde afip-facturacion.js
      }
    });
  } catch (error) {
    console.error("❌ Error generando PDF:", error.message);
    res.status(500).json({ ok: false, mensaje: "No se pudo generar la factura" });
  }
};