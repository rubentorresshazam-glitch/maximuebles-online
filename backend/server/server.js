// ==================================================
// SERVIDOR MAXIMUEBLES · TIENDA ONLINE
// ✅ DESCARGA SEGURA DE FACTURAS + RUTAS UNIFICADAS ✅
// ✅ CONEXIÓN NEON + MERCADO PAGO + PDF ✅
// ==================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const db = require('./config/database');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

const CUIT_EMPRESA = process.env.CUIT_EMPRESA || "30715002724";
const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA || "MAXIMUEBLES S.R.L.";
const app = express();

// ==================================================
// ✅ MANTENER NEON DESPIERTO
// ==================================================
setInterval(async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Neon activo — Base de datos despierta');
  } catch (e) {
    console.log('⚠️ Neon durmiendo...');
  }
}, 180000);

// ==================================================
// ✅ RUTA UNIFICADA DE FACTURAS — MISMA EN TODO EL SISTEMA
// ==================================================
const CARPETA_FACTURAS = path.join(__dirname, 'facturacionadmin', 'facturas-generadas');
fs.ensureDirSync(CARPETA_FACTURAS);
console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);

// ✅ BLOQUEAR ACCESO DIRECTO
app.use('/facturacionadmin/facturas-generadas/', (req, res) => {
  res.status(403).send('🔒 Acceso restringido');
});

// ==================================================
// ✅ DESCARGA SEGURA — POR sesion_id
// ==================================================
app.get('/api/descargar-mi-factura/:sesionId(*)', async (req, res) => {
  try {
    const sesionId = decodeURIComponent(req.params.sesionId);
    console.log("📥 Buscando sesion_id:", sesionId);

    const resultado = await db.query(
      'SELECT factura_numero, factura_archivo, id FROM pedidos WHERE sesion_id = $1 LIMIT 1',
      [sesionId]
    );

    if (resultado.rows.length === 0) {
      console.log("❌ Pedido no encontrado:", sesionId);
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:red;">⚠️ Factura no encontrada</h2>
          <p>No hay pedido asociado a este enlace.</p>
          <a href="/mi-cuenta/confirmacion.html">Volver a tu compra</a>
        </html>
      `);
    }

    const { factura_numero, factura_archivo, id } = resultado.rows[0];
    console.log("✅ Pedido encontrado — ID:", id, "Factura:", factura_numero);

    if (!factura_archivo) {
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:orange;">📄 Factura en proceso</h2>
          <p>La factura aún no fue generada. Intentá en unos segundos.</p>
          <a href="/mi-cuenta/confirmacion.html">Volver</a>
        </html>
      `);
    }

    const rutaCompleta = path.join(CARPETA_FACTURAS, factura_archivo);
    console.log("📄 Buscando:", rutaCompleta);
    console.log("✅ Existe:", fs.existsSync(rutaCompleta));

    if (!fs.existsSync(rutaCompleta)) {
      console.log("❌ Archivo NO existe en disco");
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:red;">❌ PDF no encontrado</h2>
          <p>El archivo no se generó correctamente.</p>
        </html>
      `);
    }

    res.download(rutaCompleta, factura_archivo, (err) => {
      if (err) {
        console.log('❌ Error descargando:', err.message);
        res.status(500).send('Error al descargar');
      } else {
        console.log("✅ Descarga entregada:", factura_archivo);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).send('Error del servidor');
  }
});

// ==================================================
// ✅ CONFIGURACIÓN GENERAL
// ==================================================
const PUERTO = process.env.PORT || 10000;
const WEB_URL = process.env.WEB_URL || "https://maximuebles-online.onrender.com";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ ARCHIVOS ESTÁTICOS — desde raíz del proyecto
app.use(express.static(path.join(__dirname, '../../')));

// ✅ PÁGINA PRINCIPAL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// ==================================================
// ✅ RUTAS DE LA TIENDA
// ==================================================
const productosRutas = require('./routes/productos.routes');
app.use('/api/productos', productosRutas);

const carritoRutas = require('./routes/carrito.routes');
app.use('/api/carrito', carritoRutas);

const pedidosRutas = require('./routes/pedidos.routes');
app.use('/api/pedidos', pedidosRutas);

const contactoRutas = require('./routes/contacto.routes');
app.use('/api/contacto', contactoRutas);

// ==================================================
// 💳 MERCADO PAGO
// ==================================================
app.post('/api/crear-preferencia-pago', async (req, res) => {
  try {
    const { productos, total, datosComprador } = req.body;
    const sesion_id = req.query.sesion_id || 'invitado';

    const items = productos.map(item => ({
      id: String(item.id),
      title: item.nombre,
      quantity: Number(item.cantidad),
      unit_price: Number(item.precio)
    }));

    const preferencia = new Preference(mpClient);
    const respuesta = await preferencia.create({
      body: {
        items,
        payer: {
          name: datosComprador?.nombre || 'Invitado',
          email: datosComprador?.whatsapp || 'cliente@maximuebles.com'
        },
        back_urls: {
          success: `${WEB_URL}/mi-cuenta/confirmacion.html`,
          failure: `${WEB_URL}/mi-cuenta/carrito.html`,
          pending: `${WEB_URL}/mi-cuenta/confirmacion.html`
        },
        auto_return: 'approved',
        notification_url: `${WEB_URL}/api/notificacion-pago?sesion_id=${sesion_id}`,
        external_reference: sesion_id
      }
    });

    res.json({ 
      ok: true, 
      mensaje: 'Preferencia creada', 
      urlPago: respuesta.init_point
    });
  } catch (error) {
    console.error('❌ Error Mercado Pago:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
});

// ==================================================
// ✅ ESTADO DEL SERVIDOR
// ==================================================
app.get('/api/estado', (req, res) => {
  res.json({
    ok: true,
    mensaje: '✅ Servidor en línea',
    empresa: NOMBRE_EMPRESA,
    cuit: CUIT_EMPRESA,
    mp: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
    carpeta_facturas: CARPETA_FACTURAS
  });
});

// ==================================================
// ✅ RUTAS AMIGABLES
// ==================================================
const rutasSinHtml = ['/index','/nosotros','/contacto','/ayuda','/comedor','/dormitorio','/living','/oficina','/ofertas'];
app.use((req, res, siguiente) => {
  if (rutasSinHtml.includes(req.path)) {
    return res.sendFile(path.join(__dirname, `../../${req.path.slice(1)}.html`));
  }
  siguiente();
});

// ==================================================
// ✅ INICIAR SERVIDOR
// ==================================================
app.listen(PUERTO, () => {
  console.log('='.repeat(60));
  console.log(`✅ SERVIDOR DE ${NOMBRE_EMPRESA} — EN LÍNEA`);
  console.log('='.repeat(60));
  console.log(`📍 Puerto: ${PUERTO}`);
  console.log(`🗄️  DB: Conectada ✅`);
  console.log(`💳 MP: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? '✅' : '❌'}`);
  console.log(`🔒 Carpeta facturacionadmin: PROTEGIDA`);
  console.log(`🔑 Descarga segura: /api/descargar-mi-factura/`);
  console.log(`📄 Carpeta PDFs: ${CARPETA_FACTURAS}`);
});