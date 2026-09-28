// ==================================================
// 🧾 FACTURACIÓN ARCA — FLUJO OFICIAL ✅
// WSAA → Token+Sign → WSFE → Último N° → FECAESolicitar → CAE REAL
// NO inventa nada si falla ❌
// ==================================================
const https = require('https');
const forge = require('node-forge');

// ==================================================
// ⚙️ DATOS DE LA EMPRESA
// ==================================================
const CUIT = process.env.CUIT_EMPRESA || "30715002724";
const PUNTO_VENTA = process.env.AFIP_PUNTO_VENTA || "00010";
const ENTORNO = process.env.AFIP_ENTORNO || "produccion";

const WSAA_URL = ENTORNO === "homologacion"
  ? "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
  : "https://wsaa.afip.gov.ar/ws/services/LoginCms";

const WSFE_URL = ENTORNO === "homologacion"
  ? "https://wsfehom.afip.gov.ar/ws/services/FCNService"
  : "https://servicios1.afip.gov.ar/wsfe/service/FCNService";

// ==================================================
// 🔐 TLS — Conexión segura compatible con ARCA
// ==================================================
const agenteTLS = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:AES128-GCM-SHA256',
  rejectUnauthorized: true
});

// ==================================================
// 🔑 CARGAR CERTIFICADOS
// ==================================================
function cargarCertificados() {
  const clave = process.env.AFIP_PRIVATE_KEY;
  const cert = process.env.AFIP_CERT;
  
  if (!clave || !cert) {
    console.log("❌ Faltan variables: AFIP_PRIVATE_KEY o AFIP_CERT");
    return { ok: false };
  }
  if (!clave.includes('BEGIN PRIVATE KEY')) {
    console.log("❌ Clave mal formateada");
    return { ok: false };
  }
  if (!cert.includes('BEGIN CERTIFICATE')) {
    console.log("❌ Certificado mal formateado");
    return { ok: false };
  }
  return { ok: true, clave, cert };
}

// ==================================================
// ✅ PASO 1: WSAA → Obtener Token y Sign
// ==================================================
async function obtenerCredencialesARCA() {
  const certs = cargarCertificados();
  if (!certs.ok) return null;

  try {
    console.log("🔑 PASO 1/4 → Solicitando credenciales a WSAA...");

    const ahora = new Date();
    const expira = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);

    const xmlTicket = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Math.random() * 1000000)}</uniqueId>
    <generationTime>${ahora.toISOString()}</generationTime>
    <expirationTime>${expira.toISOString()}</expirationTime>
    <service>wsfe</service>
  </header>
  <credential>
    <cuit>${CUIT}</cuit>
  </credential>
