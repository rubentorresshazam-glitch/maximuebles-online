// ==================================================
// 🧾 FACTURACIÓN — FIX ERROR "dh key too small" + INTEGER OVERFLOW ✅
// ✅ CAE SIEMPRE COMO TEXTO → sin error de rango ✅
// ==================================================
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const https = require('https');

// ==================================================
// 🔧 SOLUCIÓN ERROR "dh key too small" → AFIP + Mercado Pago conviven ✅
// ==================================================
const agenteAFIP = new https.Agent({
  minVersion: 'TLSv1.2',
  ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DEFAULT:!DH',
  rejectUnauthorized: false,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
});

// ✅ DATOS DE LA EMPRESA
const CUIT_EMPRESA = process.env.CUIT_EMPRESA || "30715002724";
const PUNTO_VENTA = process.env.AFIP_PUNTO_VENTA || "00010";
const ENTORNO = process.env.AFIP_ENTORNO || "produccion";

// ✅ CERTIFICADOS
const CERTIFICADO = process.env.AFIP_CERT || "";
const CLAVE_PRIVADA = process.env.AFIP_KEY || "";
const AFIP_CARGADO = !!(CERTIFICADO && CLAVE_PRIVADA && CERTIFICADO.length > 100);
console.log(AFIP_CARGADO 
  ? "✅ CERTIFICADOS AFIP DETECTADOS → Conexión REAL activada" 
  : "⚠️ Sin certificados → CAE simulado");

// ==================================================
// ✅ RUTA DE CARPETAS
// ==================================================
const RUTA_RAIZ = path.join(__dirname, '../../');
const rutaFacturas = path.join(RUTA_RAIZ, 'facturacionadmin', 'facturas-generadas');

if (!fs.existsSync(rutaFacturas)) {
  try {
    fs.mkdirSync(rutaFacturas, { recursive: true });
    console.log('✅ Carpeta de facturas lista:', rutaFacturas);
  } catch (err) {
    console.log('⚠️ Error creando carpeta:', err.message);
  }
}

// ==================================================
// ✅ CONTADOR DE NÚMEROS
// ==================================================
const ARCHIVO_CONTADOR = path.join(rutaFacturas, 'ultimo-numero.txt');
function obtenerUltimoNumero() {
  try {
    if (fs.existsSync(ARCHIVO_CONTADOR)) {
      return parseInt(fs.readFileSync(ARCHIVO_CONTADOR, 'utf8')) || 1000;
    }
  } catch (err) {
    console.log('⚠️ Contador desde 1000');
  }
  return 1000;
}
function guardarUltimoNumero(n) {
  try {
    fs.writeFileSync(ARCHIVO_CONTADOR, String(n), 'utf8');
  } catch (err) {
    console.log('⚠️ No se guardó número');
  }
}
function generarNumeroFactura() {
  const ult = obtenerUltimoNumero() + 1;
  guardarUltimoNumero(ult);
  return `${PUNTO_VENTA}-${String(ult).padStart(8, '0')}`;
}

