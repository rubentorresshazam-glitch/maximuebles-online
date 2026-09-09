// ==================================================
// 🧾 GENERADOR DE FACTURAS PDF — MAXIMUEBLES
// ✅ ARCHIVO EXCLUSIVO PARA GENERAR FACTURAS
// ✅ Ruta garantizada en Render y en tu PC
// ==================================================
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdfkit');

// ✅ RUTA INTELIGENTE: funciona en TU PC y en RENDER
const CARPETA_FACTURAS = process.env.NODE_ENV === 'production'
  ? require('os').tmpdir() // En Render: carpeta garantizada
  : path.join(__dirname, '../../../facturacionadmin/facturas-generadas'); // En tu PC: tu carpeta

// ✅ Crear carpeta si no existe
if (!fs.existsSync(CARPETA_FACTURAS)) {
  try {
    fs.mkdirSync(CARPETA_FACTURAS, { recursive: true });
    console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);
  } catch (err) {
    console.log('⚠️ Usando carpeta temporal:', err.message);
    CARPETA_FACTURAS = require('os').tmpdir();
  }
}

// ==================================================
// 🚀 FUNCIÓN PRINCIPAL — SE LLAMA DESDE DONDE QUIERAS
// ==================================================
async function crearFacturaPDF(datos) {
  return new Promise((resolve, reject) => {
    try {
      const numero = datos.numero;
      const cae = datos.cae || 'EN PROCESO';
      const nombreArchivo = `Factura-${numero}.pdf`;
      const rutaCompleta = path.join(CARPETA_FACTURAS, nombreArchivo);
      const fecha = new Date().toLocaleString('es-AR');

      console.log(`📄 Generando factura: ${numero}`);
      console.log(`📂 Guardando en: ${rutaCompleta}`);

      // ✅ Crear documento PDF
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);

      // ✅ CABECERA — DATOS DE LA EMPRESA
      doc.fontSize(20).font('Helvetica-Bold').text('FACTURA ELECTRÓNICA', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text('MAXIMUEBLES S.R.L.', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`CUIT: 30-71500272-4`, { align: 'center' });
      doc.text(`Domicilio Fiscal: Roque Sáenz Peña y Castillón N° 0 - Luis Beltrán - Río Negro`, { align: 'center' });
      doc.text(`Punto de Venta N°: ${process.env.AFIP_PUNTO_VENTA || "00010"}`, { align: 'center' });
      doc.moveDown(1);

      // ✅ NÚMERO Y FECHA
      doc.fontSize(12).font('Helvetica-Bold').text(`FACTURA N°: ${numero}`);
      doc.fontSize(11).font('Helvetica').text(`Fecha: ${fecha}`);
      doc.text(`Tipo: Consumidor Final`);
      doc.text(`CAE: ${cae}`);
      if (datos.vencimientoCAE) {
        doc.text(`Vencimiento CAE: ${datos.vencimientoCAE}`);
      }
      doc.moveDown(1);

      // ✅ DATOS DEL COMPRADOR
      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COMPRADOR');
      doc.fontSize(11).font('Helvetica');
      doc.text(`Nombre: ${datos.nombre || 'Consumidor Final'}`);
      doc.text(`WhatsApp: ${datos.whatsapp || 'No indicado'}`);
      doc.text(`DNI/CUIL: ${datos.dni || 'Consumidor Final'}`);
      doc.text(`Domicilio: ${datos.domicilio || 'Sin especificar'}`);
      doc.moveDown(1);

      // ✅ DETALLE DE PRODUCTOS
      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS');
      doc.fontSize(11).font('Helvetica');
      const productos = datos.productos || [];
      productos.forEach(p => {
        const subtotal = (p.precio * p.cantidad).toFixed(2).replace('.', ',');
        doc.text(`• ${p.nombre}  x${p.cantidad}  —  $ ${subtotal}`);
      });
      doc.moveDown(1);

      // ✅ TOTAL
      doc.fontSize(14).font('Helvetica-Bold').text(
        `TOTAL A PAGAR: $ ${Number(datos.total).toFixed(2).replace('.', ',')}`, 
        { align: 'right' }
      );
      doc.moveDown(2);

      // ✅ PIE DE PÁGINA
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray')
        .text('Factura generada automáticamente — MaxiMuebles S.R.L.', { align: 'center' });

      doc.end();

      // ✅ CUANDO TERMINA DE GUARDARSE
      stream.on('finish', () => {
        console.log(`✅ FACTURA PDF GENERADA: ${rutaCompleta}`);
        resolve({ 
          ok: true, 
          numero: numero, 
          ruta: rutaCompleta,
          nombreArchivo: nombreArchivo
        });
      });

      // ❌ SI HAY ERROR
      stream.on('error', (err) => {
        console.log(`❌ ERROR AL GUARDAR PDF: ${err.message}`);
        reject(new Error(`No se pudo guardar la factura: ${err.message}`));
      });

    } catch (error) {
      console.log(`❌ ERROR CREANDO PDF: ${error.message}`);
      reject(error);
    }
  });
}

// ✅ EXPORTAR PARA USARLO DESDE DONDE SEA
module.exports = { crearFacturaPDF };