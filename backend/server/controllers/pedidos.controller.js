const db = require('../config/database');
const { enviarCorreoConFactura } = require('../config/afip-facturacion');
const { crearFacturaPDF } = require('../config/generar-factura'); // ✅ Agregado

// ✅ Crear pedido — WhatsApp + sesion_id confirmado desde BD
exports.crearPedido = async (req, res) => {
  try {
    const { 
      nombre, whatsapp, telefono, direccion, productos, total, notas, sesion_id,
      quiero_factura, dni_comprador, domicilio_comprador
    } = req.body;

    if (!nombre || !whatsapp || !direccion || !productos || productos.length === 0) {
      return res.status(400).json({ 
        ok: false,
        mensaje: 'Faltan datos. Completá nombre, WhatsApp y dirección.' 
      });
    }

    const productosJson = JSON.stringify(productos);
    const sesionRecibida = sesion_id || 'invitado';
    const factura = quiero_factura === true || quiero_factura === 'true';

    // ✅ INSERTAR Y OBTENER EL sesion_id REAL DE LA BASE
    const resultado = await db.query(
      `INSERT INTO pedidos 
       (nombre, whatsapp, telefono, direccion, productos, total, notas, 
        sesion_id, quiero_factura, dni_comprador, domicilio_comprador, estado, fecha) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente', NOW())
       RETURNING id, sesion_id, factura_numero`,
      [
        nombre, whatsapp || null, telefono || null, direccion || '', productosJson, total, notas || '',
        sesionRecibida, factura, dni_comprador || null, domicilio_comprador || null
      ]
    );

    const pedidoId = resultado.rows[0].id;
    const sesionIdReal = resultado.rows[0].sesion_id;
    console.log(`✅ Pedido guardado: ID ${pedidoId} — Sesión REAL: ${sesionIdReal}`);

    // ✅ DEVOLVER ANTES de generar factura (no esperar al PDF)
    res.status(201).json({
      ok: true,
      mensaje: `¡Gracias ${nombre}! Tu pedido se registró correctamente.`,
      pedidoId: pedidoId,
      sesion_id: sesionIdReal
    });

    // ✅ GENERAR FACTURA EN SEGUNDO PLANO — SIN BLOQUEAR
    if (factura) {
      (async () => {
        try {
          // 1️⃣ Generar número de factura
          const ultimoNro = await db.query(
            `SELECT factura_numero FROM pedidos 
             WHERE factura_numero LIKE '00010-%' 
             ORDER BY factura_numero DESC LIMIT 1`
          );
          
          let secuencia = 1;
          if (ultimoNro.rows.length > 0) {
            const match = ultimoNro.rows[0].factura_numero.match(/0*(\d+)$/);
            if (match) secuencia = parseInt(match[1]) + 1;
          }
          
          const numeroFactura = `00010-${String(secuencia).padStart(8, '0')}`;
          const fecha = new Date().toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          });

          // 2️⃣ Generar PDF
          const resultadoPDF = await crearFacturaPDF({
            numeroFactura,
            cae: 'EN TRÁMITE', // Se actualiza cuando AFIP responda
            fecha,
            nombre,
            dni: dni_comprador || 'Consumidor Final',
            domicilio: domicilio_comprador || 'Sin especificar',
            whatsapp,
            productos,
            total
          });

          // 3️⃣ Guardar en la base
          await db.query(
            `UPDATE pedidos 
             SET factura_numero = $1, factura_archivo = $2, factura_generada = true, fecha_factura = NOW()
             WHERE id = $3`,
            [numeroFactura, resultadoPDF.archivo, pedidoId]
          );

          console.log(`✅ Factura N° ${numeroFactura} generada → Archivo: ${resultadoPDF.archivo}`);

          // 4️⃣ Llamar a AFIP para CAE (sin bloquear respuesta)
          const respAFIP = await enviarCorreoConFactura({
            pedido_id: pedidoId,
            sesion_id: sesionIdReal,
            numeroFactura,
            nombre,
            whatsapp,
            dni: dni_comprador,
            domicilio: domicilio_comprador,
            productos,
            total
          });

          if (respAFIP?.exito && respAFIP.cae) {
            // Actualizar CAE real en la base
            await db.query(
              `UPDATE pedidos SET factura_cae = $1 WHERE id = $2`,
              [respAFIP.cae, pedidoId]
            );
            console.log(`✅ CAE ${respAFIP.cae} guardado para factura ${numeroFactura}`);
          }

        } catch (err) {
          console.log('⚠️ Error generando factura:', err.message);
        }
      })();
    }

  } catch (error) {
    console.error('❌ ERROR AL GUARDAR PEDIDO:', error.message);
    res.status(500).json({ 
      ok: false,
      mensaje: 'Hubo un problema al registrar tu pedido. Intentá nuevamente.' 
    });
  }
};

