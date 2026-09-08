const db = require('../config/database');

// ✅ Crear pedido como invitado — CON TODOS LOS CAMPOS
exports.crearPedido = async (req, res) => {
  try {
    const { 
      nombre, correo, telefono, direccion, 
      productos, total, notas, sesion_id,
      quiero_factura, dni_comprador, domicilio_comprador
    } = req.body;

    // ✅ Validar datos obligatorios
    if (!nombre || !correo || !telefono || !direccion || !productos || productos.length === 0) {
      return res.status(400).json({ 
        ok: false,
        mensaje: 'Faltan datos. Completá nombre, correo, teléfono y dirección.' 
      });
    }

    // ✅ Guardar en la base de datos — TODOS los campos incluidos
    const resultado = await db.query(
      `INSERT INTO pedidos 
       (nombre, correo, telefono, direccion, productos, total, notas, sesion_id, 
        quiero_factura, dni_comprador, domicilio_comprador, estado, fecha) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente', NOW()) 
       RETURNING id`,
      [
        nombre, correo, telefono || null, direccion || '', 
        JSON.stringify(productos), total, notas || '', sesion_id || 'invitado',
        quiero_factura || false, dni_comprador || null, domicilio_comprador || null
      ]
    );

    res.json({ 
      ok: true, 
      mensaje: '✅ Pedido registrado correctamente',
      pedido_id: resultado.rows[0].id
    });

  } catch (error) {
    console.error('❌ Error al crear pedido:', error.message);
    res.status(500).json({ 
      ok: false, 
      mensaje: 'Hubo un problema al registrar tu pedido. Intentá nuevamente.' 
    });
  }
};