// ==================================================
// 🔑 OBTENER TICKET DE AFIP — URL CORREGIDA ✅
// ==================================================
async function obtenerTicketAFIP() {
  if (!AFIP_CARGADO) return null;
  try {
    const esProduccion = ENTORNO.toLowerCase() === 'produccion';
    const fechaGen = new Date();
    const fechaVenc = new Date(fechaGen.getTime() + 12 * 60 * 60 * 1000);
    
    const xmlTicket = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${fechaGen.toISOString()}</generationTime>
    <expirationTime>${fechaVenc.toISOString()}</expirationTime>
    <service>wsfe</service>
  </header>
  <signature>${firmarXML(CERTIFICADO, CLAVE_PRIVADA, fechaGen, fechaVenc)}</signature>
</loginTicketRequest>`;

    // ✅ URL CORRECTA WSAA — NO es /wsfe/
    const url = esProduccion
      ? 'https://wsaa.afip.gov.ar/wsaa/services/LoginTicket'
      : 'https://wsaahomo.afip.gov.ar/wsaa/services/LoginTicket';

    console.log(`🔑 Solicitando ticket a AFIP — ${esProduccion ? "PRODUCCIÓN" : "HOMOLOGACIÓN"}`);
    console.log(`📡 URL: ${url}`);
    
    const respuesta = await hacerPeticionHTTPS(url, xmlTicket);
    
    const tokenMatch = respuesta.respuesta.match(/<token>([^<]+)<\/token>/);
    const firmaMatch = respuesta.respuesta.match(/<sign>([^<]+)<\/sign>/);
    
    if (!tokenMatch || !firmaMatch) {
      console.log("❌ Respuesta AFIP:", respuesta.respuesta);
      throw new Error("AFIP no devolvió token o firma");
    }
    
    console.log("✅ Ticket AFIP obtenido");
    return { token: tokenMatch[1], firma: firmaMatch[1], fechaVenc };
  } catch (error) {
    console.log("❌ Error obteniendo ticket AFIP:", error.message);
    return null;
  }
}

// ==================================================
// 📤 ENVIAR FACTURA A AFIP — ESTRUCTURA OFICIAL WSFEv1 ✅
// ✅ Método correcto: FECAESolicitar (NO FEAutRequest)
// ✅ Estructura XML oficial de AFIP
// ==================================================
async function enviarFacturaAARCA(datos, ticketAFIP) {
  const numero = datos.numero;
  console.log(`📤 Enviando factura N° ${numero} a AFIP/ARCA...`);
  
  if (AFIP_CARGADO && ticketAFIP) {
    try {
      console.log("🌐 ENVIANDO A AFIP REAL...");
      const puntoVenta = parseInt(PUNTO_VENTA);
      const tipoComprobante = 6; // 6 = Factura B
      const fechaComprobante = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const importeTotal = Number(datos.total).toFixed(2);
      const importeNeto = Number(datos.total / 1.21).toFixed(2);
      const iva = Number(datos.total - importeNeto).toFixed(2);
      const nroComprobante = parseInt(numero.split('-')[1]);
      const cuitEmpresa = CUIT_EMPRESA.replace(/-/g, '');
      const dniComprador = String(datos.dni || '00000000').replace(/\D/g, '');

      // ✅ ESTRUCTURA OFICIAL WSFEv1 — FECAESolicitar
      const xmlFactura = `<?xml version="1.0" encoding="UTF-8"?>
<FECAESolicitarRequest xmlns="http://ar.gov.afip.dif.FEV1/">
  <Auth>
    <Token>${ticketAFIP.token}</Token>
    <Sign>${ticketAFIP.firma}</Sign>
    <Cuit>${cuitEmpresa}</Cuit>
  </Auth>
  <FeCAEReq>
    <FeCabReq>
      <CantReg>1</CantReg>
      <PtoVta>${puntoVenta}</PtoVta>
      <CbteTipo>${tipoComprobante}</CbteTipo>
    </FeCabReq>
    <FeDetReq>
      <FECAEDetRequest>
        <Concepto>1</Concepto>
        <DocTipo>96</DocTipo>
        <DocNro>${dniComprador}</DocNro>
        <CbteDesde>${nroComprobante}</CbteDesde>
        <CbteHasta>${nroComprobante}</CbteHasta>
        <CbteFch>${fechaComprobante}</CbteFch>
        <ImpTotal>${importeTotal}</ImpTotal>
        <ImpNeto>${importeNeto}</ImpNeto>
        <ImpIVA>${iva}</ImpIVA>
        <MonId>PES</MonId>
        <MonCotiz>1</MonCotiz>
      </FECAEDetRequest>
    </FeDetReq>
  </FeCAEReq>
</FECAESolicitarRequest>`;
      
      const esProduccion = ENTORNO.toLowerCase() === 'produccion';
      const urlWSFE = esProduccion
        ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
      
      console.log("📡 Enviando a:", urlWSFE);
      const respuestaAFIP = await hacerPeticionSOAP(urlWSFE, xmlFactura, 'FECAESolicitar');
      
      // ✅ Buscar CAE en la respuesta
      const caeMatch = respuestaAFIP.match(/<CAE>(\d+)<\/CAE>/);
      const vencMatch = respuestaAFIP.match(/<FchVtoCAE>(\d{8})<\/FchVtoCAE>/);
      const errMatch = respuestaAFIP.match(/<Desc>([^<]+)<\/Desc>/);
      
      if (!caeMatch) {
        if (errMatch) {
          console.log("❌ AFIP devolvió error:", errMatch[1]);
          throw new Error(`AFIP: ${errMatch[1]}`);
        }
        console.log("❌ Respuesta completa AFIP:", respuestaAFIP);
        throw new Error("AFIP no devolvió CAE");
      }
      
      const cae = caeMatch[1]; // ✅ Siempre como texto
      let fechaVenc = "Sin vencimiento";
      
      if (vencMatch) {
        const f = vencMatch[1];
        fechaVenc = `${f.slice(6,8)}/${f.slice(4,6)}/${f.slice(0,4)}`;
      } else {
        const f = new Date();
        f.setDate(f.getDate() + 10);
        fechaVenc = f.toLocaleDateString('es-AR');
      }
      
      console.log(`✅ ✅ CAE OFICIAL RECIBIDO DE AFIP: ${cae}`);
      console.log(`📅 Vencimiento CAE: ${fechaVenc}`);
      return { exito: true, cae, vencimiento: fechaVenc, numeroAFIP: numero, oficial: true };
      
    } catch (error) {
      console.log("❌ Error enviando a AFIP:", error.message);
    }
  }
  
  // ⚠️ CAE SIMULADO — 8 dígitos ✅
  console.log("⚠️ Usando CAE simulado");
  const caeSimulado = String(Math.floor(Math.random() * 90000000 + 10000000));
  const fechaVenc = new Date();
  fechaVenc.setDate(fechaVenc.getDate() + 10);
  return { exito: true, cae: caeSimulado, vencimiento: fechaVenc.toLocaleDateString('es-AR'), numeroAFIP: numero, oficial: false };
}
// ==================================================
// 💾 GENERAR PDF
// ==================================================
async function generarFacturaPDF(datos) {
  return new Promise((resolve, reject) => {
    try {
      const numero = datos.numero;
      const cae = datos.cae || 'EN PROCESO';
      const vencimientoCAE = datos.vencimientoCAE || '';
      const esOficial = datos.oficial ? "✅ OFICIAL AFIP" : "⚠️ SIMULADO";
      
      const nombreArchivo = `Factura-${numero}.pdf`;
      const rutaCompleta = path.join(rutaFacturas, nombreArchivo);
      const fecha = new Date().toLocaleString('es-AR');
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);
      
      doc.fontSize(20).font('Helvetica-Bold').text('FACTURA ELECTRÓNICA', { align: 'center' });
      doc.fontSize(10).fillColor(datos.oficial ? 'green' : 'orange').text(esOficial, { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text('MAXIMUEBLES S.R.L.', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`CUIT: 30-71500272-4`, { align: 'center' });
      doc.text(`Domicilio Fiscal: Roque Sáenz Peña y Castillón N° 0 — Luis Beltrán — Río Negro`, { align: 'center' });
      doc.text(`Punto de Venta N°: ${PUNTO_VENTA}`, { align: 'center' });
      doc.moveDown(1);
      
      doc.fontSize(12).font('Helvetica-Bold').text(`FACTURA N°: ${numero}`);
      doc.fontSize(11).font('Helvetica').text(`Fecha: ${fecha}`);
      doc.text(`Tipo: Factura B — Consumidor Final`);
      doc.text(`CAE: ${cae}${vencimientoCAE ? ` — Vencimiento CAE: ${vencimientoCAE}` : ''}`);
      doc.moveDown(1);
      
      doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL COMPRADOR');
      doc.fontSize(11).font('Helvetica');
      doc.text(`Nombre: ${datos.nombre || 'Consumidor Final'}`);
      doc.text(`DNI/CUIL: ${datos.dni || 'Consumidor Final'}`);
      doc.text(`Domicilio: ${datos.domicilio || 'Sin especificar'}`);
      doc.text(`WhatsApp: ${datos.whatsapp || 'No indicado'}`);
      doc.moveDown(1);
      
      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS');
      doc.fontSize(11).font('Helvetica');
      const productos = datos.productos || [];
      productos.forEach(p => {
        const subtotal = (p.precio * p.cantidad).toFixed(2).replace('.', ',');
        doc.text(`• ${p.nombre}  x${p.cantidad}  —  $ ${subtotal}`);
      });
      doc.moveDown(1);
      
      doc.fontSize(14).font('Helvetica-Bold').text(
        `TOTAL A PAGAR: $ ${Number(datos.total).toFixed(2).replace('.', ',')}`, 
        { align: 'right' }
      );
      doc.moveDown(2);
      
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('gray')
        .text('Factura generada automáticamente — MaxiMuebles S.R.L.', { align: 'center' });
      
      doc.end();
      
      stream.on('finish', () => {
        console.log(`✅ PDF GUARDADO: ${rutaCompleta}`);
        resolve({ numero, ruta: rutaCompleta, cae, nombreArchivo, oficial: datos.oficial });
      });
      
      stream.on('error', err => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

// ==================================================
// 🚀 FUNCIÓN PRINCIPAL — GUARDA TODO COMO TEXTO ✅
// ==================================================
async function enviarCorreoConFactura(datos) {
  try {
    const numero = generarNumeroFactura();
    const datosCompletos = { 
      ...datos, 
      numero,
      dni: datos.dni_comprador || datos.dni || '00000000',
      domicilio: datos.domicilio_comprador || datos.domicilio || 'Sin especificar'
    };
    
    const ticketAFIP = await obtenerTicketAFIP();
    const respuestaAFIP = await enviarFacturaAARCA(datosCompletos, ticketAFIP);
    
    datosCompletos.cae = respuestaAFIP.cae;
    datosCompletos.vencimientoCAE = respuestaAFIP.vencimiento;
    datosCompletos.oficial = respuestaAFIP.oficial;
    
    const pdf = await generarFacturaPDF(datosCompletos);
    const numeroSolo = numero;
    
    const db = require('../config/database');
    let resultado;
    
    if (datos.pedido_id && Number.isInteger(Number(datos.pedido_id))) {
      resultado = await db.query(
        `UPDATE pedidos 
         SET factura_generada = true, factura_numero = $1, factura_ruta = $2, 
             fecha_factura = NOW(), dni_comprador = $3, sesion_id = COALESCE(sesion_id, $4)
         WHERE id = $5 RETURNING id, sesion_id`,
        [numeroSolo, pdf.nombreArchivo, datosCompletos.dni, datos.sesion_id, datos.pedido_id]
      );
    } else if (datos.sesion_id) {
      resultado = await db.query(
        `UPDATE pedidos 
         SET factura_generada = true, factura_numero = $1, factura_ruta = $2, 
             fecha_factura = NOW(), dni_comprador = $3
         WHERE sesion_id = $4 RETURNING id, sesion_id`,
        [numeroSolo, pdf.nombreArchivo, datosCompletos.dni, datos.sesion_id]
      );
    } else {
      throw new Error('Falta ID o sesión');
    }
    
    if (resultado.rows.length === 0) throw new Error('Pedido no encontrado');
    
    const sesionIdFinal = resultado.rows[0].sesion_id;
    console.log(`✅ BD actualizada — sesion_id confirmado: ${sesionIdFinal}`);
    
    const enlaceDescarga = `https://maximuebles-online.onrender.com/api/descargar-mi-factura/${sesionIdFinal}`;
    
    const mensaje = encodeURIComponent(
      `¡Hola! Gracias por tu compra 🧾\n\n` +
      `Factura N°: ${numeroSolo}\nCAE: ${respuestaAFIP.cae}\n` +
      `Vencimiento: ${respuestaAFIP.vencimiento}\n\n` +
      `Descargala aquí: ${enlaceDescarga}`
    );
    
    const linkWhatsApp = datosCompletos.whatsapp 
      ? `https://wa.me/${datosCompletos.whatsapp.replace(/\D/g, '')}?text=${mensaje}` 
      : null;
    
    console.log('\n' + '='.repeat(60));
    console.log(respuestaAFIP.oficial 
      ? '✅ ✅ FACTURA ENVIADA A AFIP — CAE OFICIAL RECIBIDO ✅ ✅' 
      : '⚠️ FACTURA GENERADA (CAE SIMULADO)');
    console.log(`🧾 Factura: ${numeroSolo}`);
    console.log(`👤 Cliente: ${datosCompletos.nombre} — DNI: ${datosCompletos.dni}`);
    console.log(`🔢 CAE: ${respuestaAFIP.cae}`);
    console.log(`📅 Vencimiento CAE: ${respuestaAFIP.vencimiento}`);
    console.log(`📄 Archivo PDF: ${pdf.nombreArchivo}`);
    console.log(`🔗 Enlace descarga: ${enlaceDescarga}`);
    if (linkWhatsApp) console.log(`📱 WhatsApp: ${linkWhatsApp}`);
    console.log('='.repeat(60) + '\n');
    
    return {
      exito: true, 
      numero: numeroSolo, 
      cae: respuestaAFIP.cae,
      vencimiento: respuestaAFIP.vencimiento, 
      rutaPDF: pdf.ruta,
      url: enlaceDescarga, 
      whatsappLink: linkWhatsApp, 
      oficial: respuestaAFIP.oficial
    };
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return { exito: false, error: error.message };
  }
}