// ✅ Listar todos los pedidos — INCLUYE sesion_id completo
exports.listarPedidos = async (req, res) => {
  try {
    const pedidos = await db.query(
      `SELECT id, nombre, whatsapp, telefono, direccion, total, estado, fecha, sesion_id,
              quiero_factura, factura_generada, factura_numero, factura_archivo, dni_comprador
       FROM pedidos ORDER BY fecha DESC`
    );
    res.json({ ok: true, datos: pedidos.rows });
  } catch (error) {
    console.error('❌ Error al listar pedidos:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar pedidos' });
  }
};

// ✅ Listar solo pedidos con factura
exports.listarConFactura = async (req, res) => {
  try {
    const pedidos = await db.query(
      `SELECT id, nombre, whatsapp, telefono, direccion, total, fecha, sesion_id,
              factura_numero, factura_archivo, fecha_factura, productos, dni_comprador
       FROM pedidos 
       WHERE factura_numero IS NOT NULL 
       ORDER BY fecha DESC`
    );
    console.log(`📋 Cargadas ${pedidos.rows.length} facturas para panel`);
    res.json({ ok: true, datos: pedidos.rows });
  } catch (error) {
    console.error('❌ Error cargando facturas:', error.message);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar facturas' });
  }
};

// ✅ Ver mis pedidos como cliente — por sesion_id EXACTO
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

// ✅ Actualizar WhatsApp del cliente
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

// ✅ Generar factura desde confirmación.html — devuelve datos para la plantilla
exports.generarFacturaPDF = async (req, res) => {
  try {
    const { sesion_id, pedido_id } = req.body;

    // Buscar el pedido completo
    const pedido = await db.query(
      `SELECT *, productos::text FROM pedidos 
       WHERE (sesion_id = $1 OR id = $2) LIMIT 1`,
      [sesion_id, pedido_id]
    );

    if (!pedido.rows.length) {
      return res.status(404).json({ ok: false, mensaje: "Pedido no encontrado" });
    }

    const p = pedido.rows[0];
    const productos = JSON.parse(p.productos);

    // Si ya tiene factura generada → devolver lo existente
    if (p.factura_numero && p.factura_generada) {
      return res.json({
        ok: true,
        mensaje: "Factura ya generada",
        datos: {
          numero: p.factura_numero,
          cae: p.factura_cae || 'En trámite',
          archivo: p.factura_archivo,
          nombre: p.nombre,
          dni: p.dni_comprador,
          domicilio: p.domicilio_comprador,
          productos,
          total: p.total
        }
      });
    }

    // Si no tiene → generar ahora
    const numeroFactura = p.factura_numero || `00010-${String(p.id).padStart(8, '0')}`;
    const fecha = new Date().toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const resultadoPDF = await crearFacturaPDF({
      numeroFactura,
      cae: 'EN TRÁMITE',
      fecha,
      nombre: p.nombre,
      dni: p.dni_comprador || 'Consumidor Final',
      domicilio: p.domicilio_comprador || 'Sin especificar',
      whatsapp: p.whatsapp,
      productos,
      total: p.total
    });

    // Guardar en BD
    await db.query(
      `UPDATE pedidos 
       SET factura_numero = $1, factura_archivo = $2, factura_generada = true, fecha_factura = NOW()
       WHERE id = $3`,
      [numeroFactura, resultadoPDF.archivo, p.id]
    );

    res.json({
      ok: true,
      mensaje: "Factura generada con éxito",
      datos: {
        numero: numeroFactura,
        cae: 'EN TRÁMITE',
        archivo: resultadoPDF.archivo,
        productos,
        total: p.total
      }
    });

  } catch (error) {
    console.error("❌ Error generando PDF:", error.message);
    res.status(500).json({ ok: false, mensaje: "No se pudo generar la factura" });
  }
};