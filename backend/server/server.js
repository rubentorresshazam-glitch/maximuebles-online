// ==================================================
// SERVIDOR MAXIMUEBLES · TIENDA ONLINE
// Conectado con: Neon PostgreSQL · Mercado Pago
// ✅ CARPETA DE FACTURACIÓN PROTEGIDA
// ==================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ✅ CONEXIÓN A BASE DE DATOS
const db = require('./config/database');

// ✅ MERCADO PAGO
const { MercadoPagoConfig, Preference } = require('mercadopago');
const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

const CUIT_EMPRESA = process.env.CUIT_EMPRESA || "30715002724";
const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA || "MAXIMUEBLES S.R.L.";

// ==================================================
// ✅ PROTEGER CARPETA DE FACTURACIÓN → SOLO ADENTRO DEL SERVIDOR
// ==================================================
const app = express();

// 🔒 PROTEGER SOLO LA CARPETA DE FACTURAS GENERADADAS (donde están los PDF)
// ✅ EL RESTO DE LA CARPETA facturacionadmin SE PUEDE LEER LIBREMENTE
app.use('/facturacionadmin/facturas-generadas/', (req, res) => {
  res.status(403).send('🔒 Acceso restringido — Solo administración');
});

// ✅ NO HAY BLOQUEO EN EL RESTO → facturacion.html, .css y .js SE CARGAN SOLOS
// ==================================================
// CONFIGURACIÓN
// ==================================================
const PUERTO = process.env.PORT || 10000;
const WEB_URL = process.env.WEB_URL || "https://maximuebles-online.onrender.com";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../')));

// ==================================================
// ✅ RUTAS
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
// 💳 MERCADO PAGO — AHORA LEE WHATSAPP
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
          // ✅ WHATSAPP EN LUGAR DE CORREO
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

    res.json({ ok: true, mensaje: 'Preferencia creada', datos: respuesta });
  } catch (error) {
    console.error('❌ Error MP:', error.message);
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
    mp: !!process.env.MERCADO_PAGO_ACCESS_TOKEN
  });
});

// ==================================================
// ✅ CACHÉ Y URLS LIMPIAS
// ==================================================
app.use((req, res, siguiente) => {
  const rutasSinHtml = ['/index','/nosotros','/contacto','/ayuda','/comedor','/dormitorio','/living','/oficina','/ofertas'];
  if (rutasSinHtml.includes(req.path)) {
    return res.sendFile(path.join(__dirname, `../../${req.path.slice(1)}.html`));
  }
  siguiente();
});

const unDia = 86400000, unaSemana = unDia * 7;
app.use('/assets', express.static(path.join(__dirname, '../../assets'), { maxAge: unaSemana }));
app.use('/css', express.static(path.join(__dirname, '../../css'), { maxAge: unDia * 3 }));
app.use('/js', express.static(path.join(__dirname, '../../js'), { maxAge: unDia * 3 }));

// ==================================================
// ✅ INICIAR SERVIDOR
// ==================================================
app.listen(PUERTO, () => {
  console.log('='.repeat(60));
  console.log(`✅ SERVIDOR DE ${NOMBRE_EMPRESA} — EN LÍNEA`);
  console.log('='.repeat(60));
  console.log(`📍 Puerto: ${PUERTO}`);
  console.log(`🗄️  DB: ${process.env.DB_HOST ? '✅' : '❌'}`);
  console.log(`💳 MP: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? '✅' : '❌'}`);
  console.log(`🔒 Carpeta facturacionadmin: PROTEGIDA`);
});