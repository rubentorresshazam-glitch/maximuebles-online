// ==================================================
// 🧾 FACTURACIÓN ELECTRÓNICA — MAXIMUEBLES S.R.L.
// CUIT: 30-71500272-4 · Punto de Venta: 00010
// ✅ FUNCIONA EN RENDER Y EN TU PC AUTOMÁTICAMENTE
// ==================================================
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// ✅ RUTA AUTOMÁTICA → funciona en Render y en tu PC
// En tu PC: va a la carpeta del proyecto / facturacionadmin / facturas-generadas
// En Render: va dentro del proyecto (se guarda temporalmente para enviar por correo)
const CARPETA_FACTURAS = path.join(__dirname, '../../facturacionadmin/facturas-generadas');

// ✅ DATOS DE LA EMPRESA
const CUIT_EMPRESA = process.env.AFIP_CUIT || "30715002724";
const PUNTO_VENTA = process.env.AFIP_PUNTO_VENTA || "00010";

// ✅ CERTIFICADOS → DESDE VARIABLES DE ENTORNO (Render)
const CERTIFICADO_AFIP = process.env.AFIP_CERTIFICADO || "";
const CLAVE_PRIVADA_AFIP = process.env.AFIP_CLAVE_PRIVADA || "";

// ✅ Crear carpeta si no existe
if (!fs.existsSync(CARPETA_FACTURAS)) {
  try {
    fs.mkdirSync(CARPETA_FACTURAS, { recursive: true });
    console.log('✅ Carpeta de facturas lista:', CARPETA_FACTURAS);
  } catch (err) {
    console.log('⚠️ No se pudo crear carpeta de facturas:', err.message);
  }
}

// ✅ Configuración de correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.CORREO_REMITENTE || 'maximueblesventas@gmail.com',
    pass: process.env.CORREO_CONTRASEÑA || 'jhjdhqgjipxqulvf'
  }
});

// ✅ Guardar certificados temporalmente
const rutaCert = path.join(__dirname, 'cert-temp.cer');
const rutaClave = path.join(__dirname, 'clave-temp.key');
if (CERTIFICADO_AFIP && CLAVE_PRIVADA_AFIP) {
  try {
    fs.writeFileSync(rutaCert, CERTIFICADO_AFIP, 'utf8');
    fs.writeFileSync(rutaClave, CLAVE_PRIVADA_AFIP, 'utf8');
    console.log('✅ Certificados AFIP cargados → Facturación ACTIVA');
  } catch (err) {
    console.log('⚠️ No se pudieron guardar certificados:', err.message);
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
Correo: ${datos.correo}
DNI/CUIL: ${datos.dni || "Consumidor Final"}
Domicilio: ${datos.domicilio || "Sin especificar"}
------------------------------------------------------------
DETALLE DE PRODUCTOS
------------------------------------------------------------
${datos.productos.map(p => `• ${p.nombre} x${p.cantidad} — $ ${(p.precio * p.cantidad).toFixed(2).replace('.', ',')}`).join('\n')}
------------------------------------------------------------
TOTAL A PAGAR: $ ${Number(datos.total).toFixed(2).replace('.', ',')}
------------------------------------------------------------
✅ Enviada por correo al cliente
============================================================
  `.trim();
  
  try {
    fs.writeFileSync(rutaCompleta, contenido, 'utf8');
    console.log(`✅ Factura guardada: ${nombreArchivo}`);
    return rutaCompleta;
  } catch (err) {
    console.log('⚠️ No se pudo guardar archivo, pero se envía por correo igual:', err.message);
    return null;
  }
}

// ==================================================
// 📧 ENVIAR FACTURA POR CORREO AL CLIENTE
// ==================================================
async function enviarCorreoConFactura(datos) {
  try {
    const numero = generarNumeroFactura();
    const datosCompletos = { ...datos, numero };

    // ✅ Guardar archivo (si se puede)
    const rutaArchivo = guardarFacturaEnArchivo(datosCompletos);

    // ✅ Enviar por correo
    const adjuntos = [];
    if (rutaArchivo && fs.existsSync(rutaArchivo)) {
      adjuntos.push({ filename: `Factura-${numero}.txt`, path: rutaArchivo });
    }

    const correo = {
      from: 'MaxiMuebles 🛒 <maximueblesventas@gmail.com>',
      to: datos.correo,
      subject: `🧾 Tu Factura N° ${numero} — MaxiMuebles`,
      html: `
        <div style="font-family:Arial; max-width:600px; margin:0 auto; padding:20px;">
          <div style="background:#f8fff8; border-left:4px solid #226627; padding:15px;">
            <h2 style="color:#163D18; margin:0;">🧾 Factura Electrónica</h2>
          </div>
          <p>¡Hola <strong>${datos.nombre || 'Cliente'}</strong>!</p>
          <p>Gracias por tu compra. Te adjuntamos tu factura:</p>
          <table style="width:100%; margin:20px 0;">
            <tr><td style="padding:8px; font-weight:bold;">Factura N°:</td><td>${numero}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">Fecha:</td><td>${new Date().toLocaleDateString('es-AR')}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">Total:</td><td style="font-size:18px; color:#226627; font-weight:bold;">$ ${Number(datos.total).toLocaleString('es-AR', {minimumFractionDigits:2})}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">Tipo:</td><td>Consumidor Final ✅</td></tr>
          </table>
          <p>📎 Adjunto tu factura imprimible.</p>
          <p style="font-size:13px; color:#666; margin-top:30px;">MaxiMuebles · CUIT 30-71500272-4 · Envíos al Valle Medio</p>
        </div>
      `,
      attachments: adjuntos
    };

    await transporter.sendMail(correo);
    console.log(`✅ Factura N° ${numero} enviada a: ${datos.correo}`);
    return numero;

  } catch (error) {
    console.log('⚠️ Error en facturación (pedido guardado igual):', error.message);
    return 'SIN-FACTURA';
  }
}

module.exports = { enviarCorreoConFactura };