// ==================================================
// 🧾 GENERADOR DE FACTURAS PDF — RUTA EN RAÍZ ✅
// ==================================================
const fs = require('fs-extra');
const path = require('path');
const PDFDocument = require('pdfkit');

// ✅ RUTA CORRECTA: subir dos niveles → raíz del proyecto
const CARPETA_FACTURAS = path.join(__dirname, '../../../facturacionadmin/facturas-generadas');
fs.ensureDirSync(CARPETA_FACTURAS);
console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);

function formatearMonto(n) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function generarFacturaPDF(datos) {
  return new Promise((resolve, reject) => {
    try {
      const numero = datos.numero;
      const cae = datos.cae || 'EN PROCESO';
      const nombreArchivo = `Factura-${numero}.pdf`;
      const rutaCompleta = path.join(CARPETA_FACTURAS, nombreArchivo);

      const fecha = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });

      console.log(`📄 Generando: ${numero} → ${rutaCompleta}`);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 40, left: 40, right: 40, bottom: 50 }
      });

      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);

      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('MAXIMUEBLES S.R.L.', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text('CUIT: 30-71500272-4', { align: 'center' });
      doc.text('Domicilio Fiscal: Roque Sáenz Peña y Castillón — Luis Beltrán — Río Negro', { align: 'center' });
      doc.text(`Punto de Venta N°: ${process.env.AFIP_PUNTO_VENTA || "00010"}`, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(18).font('Helvetica-Bold').text('FACTURA B', { align: 'right' });
      doc.fontSize(11).font('Helvetica');
      doc.text(`N°: ${numero}`, { align: 'right' });
      doc.text(`Fecha: ${fecha}`, { align: 'right' });
      doc.text(`CAE: ${cae}`, { align: 'right' });
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COMPRADOR');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Nombre: ${datos.nombre || 'Consumidor Final'}`);
      doc.text(`DNI/CUIL: ${datos.dni || 'Consumidor Final'}`);
      doc.text(`Domicilio: ${datos.domicilio || 'Sin especificar'}`);
      doc.text(`WhatsApp: ${datos.whatsapp || 'No indicado'}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE COMPRA');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      const productos = datos.productos || [];
      productos.forEach(p => {
        const subtotal = formatearMonto((p.precio || 0) * (p.cantidad || 1));
        doc.text(`• ${p.nombre || 'Producto'}  × ${p.cantidad || 1}  —  $ ${subtotal}`);
      });
      doc.moveDown(1);

      const total = formatearMonto(datos.total || 0);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#22B548');
      doc.text(`TOTAL A PAGAR: $ ${total}`, { align: 'right' });
      doc.fillColor('black');

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ PDF GUARDADO: ${nombreArchivo}`);
        resolve({ ok: true, archivo: nombreArchivo });
      });

      stream.on('error', (err) => {
        console.log(`❌ Error: ${err.message}`);
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generarFacturaPDF };