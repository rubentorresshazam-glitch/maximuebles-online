// ==================================================
// SERVIDOR MAXIMUEBLES · VERSIÓN DEFINITIVA ✅
// ✅ Conexión Neon + Mercado Pago + ARCA/CAE real ✅
// ✅ Generación PDF + Descarga segura por sesion_id ✅
// ✅ NO inventa CAE — si falla avisa y detiene ✅
// ==================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

// ==================================================
// ✅ CONEXIONES
// ==================================================
const db = require('./config/database');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

// ✅ Facturación ARCA + PDF
const { obtenerCAE } = require('./config/afip-facturacion');
const { generarFacturaPDF } = require('./config/generar-factura');

// ==================================================
// ✅ DATOS DE LA EMPRESA
// ==================================================
const CUIT_EMPRESA = process.env.CUIT_EMPRESA || "30715002724";
const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA || "MAXIMUEBLES S.R.L.";
const PUNTO_VENTA = process.env.AFIP_PUNTO_VENTA || "00010";
const PUERTO = process.env.PORT || 10000;
const WEB_URL = process.env.WEB_URL || "https://maximuebles-online.onrender.com";

// ==================================================
// ✅ CARPETA DE FACTURAS — EN RAÍZ DEL PROYECTO
// ==================================================
const CARPETA_FACTURAS = path.join(__dirname, '../../facturacionadmin/facturas-generadas');
fs.ensureDirSync(CARPETA_FACTURAS);
console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);

// ==================================================
// ✅ INICIALIZAR APP
// ==================================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../')));

// ✅ Bloquear acceso directo a PDFs
app.use('/facturacionadmin/facturas-generadas/', (req, res) => {
  res.status(403).send('🔒 Acceso restringido');
});

// ==================================================
// ✅ PÁGINA PRINCIPAL
// ==================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// ✅ Páginas estáticas adicionales
const paginas = ['nosotros','contacto','ayuda','comedor','dormitorio','living','oficina','ofertas'];
paginas.forEach(ruta => {
  app.get(`/${ruta}`, (req, res) => {
    res.sendFile(path.join(__dirname, `../../${ruta}.html`));
  });
});

// ==================================================
// 💳 MERCADO PAGO — Crear preferencia
// ==================================================
app.post('/api/crear-preferencia-pago', async (req, res) => {
  try {
    const { productos, total, datosComprador } = req.body;
    const sesion_id = req.query.sesion_id || 'invitado';

    const items = productos.map(item => ({
      id: String(item.id || Date.now()),
      title: item.nombre || 'Producto',
      quantity: Number(item.cantidad) || 1,
      unit_price: Number(item.precio) || 0
    }));

    const preferencia = new Preference(mpClient);
    const respuesta = await preferencia.create({
      body: {
        items,
        payer: {
          name: datosComprador?.nombre || 'Cliente',
          email: datosComprador?.whatsapp || 'cliente@maximuebles.com'
        },
        back_urls: {
          success: `${WEB_URL}/mi-cuenta/confirmacion.html?sesion_id=${sesion_id}`,
          failure: `${WEB_URL}/mi-cuenta/carrito.html`,
          pending: `${WEB_URL}/mi-cuenta/confirmacion.html?sesion_id=${sesion_id}`
        },
        auto_return: 'approved',
        external_reference: sesion_id
      }
    });

    res.json({ 
      ok: true, 
      mensaje: 'Preferencia creada',
      datos: { urlPago: respuesta.init_point } 
    });
  } catch (error) {
    console.error('❌ Mercado Pago:', error.message);
    res.json({ ok: false, mensaje: 'Error con Mercado Pago: ' + error.message });
  }
});

