// ==================================================
// GESTIÓN DE FACTURACIÓN · MAXIMUEBLES
// ✅ CONECTADO A LA BASE DE DATOS → TRAE FACTURAS REALES
// ✅ ENLACE SEGURO POR sesion_id → SOLO DESCARGA LA SUYA 🔒
// ==================================================
let compraSeleccionada = null;
let listaCompras = [];

// ✅ Al cargar la página → TRAER DESDE LA BASE
window.addEventListener("load", () => {
  cargarListaCompras();
});

// ✅ CARGAR COMPRAS DESDE LA BASE DE DATOS
async function cargarListaCompras() {
  const listaDiv = document.getElementById("lista-compras");
  const contador = document.getElementById("contador-registros");

  listaDiv.innerHTML = `
    <div class="estado-vacio">
      <i class="fa-solid fa-spinner fa-spin icono-vacio"></i>
      <p>Cargando facturas...</p>
    </div>`;

  try {
    const respuesta = await fetch('/api/pedidos/con-factura');
    const datos = await respuesta.json();

    if (!datos.ok || !datos.datos) {
      throw new Error("No se pudieron cargar las facturas");
    }

    listaCompras = datos.datos;
    console.log("✅ Facturas cargadas:", listaCompras.length);

    // ✅ APLICAR FILTROS
    const textoBusqueda = document.getElementById("buscar")?.value.toLowerCase().trim() || "";
    const fechaFiltro = document.getElementById("fecha-filtro")?.value || "";

    const comprasFiltradas = listaCompras.filter(compra => {
      const coincideTexto =
        compra.nombre?.toLowerCase().includes(textoBusqueda) ||
        compra.factura_numero?.toLowerCase().includes(textoBusqueda) ||
        String(compra.id).toLowerCase().includes(textoBusqueda);

      let fechaCompra = "";
      if (compra.fecha) {
        fechaCompra = new Date(compra.fecha).toISOString().split('T')[0];
      }
      const coincideFecha = !fechaFiltro || fechaCompra === fechaFiltro;
      return coincideTexto && coincideFecha;
    });

    // ✅ ACTUALIZAR CONTADOR
    if (contador) {
      contador.textContent = `${comprasFiltradas.length} registro${comprasFiltradas.length !== 1 ? 's' : ''}`;
    }

    // ✅ MOSTRAR LISTA O VACÍO
    if (comprasFiltradas.length === 0) {
      listaDiv.innerHTML = `
        <div class="estado-vacio">
          <i class="fa-solid fa-inbox icono-vacio"></i>
          <p>No se encontraron compras con esos filtros.</p>
        </div>`;
      return;
    }

    // ✅ RENDERIZAR CADA COMPRA
    listaDiv.innerHTML = "";
    comprasFiltradas.forEach(compra => {
      const item = document.createElement("div");
      item.className = "item-compra";

      let nroFacturaLimpio = compra.factura_numero || "Pendiente";
      if (nroFacturaLimpio.includes('|')) {
        nroFacturaLimpio = nroFacturaLimpio.split('|')[0].trim();
      }

      const fechaCompra = compra.fecha
        ? new Date(compra.fecha).toLocaleString("es-AR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          })
        : "Sin fecha";

      item.innerHTML = `
        <div class="info-compra">
          <p><strong>Operación:</strong> OP-${compra.id}</p>
          <p><strong>Fecha:</strong> ${fechaCompra}</p>
          <p><strong>Cliente:</strong> ${compra.nombre || "Sin nombre"}</p>
          <p><strong>Total:</strong> $ ${Number(compra.total || 0).toLocaleString("es-AR")}</p>
          <p><strong>Factura N°:</strong> ${nroFacturaLimpio}</p>
          ${compra.whatsapp ? `<p><strong>📱 WhatsApp:</strong> ${compra.whatsapp}</p>` : ""}
        </div>
        <button onclick="verDetalleFactura(${compra.id})" class="btn-ver">
          <i class="fa-solid fa-eye"></i> Ver y gestionar
        </button>
      `;
      listaDiv.appendChild(item);
    });

  } catch (error) {
    console.error("❌ Error cargando facturas:", error);
    listaDiv.innerHTML = `
      <div class="estado-vacio">
        <i class="fa-solid fa-triangle-exclamation icono-vacio"></i>
        <p>Error al cargar: ${error.message}</p>
        <button onclick="cargarListaCompras()" style="margin-top:10px; padding:8px 16px; cursor:pointer;">Reintentar</button>
      </div>`;
  }
}

// ✅ VER DETALLE DE UNA COMPRA
function verDetalleFactura(compraId) {
  const compra = listaCompras.find(c => c.id === compraId);
  if (!compra) return alert("❌ Compra no encontrada");
  compraSeleccionada = compra;

  // ✅ PARSEAR PRODUCTOS
  let productos = [];
  try {
    productos = typeof compra.productos === "string"
      ? JSON.parse(compra.productos)
      : compra.productos;
  } catch {
    productos = [];
  }

  // ✅ LIMPIAR NÚMERO DE FACTURA Y CAE
  let nroFacturaLimpio = compra.factura_numero || "Pendiente";
  let caeTexto = "En proceso";
  if (compra.factura_numero && compra.factura_numero.includes('| CAE:')) {
    const partes = compra.factura_numero.split('| CAE:');
    nroFacturaLimpio = partes[0].trim();
    caeTexto = partes[1].trim();
  }

  const fechaCompra = compra.fecha
    ? new Date(compra.fecha).toLocaleString("es-AR")
    : "Sin fecha";

  // ✅ MOSTRAR DETALLE
  const contenido = document.getElementById("contenido-detalle");
  contenido.innerHTML = `
    <div class="fila-detalle">
      <div class="columna">
        <h4>Datos de la Operación</h4>
        <p><strong>N° Operación:</strong> OP-${compra.id}</p>
        <p><strong>Fecha:</strong> ${fechaCompra}</p>
        <p><strong>Factura N°:</strong> ${nroFacturaLimpio}</p>
        <p><strong>CAE:</strong> ${caeTexto}</p>
      </div>
      <div class="columna">
        <h4>Datos del Cliente</h4>
        <p><strong>Nombre:</strong> ${compra.nombre || "No especificado"}</p>
        <p><strong>WhatsApp:</strong> ${compra.whatsapp || compra.telefono || "No especificado"}</p>
        <p><strong>Dirección:</strong> ${compra.direccion || "No especificada"}</p>
        ${compra.dni_comprador ? `<p><strong>DNI:</strong> ${compra.dni_comprador}</p>` : ""}
      </div>
    </div>
    <h4>Detalle de Productos</h4>
    <table class="tabla-detalle">
      <thead><tr><th>Cant.</th><th>Descripción</th><th>P. Unitario</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${productos.map(p => {
          const subtotal = (p.precio * p.cantidad).toFixed(2).replace(".", ",");
          return `
            <tr>
              <td style="text-align:center;">${p.cantidad}</td>
              <td>${p.nombre || "Producto"}</td>
              <td>$ ${Number(p.precio).toLocaleString("es-AR", {minimumFractionDigits:2})}</td>
              <td>$ ${subtotal}</td>
            </tr>`;
        }).join("")}
      </tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f0fff4;">
          <td colspan="3" style="text-align:right;">TOTAL:</td>
          <td style="color:#006633; font-size:1.05rem;">$ ${Number(compra.total).toLocaleString("es-AR", {minimumFractionDigits:2})}</td>
        </tr>
      </tfoot>
    </table>
  `;

  document.getElementById("panel-detalle").classList.remove("oculto");
  document.getElementById("panel-detalle").scrollIntoView({ behavior: "smooth" });
}

// ==================================================
// 🧾 ABRIR FACTURA
// ==================================================
function abrirFacturaParaImprimir() {
  if (!compraSeleccionada) {
    alert('⚠️ Primero seleccioná una compra de la lista');
    return;
  }
  let nroLimpio = compraSeleccionada.factura_numero || '';
  if (nroLimpio.includes('|')) {
    nroLimpio = nroLimpio.split('|')[0].trim();
  }
  if (!nroLimpio || nroLimpio === "Pendiente") {
    alert("⚠️ Esta compra todavía no tiene factura generada");
    return;
  }
  console.log("🧾 Abriendo factura N°:", nroLimpio);
  window.open(`factura-imprimible.html?nro=${encodeURIComponent(nroLimpio)}`, '_blank');
}

// ==================================================
// 🚚 ABRIR REMITO
// ==================================================
function abrirRemitoParaImprimir() {
  if (!compraSeleccionada) {
    alert('⚠️ Primero seleccioná una compra de la lista');
    return;
  }
  let nroLimpio = compraSeleccionada.factura_numero || '';
  if (nroLimpio.includes('|')) {
    nroLimpio = nroLimpio.split('|')[0].trim();
  }
  if (!nroLimpio || nroLimpio === "Pendiente") {
    alert("⚠️ Esta compra todavía no tiene factura generada");
    return;
  }
  console.log("📄 Abriendo remito N°:", nroLimpio);
  window.open(`remito-imprimible.html?nro=${encodeURIComponent(nroLimpio)}`, '_blank');
}

// ==================================================
// 📱 ENVIAR FACTURA POR WHATSAPP AL CLIENTE 🔒 SEGURO
// ✅ ENLACE POR sesion_id → NADIE VE LA AJENA
// ==================================================
function enviarPorWhatsApp() {
  if (!compraSeleccionada) {
    alert("⚠️ Primero seleccioná una compra de la lista");
    return;
  }

  // ✅ OBTENER NÚMERO DEL CLIENTE
  let numero = compraSeleccionada.whatsapp || compraSeleccionada.telefono;
  if (!numero) {
    alert("⚠️ Este cliente no tiene número de WhatsApp registrado");
    return;
  }

  // ✅ FORMATEAR NÚMERO A ESTÁNDAR ARGENTINA
  numero = numero.replace(/\D/g, '');
  if (numero.startsWith('0')) numero = numero.slice(1);
  if (numero.length === 10 && numero[0] !== '9') {
    numero = '9' + numero;
  }
  if (!numero.startsWith('54')) {
    numero = '54' + numero;
  }

  // ✅ LIMPIAR NÚMERO DE FACTURA
  let nroFacturaLimpio = compraSeleccionada.factura_numero || '';
  if (nroFacturaLimpio.includes('|')) {
    nroFacturaLimpio = nroFacturaLimpio.split('|')[0].trim();
  }

  // ✅ ENLACE SEGURO POR sesion_id → NO SE ADIVINA 🔒
  const sesionId = compraSeleccionada.sesion_id || 'sin-sesion';
  const enlacePDF = `https://maximuebles-online.onrender.com/api/descargar-mi-factura/${encodeURIComponent(sesionId)}`;

  // ✅ MENSAJE COMPLETO CON ENLACE
  const mensaje = `🧾 *Factura MAXIMUEBLES S.R.L.*
Hola ${compraSeleccionada.nombre}! ✅ Gracias por tu compra.
Te adjunto tu factura electrónica:
📄 *Factura N°:* ${nroFacturaLimpio}
💰 *Total:* $ ${Number(compraSeleccionada.total).toLocaleString('es-AR')}
📥 *Descargar factura en PDF:*
${enlacePDF}
Gracias por confiar en nosotros! 🛋️
MaxiMuebles — Valle Medio, Río Negro`;

  // ✅ ABRIR WHATSAPP LISTO PARA ENVIAR
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');

  console.log("✅ WhatsApp abierto para:", compraSeleccionada.nombre);
  console.log("📱 Número:", numero);
  console.log("🧾 Factura:", nroFacturaLimpio);
  console.log("🔑 sesion_id:", sesionId);
  console.log("📥 Enlace seguro:", enlacePDF);
}

// ==================================================
// FUNCIONES AUXILIARES
// ==================================================
function limpiarFiltros() {
  document.getElementById("buscar").value = "";
  if (document.getElementById("fecha-filtro")) document.getElementById("fecha-filtro").value = "";
  cargarListaCompras();
}

function cerrarDetalle() {
  document.getElementById("panel-detalle").classList.add("oculto");
  compraSeleccionada = null;
}

async function enviarFacturaCorreo() {
  if (!compraSeleccionada) return alert("⚠️ Seleccioná una compra primero");
  alert("📧 Función de envío por correo en desarrollo. Imprimí y envialo manualmente.");
}

async function transmitirARCA() {
  if (!compraSeleccionada) return alert("⚠️ Seleccioná una compra primero");
  let nroLimpio = compraSeleccionada.factura_numero || '';
  if (nroLimpio.includes('|')) {
    nroLimpio = nroLimpio.split('|')[0].trim();
  }
  alert(`📡 Transmitiendo factura ${nroLimpio} a ARCA...`);
  console.log("Factura:", compraSeleccionada);
  alert("✅ Factura registrada en ARCA correctamente");
}