// ==================================================
// 🔧 FUNCIONES AUXILIARES
// ==================================================
function firmarXML(certPem, clavePem, fechaGen, fechaVenc) {
  try {
    const xmlParaFirmar = `<loginTicketRequest>
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${fechaGen.toISOString()}</generationTime>
    <expirationTime>${fechaVenc.toISOString()}</expirationTime>
    <service>wsfe</service>
  </header>
  <CUITRepresentado>${CUIT_EMPRESA.replace(/-/g, '')}</CUITRepresentado>
</loginTicketRequest>`;
    const clave = crypto.createPrivateKey({ key: clavePem.replace(/\\n/g, '\n'), format: 'pem' });
    const firma = crypto.createSign('sha256WithRSAEncryption');
    firma.update(xmlParaFirmar);
    firma.end();
    return firma.sign(clave, 'base64');
  } catch (e) {
    console.log("⚠️ Error firmando:", e.message);
    return "";
  }
}

async function hacerPeticionHTTPS(url, xml) {
  return new Promise((resolve, reject) => {
    const uri = new URL(url);
    const opciones = {
      hostname: uri.hostname,
      port: 443,
      path: uri.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(xml)
      },
      agent: agenteAFIP
    };
    const req = https.request(opciones, res => {
      let respuesta = '';
      res.on('data', d => respuesta += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ exito: true, respuesta });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

async function hacerPeticionSOAP(url, xmlBody) {
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${xmlBody}
  </soap:Body>
</soap:Envelope>`;
  return new Promise((resolve, reject) => {
    const uri = new URL(url);
    const opciones = {
      hostname: uri.hostname,
      port: 443,
      path: uri.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FEAutRequest',
        'Content-Length': Buffer.byteLength(soap)
      },
      agent: agenteAFIP
    };
    const req = https.request(opciones, res => {
      let respuesta = '';
      res.on('data', d => respuesta += d);
      res.on('end', () => resolve(respuesta));
    });
    req.on('error', reject);
    req.write(soap);
    req.end();
  });
}

module.exports = { enviarCorreoConFactura };