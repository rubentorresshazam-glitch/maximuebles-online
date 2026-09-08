const db = require('../config/database');
const { enviarCorreoConFactura } = require('../config/afip-facturacion');

// ✅ Crear pedido — WhatsApp en lugar de correo
exports.crearPedido = async (req, res) => {
  try {
    const { 
      nombre, whatsapp, telefono, direccion, productos, total, notas, sesion_id,
      quiero_factura, dni_comprador, domicilio_comprador
    } = req.body;

    // ✅ Validar datos — AHORA PIDE WHATSAPP
    if (!nombre || !whatsapp || !direccion || !productos || productos.length === 0) {
      return res.status(400).json({ 
        ok: false,
        mensaje: 'Faltan datos. Completá nombre, WhatsApp y dirección.' 
      });
    }

    const productosJson = JSON.stringify(productos);
    const sesion = sesion_id || 'invitado';
    const factura = quiero_factura === true || quiero_factura === 'true';

    // ✅ GUARDAR PEDIDO — WHATSAPP EN LUGAR DE CORREO
    const resultado = await db.query(
      `INSERT INTO pedidos 
       (nombre, whatsapp, telefono, direccion, productos, total, notas, 
        sesion_id, quiero_factura, dni_comprador, domicilio_comprador, estado, fecha) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente', NOW())
       RETURNING id`,
      [
        nombre, whatsapp || null, telefono || null, direccion || '', productosJson, total, notas || '',
        sesion, factura, dni_comprador || null, domicilio_comprador || null
      ]
    );

    const pedidoId = resultado.rows[0].id;
    console.log(`✅ Pedido guardado: ID ${pedidoId} — WhatsApp: ${whatsapp}`);

    // ✅ RESPUESTA INMEDIATA AL CLIENTE
    res.status(201).json({
      ok: true,
      mensaje: `¡Gracias ${nombre}! Tu pedido se registró correctamente.`,
      pedidoId: pedidoId
    });

    // ✅ FACTURA — ENVÍA WHATSAPP A LA FUNCIÓN
    if (factura) {
      enviarCorreoConFactura({
        pedido_id: pedidoId,
        nombre,
        whatsapp, // ✅ EN LUGAR DE CORREO
        dni: dni_comprador,
        domicilio: domicilio_comprador,
        productos,
        total
      }).then(async (numeroFactura) => {
        console.log(`✅ Factura N° ${numeroFactura} — WhatsApp: ${whatsapp}`);
        try {
          await db.query(
            `UPDATE pedidos SET factura_generada = true, factura_numero = $1, fecha_factura = NOW() WHERE id = $2`,
            [numeroFactura, pedidoId]
          );
        } catch (err) {
          console.log('⚠️ Pedido actualizado sin número de factura:', err.message);
        }
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

// ✅ Listar todos los pedidos — CORREGIDO: correo → whatsapp
exports.listarPedidos = async (req, res) => {
  try {
    const pedidos = await db.query(
      `SELECT id, nombre, whatsapp, telefono, direccion, total, estado, fecha, sesion_id,
              quiero_factura, factura_generada, factura_numero
       FROM pedidos ORDER BY fecha DESC`
    );
    res.json({ ok: true, datos: pedidos.rows });
  } catch (error) {
    console.error('❌ Error al listar pedidos:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar pedidos' });
  }
};

// ✅ Ver mis pedidos como cliente — SIGUE IGUAL
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

// ✅ Ver detalle de un pedido — SIGUE IGUAL
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