// ==================================================
// 📦 CREAR PEDIDO + FACTURAR EN ARCA
// ==================================================
app.post('/api/pedidos', async (req, res) => {
  try {
    const { 
      nombre, whatsapp, telefono, direccion, productos, total, notas, sesion_id,
      quiero_factura, dni_comprador, domicilio_comprador
    } = req.body;

    // ✅ Validar datos obligatorios
    if (!nombre || !whatsapp || !direccion || !productos || productos.length === 0) {
      return res.status(400).json({ 
        ok: false,
        mensaje: 'Faltan datos. Completá nombre, WhatsApp y dirección.' 
      });
    }

    // ✅ 1. Guardar pedido en BD primero
    const resultadoPedido = await db.query(`
      INSERT INTO pedidos 
      (nombre, whatsapp, telefono, direccion, productos, total, notas, sesion_id, 
       dni_comprador, domicilio_comprador, factura_generada, creado_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW())
      RETURNING id, sesion_id
    `, [nombre, whatsapp, telefono || null, direccion, JSON.stringify(productos), total, notas || null, sesion_id, dni_comprador || null, domicilio_comprador || null]);

    const pedido = resultadoPedido.rows[0];
    console.log(`✅ Pedido guardado: ID ${pedido.id} — Sesión: ${sesion_id}`);

    // ✅ Si NO pide factura → terminamos acá
    if (!quiero_factura) {
      return res.json({
        ok: true,
        mensaje: `¡Gracias ${nombre}! Tu pedido se registró correctamente.`,
        datos: { id: pedido.id, sesion_id, factura: false }
      });
    }

    // ==================================================
    // 🧾 SÍ PIDE FACTURA → FLUJO COMPLETO ARCA
    // ==================================================
    console.log("🧾 Iniciando facturación ARCA para sesión:", sesion_id);

    // PASO 1 → Obtener CAE real de ARCA
    const resultadoARCA = await obtenerCAE({
      total: total,
      nombre: nombre,
      dni: dni_comprador || '0',
      domicilio: domicilio_comprador || direccion,
      productos: productos
    });

    if (!resultadoARCA.ok) {
      console.log("❌ ARCA falló → NO se emite factura:", resultadoARCA.error);
      
      // Guardamos el pedido pero marcamos factura pendiente
      await db.query(`
        UPDATE pedidos 
        SET factura_error = $1, factura_generada = false
        WHERE sesion_id = $2
      `, [resultadoARCA.error, sesion_id]);

      return res.json({
        ok: true,
        mensaje: `Pedido registrado. La facturación está pendiente: ${resultadoARCA.error}`,
        datos: { id: pedido.id, sesion_id, factura: false, error: resultadoARCA.error }
      });
    }

    // ✅ Tenemos CAE REAL → Generar PDF
    const { cae, vencimiento, numero_factura } = resultadoARCA;
    console.log("✅ CAE obtenido:", cae, "— Factura:", numero_factura);

    // PASO 2 → Generar PDF con CAE real
    const resultadoPDF = await generarFacturaPDF({
      numero: numero_factura,
      cae: cae,
      vencimiento: vencimiento,
      nombre: nombre,
      dni: dni_comprador || 'Consumidor Final',
      domicilio: domicilio_comprador || direccion,
      whatsapp: whatsapp,
      productos: productos,
      total: total
    });

    if (!resultadoPDF.ok) {
      return res.status(500).json({
        ok: false,
        mensaje: 'La factura se autorizó en ARCA pero hubo error al generar el PDF'
      });
    }

    // PASO 3 → Actualizar BD con datos oficiales
    await db.query(`
      UPDATE pedidos 
      SET factura_numero = $1, factura_cae = $2, factura_vencimiento = $3,
          factura_archivo = $4, dni_comprador = $5, factura_generada = true, fecha_factura = NOW()
      WHERE sesion_id = $6
    `, [numero_factura, cae, vencimiento, resultadoPDF.archivo, dni_comprador || null, sesion_id]);

    console.log("✅ ✅ FACTURA COMPLETA — CAE:", cae, "— Archivo:", resultadoPDF.archivo);

    // ✅ Responder al cliente
    res.json({
      ok: true,
      mensaje: `¡Gracias ${nombre}! Tu factura fue autorizada oficialmente por ARCA.`,
      datos: {
        id: pedido.id,
        sesion_id,
        factura: true,
        numero_factura,
        cae,
        vencimiento,
        archivo: resultadoPDF.archivo
      }
    });

  } catch (error) {
    console.error('❌ Error general en /api/pedidos:', error);
    res.status(500).json({ 
      ok: false, 
      mensaje: 'Error del servidor: ' + error.message 
    });
  }
});

// ==================================================
// 🔒 DESCARGAR FACTURA — SOLO POR sesion_id
// ==================================================
app.get('/api/descargar-mi-factura/:sesionId(*)', async (req, res) => {
  try {
    const sesionId = decodeURIComponent(req.params.sesionId);
    console.log("📥 Descarga solicitada para sesión:", sesionId);

    const resultado = await db.query(`
      SELECT factura_numero, factura_archivo, factura_generada 
      FROM pedidos 
      WHERE sesion_id = $1 
      ORDER BY id DESC LIMIT 1
    `, [sesionId]);

    if (resultado.rows.length === 0) {
      return res.status(404).send('Pedido no encontrado. Verificá el enlace.');
    }

    const { factura_archivo, factura_generada } = resultado.rows[0];

    if (!factura_generada || !factura_archivo) {
      return res.status(404).send('La factura aún no fue generada. Intentá nuevamente en unos minutos.');
    }

    const rutaCompleta = path.join(CARPETA_FACTURAS, factura_archivo);
    
    if (!fs.existsSync(rutaCompleta)) {
      console.log("❌ Archivo no existe en disco:", rutaCompleta);
      return res.status(404).send('Archivo de factura no encontrado en el servidor.');
    }

    console.log("✅ Descarga autorizada:", factura_archivo);
    res.download(rutaCompleta, factura_archivo);

  } catch (error) {
    console.error('❌ Error descargando factura:', error.message);
    res.status(500).send('Error del servidor: ' + error.message);
  }
});

// ==================================================
// 🧪 RUTA DE PRUEBA DE ARCA — SIN COMPRA
// ==================================================
app.get('/api/probar-arca', async (req, res) => {
  try {
    console.log("🧪 === PRUEBA DIRECTA DE ARCA ===");
    
    const resultado = await obtenerCAE({
      total: 1000.00,
      nombre: "PRUEBA ARCA",
      dni: "0",
      domicilio: "Dirección de Prueba",
      productos: [{ nombre: "Producto de prueba", cantidad: 1, precio: 1000 }]
    });

    if (!resultado.ok) {
      return res.json({
        ok: false,
        mensaje: "ARCA rechazó la solicitud",
        error: resultadoARCA.error
      });
    }

    res.json({
      ok: true,
      mensaje: "✅ Conexión con ARCA FUNCIONANDO",
      cae: resultado.cae,
      vencimiento: resultado.vencimiento,
      numero_factura: resultado.numero_factura
    });

  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

// ==================================================
// 🚀 INICIAR SERVIDOR
// ==================================================
app.listen(PUERTO, () => {
  console.log('='.repeat(60));
  console.log(`✅ SERVIDOR EN LÍNEA — Puerto: ${PUERTO}`);
  console.log(`🏢 Empresa: ${NOMBRE_EMPRESA} — CUIT: ${CUIT_EMPRESA}`);
  console.log(`📄 Carpeta PDFs: ${CARPETA_FACTURAS}`);
  console.log(`🌐 Entorno ARCA: ${process.env.AFIP_ENTORNO || 'produccion'}`);
  console.log('='.repeat(60));
});