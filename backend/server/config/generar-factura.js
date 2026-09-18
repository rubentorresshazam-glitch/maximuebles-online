// ==================================================
// 🧾 GENERADOR DE FACTURAS PDF — MAXIMUEBLES
// ✅ MISMA RUTA EN TODO EL SISTEMA ✅
// ✅ FORMATO A4 VERTICAL → NO SE DESORDENA AL IMPRIMIR ✅
// ✅ NOMBRE DE ARCHIVO IGUAL EN DESCARGA ✅
// ==================================================
const fs = require('fs-extra'); // ✅ Crea carpetas automáticamente
const path = require('path');
const PDFDocument = require('pdfkit');

// ==================================================
// ✅ RUTA UNIFICADA — COINCIDE CON server.js y afip-facturacion.js
// ==================================================
const CARPETA_FACTURAS = path.join(__dirname, '../facturacionadmin/facturas-generadas');

// ✅ Crear carpeta completa si no existe
fs.ensureDirSync(CARPETA_FACTURAS);
console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);

// ==================================================
// ✅ FORMATEAR NÚMEROS CON COMA ARGENTINA
// ==================================================
function formatearMonto(n) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==================================================
// 🚀 FUNCIÓN PRINCIPAL
// ==================================================
async function crearFacturaPDF(datos) {
  return new Promise((resolve, reject) => {
    try {
      const numero = datos.numero;
      const cae = datos.cae || 'EN PROCESO';
      const vencimientoCAE = datos.vencimiento || '';
      const esOficial = datos.oficial !== false;

      // ✅ NOMBRE EXACTO → Coincide con descarga segura
      const nombreArchivo = `Factura-${numero}.pdf`;
      const rutaCompleta = path.join(CARPETA_FACTURAS, nombreArchivo);
      
      // ✅ Solo fecha, sin hora
      const fecha = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });

      console.log(`📄 Generando factura: ${numero}`);
      console.log(`📂 Guardando en: ${rutaCompleta}`);

      // ✅ DOCUMENTO A4 VERTICAL → Fijo para impresión
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 40, left: 40, right: 40, bottom: 50 }
      });

      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);

      // ======================================
      // ✅ ENCABEZADO — TU DISEÑO PRESERVADO
      // ======================================
      doc.fontSize(20).font('Helvetica-Bold').text('MAXIMUEBLES S.R.L.', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`CUIT: 30-71500272-4`, { align: 'center' });
      doc.text(`Domicilio Fiscal: Roque Sáenz Peña y Castillón — Luis Beltrán — Río Negro`, { align: 'center' });
      doc.text(`Punto de Venta N°: ${process.env.AFIP_PUNTO_VENTA || "00010"}`, { align: 'center' });
      doc.moveDown(1);

      // ✅ NÚMERO Y FECHA
      doc.fontSize(18).font('Helvetica-Bold').fillColor(esOficial ? '#22B548' : '#f59e0b');
      doc.text('FACTURA B', { align: 'right' });
      doc.fillColor('black');
      doc.fontSize(11).font('Helvetica');
      doc.text(`N°: ${numero}`, { align: 'right' });
      doc.text(`Fecha: ${fecha}`, { align: 'right' });
      doc.text(`CAE: ${cae}${vencimientoCAE ? ` — Vencimiento: ${vencimientoCAE}` : ''}`, { align: 'right' });
      doc.moveDown(1);

      // ✅ DATOS DEL COMPRADOR
      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COMPRADOR');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Nombre: ${datos.nombre || 'Consumidor Final'}`);
      doc.text(`DNI/CUIL: ${datos.dni || 'Consumidor Final'}`);
      doc.text(`Domicilio: ${datos.domicilio || 'Sin especificar'}`);
      doc.text(`WhatsApp: ${datos.whatsapp || 'No indicado'}`);
      doc.moveDown(1);

      // ✅ DETALLE DE PRODUCTOS — TABLA ORDENADA
      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE COMPRA');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');

      const productos = datos.productos || [];
      productos.forEach(p => {
        const subtotal = formatearMonto((p.precio || 0) * (p.cantidad || 1));
        doc.text(`• ${p.nombre || 'Producto'}  × ${p.cantidad || 1}  —  $ ${subtotal}`);
      });
      doc.moveDown(1);

      // ✅ TOTAL
      const total = formatearMonto(datos.total || 0);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#22B548');
      doc.text(`TOTAL A PAGAR: $ ${total}`, { align: 'right' });
      doc.fillColor('black');
      doc.moveDown(2);

      // ✅ PIE DE PÁGINA
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray')
        .text('Factura generada automáticamente — MaxiMuebles S.R.L.', { align: 'center' });

      doc.end();

      // ✅ ARCHIVO GUARDADO
      stream.on('finish', () => {
        console.log(`✅ FACTURA PDF LISTA: ${nombreArchivo}`);
        resolve({ 
          ok: true, 
          numero: numero, 
          archivo: nombreArchivo, // ← Coincide con BD
          ruta: rutaCompleta
        });
      });

      // ❌ ERROR
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

// ✅ EXPORTAR — para llamar desde el controlador y afip-facturacion
module.exports = { crearFacturaPDF };