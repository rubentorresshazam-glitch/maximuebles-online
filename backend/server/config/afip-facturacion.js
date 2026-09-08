// ==================================================
// 🧾 FACTURACIÓN ELECTRÓNICA — MAXIMUEBLES S.R.L.
// ✅ SE GENERA AUTOMÁTICAMENTE EN PDF Y SE GUARDA
// ==================================================
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit'); // ✅ Genera PDF

// ✅ RUTA DE TU CARPETA DE FACTURAS
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
// 💾 GENERAR FACTURA EN PDF AUTOMÁTICAMENTE
// ==================================================
async function generarFacturaPDF(datos) {
  return new Promise((resolve, reject) => {
    const numero = datos.numero;
    const nombreArchivo = `Factura-${numero}.pdf`;
    const rutaCompleta = path.join(CARPETA_FACTURAS, nombreArchivo);
    const fecha = new Date().toLocaleString('es-AR');

    // ✅ Crear documento PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(rutaCompleta);
    doc.pipe(stream);

    // ✅ CONTENIDO DE LA FACTURA
    doc.fontSize(20).font('Helvetica-Bold').text('FACTURA ELECTRÓNICA', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('MAXIMUEBLES S.R.L.', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text(`CUIT: 30-71500272-4`, { align: 'center' });
    doc.text(`Domicilio Fiscal: Roque Sáenz Peña y Castillón N° 0 - Luis Beltrán - Río Negro`, { align: 'center' });
    doc.text(`Punto de Venta N°: ${PUNTO_VENTA}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text(`FACTURA N°: ${numero}`);
    doc.fontSize(11).font('Helvetica').text(`Fecha: ${fecha}`);
    doc.text(`Tipo: Consumidor Final`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COMPRADOR');
    doc.fontSize(11).font('Helvetica');
    doc.text(`Nombre: ${datos.nombre || 'Consumidor Final'}`);
    doc.text(`WhatsApp: ${datos.whatsapp || 'No indicado'}`);
    doc.text(`DNI/CUIL: ${datos.dni || 'Consumidor Final'}`);
    doc.text(`Domicilio: ${datos.domicilio || 'Sin especificar'}`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS');
    doc.fontSize(11).font('Helvetica');
    const productos = datos.productos || [];
    productos.forEach(p => {
      const subtotal = (p.precio * p.cantidad).toFixed(2).replace('.', ',');
      doc.text(`• ${p.nombre}  x${p.cantidad}  —  $ ${subtotal}`);
    });
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL A PAGAR: $ ${Number(datos.total).toFixed(2).replace('.', ',')}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray').text('Factura generada automáticamente — MaxiMuebles S.R.L.', { align: 'center' });

    doc.end();
    stream.on('finish', () => {
      console.log(`✅ FACTURA PDF GENERADA: ${rutaCompleta}`);
      resolve({ numero, ruta: rutaCompleta });
    });
    stream.on('error', reject);
  });
}

// ==================================================
// 🚀 FUNCIÓN PRINCIPAL — SE LLAMA DESDE EL PEDIDO
// ==================================================
async function enviarCorreoConFactura(datos) {
  try {
    const numero = generarNumeroFactura();
    const datosCompletos = { ...datos, numero };

    // ✅ GENERA EL PDF AUTOMÁTICAMENTE
    await generarFacturaPDF(datosCompletos);

    // ✅ MUESTRA DATOS EN CONSOLA PARA ENVIAR POR WHATSAPP
    console.log('');
    console.log('==================================================');
    console.log('📱 FACTURA GENERADA — ENVIAR POR WHATSAPP');
    console.log('==================================================');
    console.log(`🧾 FACTURA N° ${numero} — MaxiMuebles`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Cliente: ${datos.nombre || 'Consumidor Final'}`);
    console.log(`📱 WhatsApp: ${datos.whatsapp || 'No indicado'}`);
    console.log(`🪪 DNI: ${datos.dni || 'Consumidor Final'}`);
    console.log(`📍 Domicilio: ${datos.domicilio || 'No indicado'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 TOTAL: $ ${Number(datos.total).toFixed(2).replace('.', ',')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📂 PDF guardado en: facturacionadmin/facturas-generadas/Factura-${numero}.pdf`);
    console.log('==================================================');

    return numero;
  } catch (error) {
    console.log('⚠️ Error al generar factura PDF (pedido guardado OK):', error.message);
    return 'SIN-FACTURA';
  }
}

module.exports = { enviarCorreoConFactura };