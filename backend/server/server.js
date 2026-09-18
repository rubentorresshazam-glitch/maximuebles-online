// ==================================================
// SERVIDOR MAXIMUEBLES · TIENDA ONLINE
// ✅ DESCARGA SEGURA DE FACTURAS + RUTAS CORRECTAS
// ✅ CONEXIÓN NEON + MERCADO PAGO + PDFKIT
// ==================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra'); // ✅ Cambiado a fs-extra
const db = require('./config/database');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

const CUIT_EMPRESA = process.env.CUIT_EMPRESA || "30715002724";
const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA || "MAXIMUEBLES S.R.L.";

const app = express();

// ==================================================
// ✅ MANTENER NEON DESPIERTO CADA 3 MINUTOS
// ==================================================
setInterval(async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Neon activo — Base de datos despierta');
  } catch (e) {
    console.log('⚠️ Neon durmiendo, despertando...');
  }
}, 180000);

// ==================================================
// ✅ CARPETA DE FACTURAS — RUTA CORRECTA Y GARANTIZADA
// ==================================================
const carpetaFacturas = path.join(__dirname, 'facturacionadmin', 'facturas-generadas');
fs.ensureDirSync(carpetaFacturas); // ✅ Crea toda la ruta si no existe
console.log('✅ Carpeta de facturas lista:', carpetaFacturas);

// ✅ BLOQUEAR ACCESO DIRECTO A LA CARPETA DE FACTURAS
app.use('/facturacionadmin/facturas-generadas/', (req, res) => {
  res.status(403).send('🔒 Acceso restringido — Solo administración');
});

// ✅ CARPETA PÚBLICA PARA ENLACES CORTOS (opcional, para WhatsApp)
app.use('/facturas-publicas', express.static(carpetaFacturas, {
  setHeaders: (res) => {
    res.set('Content-Disposition', 'attachment'); // Fuerza descarga
  }
}));

// ==================================================
// ✅ DESCARGA SEGURA DE FACTURAS — POR sesion_id
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
      console.log("❌ NO encontrado. sesion_id =", sesionId);
      const todos = await db.query('SELECT sesion_id FROM pedidos ORDER BY id DESC LIMIT 5');
      console.log("📋 Últimos 5 sesion_id en BD:", todos.rows.map(r => r.sesion_id));
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:red;">⚠️ Factura no encontrada</h2>
          <p>No hay pedido asociado a esta sesión.</p>
          <a href="/mi-cuenta/confirmacion.html">Volver a tu compra</a>
        </html>
      `);
    }

    const { factura_numero, factura_archivo, id } = resultado.rows[0];
    console.log("✅ Pedido encontrado — ID:", id, "Factura:", factura_numero);

    if (!factura_numero || factura_numero === 'Pendiente') {
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:orange;">📄 Factura en proceso</h2>
          <p>La factura aún no fue generada. Volvé a intentar en unos segundos.</p>
          <a href="/mi-cuenta/confirmacion.html">Volver</a>
        </html>
      `);
    }

    // ✅ Usar nombre de archivo guardado O armarlo
    let nombreArchivo = factura_archivo;
    if (!nombreArchivo) {
      let nroLimpio = factura_numero.includes('|') 
        ? factura_numero.split('|')[0].trim() 
        : factura_numero;
      nombreArchivo = `Factura-${nroLimpio}.pdf`;
    }

    const rutaCompletaArchivo = path.join(carpetaFacturas, nombreArchivo);
    console.log("📄 Buscando:", rutaCompletaArchivo);
    console.log("✅ Existe:", fs.existsSync(rutaCompletaArchivo));

    if (!fs.existsSync(rutaCompletaArchivo)) {
      console.log("❌ Archivo NO existe");
      const archivos = fs.readdirSync(carpetaFacturas);
      console.log("📋 Archivos en carpeta:", archivos);
      return res.status(404).send(`
        <html style="font-family:system-ui;text-align:center;padding:3rem;">
          <h2 style="color:red;">❌ PDF no encontrado</h2>
          <p>El archivo no se generó correctamente. Contactanos.</p>
        </html>
      `);
    }

    res.download(rutaCompletaArchivo, nombreArchivo, (err) => {
      if (err) {
        console.log('❌ Error descargando:', err.message);
        res.status(500).send('Error al descargar');
      } else {
        console.log("✅ Descarga entregada:", nombreArchivo);
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

// ✅ ARCHIVOS ESTÁTICOS — DESDE RAÍZ
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
      datos: respuesta,
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
    carpeta_facturas: carpetaFacturas
  });
});

// ==================================================
// ✅ RUTAS AMIGABLES SIN .HTML
// ==================================================
const rutasSinHtml = ['/index','/nosotros','/contacto','/ayuda','/comedor','/dormitorio','/living','/oficina','/ofertas'];
app.use((req, res, siguiente) => {
  if (rutasSinHtml.includes(req.path)) {
    return res.sendFile(path.join(__dirname, `../../${req.path.slice(1)}.html`));
  }
  siguiente();
});

// ✅ CACHÉ DE RECURSOS
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
  console.log(`🗄️  DB: Conectada ✅`);
  console.log(`💳 MP: ${process.env.MERCADO_PAGO_ACCESS_TOKEN ? '✅' : '❌'}`);
  console.log(`🔒 Carpeta facturacionadmin: PROTEGIDA`);
  console.log(`🔑 Descarga segura: /api/descargar-mi-factura/`);
  console.log(`📄 Carpeta PDFs: ${carpetaFacturas}`);
});