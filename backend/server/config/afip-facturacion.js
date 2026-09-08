// ==================================================
// 🧾 FACTURACIÓN ELECTRÓNICA — MAXIMUEBLES S.R.L.
// CUIT: 30-71500272-4 · Punto de Venta: 00010
// ✅ SE GENERA Y SE MUESTRA EN LOGS PARA WHATSAPP
// ==================================================
const fs = require('fs');
const path = require('path');

// ✅ RUTA AUTOMÁTICA → funciona en Render y en tu PC
const CARPETA_FACTURAS = path.join(__dirname, '../../facturacionadmin/facturas-generadas');

// ✅ DATOS DE LA EMPRESA
const CUIT_EMPRESA = process.env.AFIP_CUIT || "30715002724";
const PUNTO_VENTA = process.env.AFIP_PUNTO_VENTA || "00010";

// ✅ Crear carpeta si no existe
if (!fs.existsSync(CARPETA_FACTURAS)) {
  try {
    fs.mkdirSync(CARPETA_FACTURAS, { recursive: true });
    console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);
  } catch (err) {
    console.log('⚠️ No se pudo crear carpeta de facturas:', err.message);
  }
}

// ✅ CONTADOR DE NÚMEROS DE FACTURA
const ARCHIVO_CONTADOR = path.join(CARPETA_FACTURAS, 'ultimo-numero.txt');
function obtenerUltimoNumero() {
  try {
    if (fs.existsSync(ARCHIVO_CONTADOR)) {
      return parseInt(fs.readFileSync(ARCHIVO_CONTADOR, 'utf8')) || 1000;
    }
  } catch (err) {
    console.log('⚠️ Leyendo contador desde 1000:', err.message);
  }
  return 1000;
}
function guardarUltimoNumero(n) {
  try {
    fs.writeFileSync(ARCHIVO_CONTADOR, String(n), 'utf8');
  } catch (err) {
    console.log('⚠️ No se pudo guardar número de factura:', err.message);
  }
}
function generarNumeroFactura() {
  const ult = obtenerUltimoNumero() + 1;
  guardarUltimoNumero(ult);
  return `${PUNTO_VENTA}-${String(ult).padStart(8, '0')}`;
}

// ==================================================
// 💾 GUARDAR FACTURA EN ARCHIVO
// ==================================================
function guardarFacturaEnArchivo(datos) {
  const numero = datos.numero;
  const nombreArchivo = `Factura-${numero}.txt`;
  const rutaCompleta = path.join(CARPETA_FACTURAS, nombreArchivo);
  const fecha = new Date().toLocaleString('es-AR');
  const contenido = `
============================================================
          F A C T U R A   E L E C T R Ó N I C A
               MAXIMUEBLES S.R.L.
           CUIT: 30-71500272-4
       Punto de Venta N°: 00010
============================================================
FACTURA N°: ${numero}
FECHA: ${fecha}
TIPO: CONSUMIDOR FINAL ✅
------------------------------------------------------------
DATOS DEL COMPRADOR
------------------------------------------------------------
Nombre: ${datos.nombre || "Consumidor Final"}
WhatsApp: ${datos.whatsapp || "No indicado"}
DNI/CUIL: ${datos.dni || "Consumidor Final"}
Domicilio: ${datos.domicilio || "Sin especificar"}
------------------------------------------------------------
DETALLE DE PRODUCTOS
------------------------------------------------------------
${datos.productos.map(p => `• ${p.nombre} x${p.cantidad} — $ ${(p.precio * p.cantidad).toFixed(2).replace('.', ',')}`).join('\n')}
------------------------------------------------------------
TOTAL A PAGAR: $ ${Number(datos.total).toFixed(2).replace('.', ',')}
------------------------------------------------------------
✅ Lista para enviar por WhatsApp
============================================================
  `.trim();
  
  try {
    fs.writeFileSync(rutaCompleta, contenido, 'utf8');
    console.log(`✅ Factura guardada: ${nombreArchivo}`);
    return rutaCompleta;
  } catch (err) {
    console.log('⚠️ No se pudo guardar archivo:', err.message);
    return null;
  }
}

// ==================================================
// 📱 GENERAR FACTURA Y MOSTRAR EN CONSOLA PARA WHATSAPP
// ==================================================
async function enviarCorreoConFactura(datos) {
  try {
    const numero = generarNumeroFactura();
    const datosCompletos = { ...datos, numero };

    // ✅ Guardar archivo
    guardarFacturaEnArchivo(datosCompletos);

    // ✅ Mostrar TODO en consola para copiar y enviar por WhatsApp
    console.log('');
    console.log('==================================================');
    console.log('📱 FACTURA PARA ENVIAR POR WHATSAPP');
    console.log('==================================================');
    console.log(`🧾 FACTURA N° ${numero} — MaxiMuebles`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Cliente: ${datos.nombre || 'Consumidor Final'}`);
    console.log(`📱 WhatsApp: ${datos.whatsapp || 'No indicado'}`);
    console.log(`🪪 DNI: ${datos.dni || 'Consumidor Final'}`);
    console.log(`📍 Domicilio: ${datos.domicilio || 'No indicado'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛒 Productos:');
    datos.productos.forEach(p => {
      console.log(`  • ${p.nombre} x${p.cantidad} — $ ${(p.precio * p.cantidad).toFixed(2).replace('.', ',')}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 TOTAL: $ ${Number(datos.total).toFixed(2).replace('.', ',')}`);
    console.log('==================================================');
    console.log(`✅ Copiá el texto de arriba y envíalo por WhatsApp`);
    console.log('');

    return numero;

  } catch (error) {
    console.log('⚠️ Error en facturación (pedido guardado OK):', error.message);
    return 'SIN-FACTURA';
  }
}

module.exports = { enviarCorreoConFactura };