</loginTicketRequest>`;

    // Firmar como CMS/PKCS#7 → método oficial ✅
    const clavePriv = forge.pki.privateKeyFromPem(certs.clave);
    const certificado = forge.pki.certificateFromPem(certs.cert);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(xmlTicket, 'utf8');
    p7.addCertificate(certificado);
    p7.addSigner({
      key: clavePriv,
      certificate: certificado,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() }
      ]
    });
    p7.sign();

    const cmsFirmado = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

    // Enviar a LoginCms ✅
    const respuesta = await new Promise((resolve, rechazar) => {
      const opts = {
        hostname: new URL(WSAA_URL).hostname,
        port: 443,
        path: '/ws/services/LoginCms',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': 'http://ar.gov.afip/wsaa/LoginCms',
          'Content-Length': Buffer.from(cmsFirmado).length
        },
        agent: agenteTLS
      };
      const req = https.request(opts, res => {
        let cuerpo = '';
        res.on('data', d => cuerpo += d);
        res.on('end', () => resolve(cuerpo));
      });
      req.on('error', rechazar);
      req.write(cmsFirmado);
      req.end();
    });

    if (respuesta.includes('cms.bad')) {
      console.log("❌ ARCA rechazó la firma → certificado inválido o CUIT incorrecto");
      return null;
    }

    const token = respuesta.match(/<token>([^<]+)<\/token>/i)?.[1];
    const sign = respuesta.match(/<sign>([^<]+)<\/sign>/i)?.[1];

    if (!token || !sign) {
      console.log("❌ No se extrajeron credenciales de WSAA");
      return null;
    }

    console.log("✅ PASO 1/4 → Credenciales obtenidas");
    return { token, sign };
  } catch (e) {
    console.log("❌ Error WSAA:", e.message);
    return null;
  }
}

// ==================================================
// ✅ PASO 2: Consultar ÚLTIMO comprobante autorizado
// ==================================================
async function obtenerUltimoComprobante(credenciales) {
  if (!credenciales) return null;

  try {
    console.log("🔢 PASO 2/4 → Consultando último N° de factura...");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:FECompUltimoAutorizado>
      <Auth>
        <Token>${credenciales.token}</Token>
        <Sign>${credenciales.sign}</Sign>
        <Cuit>${CUIT}</Cuit>
      </Auth>
      <PtoVta>${PUNTO_VENTA}</PtoVta>
      <CbteTipo>6</CbteTipo>
    </ns:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

    const respuesta = await new Promise((resolve, rechazar) => {
      const opts = {
        hostname: new URL(WSFE_URL).hostname,
        port: 443,
        path: '/wsfe/service/FCNService',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
          'Content-Length': Buffer.from(xml).length
        },
        agent: agenteTLS
      };
      const req = https.request(opts, res => {
        let cuerpo = '';
        res.on('data', d => cuerpo += d);
        res.on('end', () => resolve(cuerpo));
      });
      req.on('error', rechazar);
      req.write(xml);
      req.end();
    });

    const ultimo = respuesta.match(/<CbteNro>(\d+)<\/CbteNro>/)?.[1];
    const siguiente = ultimo ? String(parseInt(ultimo) + 1).padStart(8, '0') : '00000001';
    
    console.log(`✅ PASO 2/4 → Último: ${ultimo || '0'} → Siguiente: ${siguiente}`);
    return siguiente;
  } catch (e) {
    console.log("⚠️ No se pudo consultar último N°:", e.message);
    return '00000001';
  }
}

// ==================================================
// ✅ PASO 3: Enviar factura → FECAESolicitar
// ==================================================
async function solicitarCAE(datos, credenciales, nroComprobante) {
  if (!credenciales) return { ok: false, error: "Sin credenciales" };

  try {
    console.log(`📤 PASO 3/4 → Enviando factura N° ${nroComprobante} a ARCA...`);

    const fecha = new Date().toISOString().split('T')[0];
    const total = Number(datos.total || 0);
    const neto = total / 1.21;
    const iva = total - neto;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:FECAESolicitar>
      <Auth>
        <Token>${credenciales.token}</Token>
        <Sign>${credenciales.sign}</Sign>
        <Cuit>${CUIT}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${PUNTO_VENTA}</PtoVta>
          <CbteTipo>6</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>96</DocTipo>
            <DocNro>0</DocNro>
            <CbteDesde>${nroComprobante}</CbteDesde>
            <CbteHasta>${nroComprobante}</CbteHasta>
            <CbteFch>${fecha}</CbteFch>
            <ImpTotal>${total.toFixed(2)}</ImpTotal>
            <ImpNeto>${neto.toFixed(2)}</ImpNeto>
            <ImpIVA>${iva.toFixed(2)}</ImpIVA>
            <ImpTributos>0.00</ImpTributos>
            <MonedaId>PES</MonedaId>
            <Cotizacion>1</Cotizacion>
            <Iva>
              <AlicIva>
                <Id>5</Id>
                <BaseImp>${neto.toFixed(2)}</BaseImp>
                <Importe>${iva.toFixed(2)}</Importe>
              </AlicIva>
            </Iva>
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </ns:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

    const respuesta = await new Promise((resolve, rechazar) => {
      const opts = {
        hostname: new URL(WSFE_URL).hostname,
        port: 443,
        path: '/wsfe/service/FCNService',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
          'Content-Length': Buffer.from(xml).length
        },
        agent: agenteTLS
      };
      const req = https.request(opts, res => {
        let cuerpo = '';
        res.on('data', d => cuerpo += d);
        res.on('end', () => resolve(cuerpo));
      });
      req.on('error', rechazar);
      req.write(xml);
      req.end();
    });

    // ✅ Extraer CAE real
    const cae = respuesta.match(/<CAE>(\d+)<\/CAE>/)?.[1];
    const vto = respuesta.match(/<CAEFchVto>(\d{4}-\d{2}-\d{2})<\/CAEFchVto>/)?.[1];
    const error = respuesta.match(/<ErrDesc>([^<]+)<\/ErrDesc>/)?.[1];

    if (cae) {
      console.log("✅ ✅ PASO 4/4 → CAE RECIBIDO DE ARCA:", cae);
      return {
        ok: true,
        cae: cae,
        vencimiento: vto ? vto.split('-').reverse().join('/') : '',
        numero_factura: `${PUNTO_VENTA}-${nroComprobante}`
      };
    } else if (error) {
      console.log("❌ ARCA RECHAZÓ:", error);
      return { ok: false, error: error };
    } else {
      console.log("⚠️ Respuesta inesperada:", respuesta.substring(0, 400));
      return { ok: false, error: "Respuesta inválida de ARCA" };
    }
  } catch (e) {
    console.log("❌ Error enviando factura:", e.message);
    return { ok: false, error: e.message };
  }
}

// ==================================================
// 🚀 FUNCIÓN PRINCIPAL — LLAMAR DESDE server.js
// ==================================================
async function obtenerCAE(datosCompra) {
  console.log("🧾 === INICIANDO FACTURACIÓN EN ARCA ===");
  
  // PASO 1 → Credenciales
  const credenciales = await obtenerCredencialesARCA();
  if (!credenciales) {
    return { ok: false, error: "No se pudo conectar con ARCA. Verificar certificados." };
  }

  // PASO 2 → Último N°
  const nroSiguiente = await obtenerUltimoComprobante(credenciales);

  // PASO 3 → Enviar → CAE
  const resultado = await solicitarCAE(datosCompra, credenciales, nroSiguiente);

  if (!resultado.ok) {
    console.log("❌ NO SE EMITE FACTURA — se detiene el proceso ✅");
    return resultado;
  }

  return resultado;
}

module.exports = { obtenerCAE };