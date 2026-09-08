let mp;
let totalCompra = 0;
let carrito = [];
const CLAVE_PUBLICA_MP = "APP_USR-8dbfc25a-2ce6-4d62-a5d3-6b72841f1a46";

// ✅ GENERAR CÓDIGO ÚNICO POR CLIENTE
function obtenerSesionId() {
  let sesion_id = localStorage.getItem("sesion_id");
  if (!sesion_id) {
    sesion_id = Date.now().toString() + Math.random().toString(36).substring(2);
    localStorage.setItem("sesion_id", sesion_id);
  }
  return sesion_id;
}

window.addEventListener("load", async () => {
  if (window.MercadoPago) {
    mp = new MercadoPago(CLAVE_PUBLICA_MP, { locale: "es-AR" });
  }
  obtenerSesionId();
  cambiarPantalla("paso-envio");
  await cargarResumenCarrito();
});

function cambiarPantalla(id) {
  document.querySelectorAll(".checkout-screen").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function irPaso(n) {
  const pasos = ["paso-envio", "paso-empresa", "paso-pago", "paso-resumen"];
  cambiarPantalla(pasos[n - 1]);
  if (n === 4) cargarResumenFinal();
}

// ✅ CARGA EL CARRITO — desde localStorage
async function cargarResumenCarrito() {
  totalCompra = 0;
  carrito = [];
  const carritoGuardado = localStorage.getItem("carrito");
  if (carritoGuardado) {
    try {
      carrito = JSON.parse(carritoGuardado);
    } catch {
      carrito = [];
    }
  }
  if (!carrito.length) {
    alert("Tu carrito está vacío");
    window.location.href = "/carrito.html";
    return;
  }
  const lista = document.getElementById("lista_productos");
  lista.innerHTML = "";
  carrito.forEach(item => {
    const subt = Number(item.precio || 0) * Number(item.cantidad || 1);
    totalCompra += subt;
    lista.innerHTML += `<p>${item.nombre || 'Producto'} × ${item.cantidad} = <strong>$ ${subt.toLocaleString("es-AR")}</strong></p>`;
  });
  const envio = totalCompra > 50000 ? 0 : 4990;
  totalCompra += envio;
  document.getElementById("res_subtotal").textContent = `$ ${(totalCompra - envio).toLocaleString("es-AR")}`;
  document.getElementById("res_envio").textContent = envio ? `$ ${envio.toLocaleString("es-AR")}` : "GRATIS";
  document.getElementById("res_total").textContent = `$ ${totalCompra.toLocaleString("es-AR")}`;
}

// ✅ CARGA LOS DATOS EN EL RESUMEN — AHORA MUESTRA WHATSAPP
function cargarResumenFinal() {
  document.getElementById("res_nombre").textContent = document.getElementById("nombre").value || "-";
  document.getElementById("res_whatsapp").textContent = document.getElementById("whatsapp").value || "-";
  document.getElementById("res_dni").textContent = document.getElementById("dni").value || "-";
  document.getElementById("res_telefono").textContent = document.getElementById("telefono").value || "-";
  const calle = document.getElementById("calle").value;
  const piso = document.getElementById("piso").value;
  const cp = document.getElementById("cp").value;
  const loc = document.getElementById("localidad").value;
  const prov = "Río Negro";
  let domicilioCompleto = calle;
  if (piso) domicilioCompleto += `, ${piso}`;
  domicilioCompleto += ` — ${loc} (${cp}), ${prov}`;
  document.getElementById("res_domicilio").textContent = domicilioCompleto;
  document.getElementById("res_metodo_pago").textContent = "Pagar con Mercado Pago";
}

// ✅ PROCESAR PAGO — WHATSAPP + DATOS DE FACTURA COMPLETOS
async function procesarPago() {
  const nombre = document.getElementById("nombre").value.trim();
  const whatsapp = document.getElementById("whatsapp").value.trim();
  const dni = document.getElementById("dni").value.trim();
  const calle = document.getElementById("calle").value.trim();
  const cp = document.getElementById("cp").value.trim();
  const localidad = document.getElementById("localidad").value;
  const telefono = document.getElementById("telefono").value.trim();
  const direccionCompleta = `${calle}, ${document.getElementById("piso").value.trim() || ''} - ${localidad} (${cp}), Río Negro`.trim();

  // ✅ Validación: AHORA PIDE WHATSAPP en lugar de correo
  if (!nombre || !whatsapp || !calle || !cp || !localidad) {
    alert("⚠️ Completá nombre, WhatsApp y dirección por favor");
    return;
  }

  alert("✅ Preparando el pago... en unos segundos irás a Mercado Pago");

  // ✅ Convertimos para el servidor
  const productosParaEnviar = carrito.map(item => ({
    producto_id: item.id,
    cantidad: item.cantidad,
    nombre: item.nombre,
    precio: item.precio
  }));

  const sesion_id = obtenerSesionId();
  const quiereFactura = document.getElementById("quiero_factura")?.checked || false;

  // ✅ DATOS COMPLETOS: WHATSAPP + FACTURA
  const datosCompra = {
    nombre,
    whatsapp, // ✅ EN LUGAR DE CORREO
    telefono,
    direccion: direccionCompleta,
    productos: productosParaEnviar,
    total: totalCompra,
    sesion_id,
    quiero_factura: quiereFactura,
    dni_comprador: quiereFactura ? (document.getElementById("dni_comprador")?.value?.trim() || dni) : "",
    domicilio_comprador: quiereFactura ? (document.getElementById("domicilio_comprador")?.value?.trim() || direccionCompleta) : "",
    notas: `DNI: ${dni} | Recibe: ${document.getElementById("recibe")?.value || nombre} | Horario: ${document.getElementById("horario")?.value || "A convenir"}`
  };

  localStorage.setItem("ultimaCompra", JSON.stringify(datosCompra));
  localStorage.setItem("carrito_pago", JSON.stringify({ carrito: productosParaEnviar, totalCompra }));

  try {
    // ✅ PASO 1: Guardar pedido en la base de datos
    const respPedido = await peticion("/pedidos", "POST", datosCompra);
    console.log("📦 Pedido guardado:", respPedido);
    if (!respPedido.ok) {
      alert(respPedido.mensaje || "No se pudo registrar tu pedido. Intentá nuevamente.");
      return;
    }

    // ✅ PASO 2: Generar enlace de Mercado Pago → ENVÍA WHATSAPP
    const respPago = await peticion("/crear-preferencia-pago", "POST", {
      productos: carrito,
      total: totalCompra,
      sesion_id,
      datosComprador: {
        nombre,
        whatsapp // ✅ MP recibe el WhatsApp
      }
    });

    console.log("💳 Respuesta Mercado Pago:", respPago);
    if (respPago.ok && respPago.datos && respPago.datos.init_point) {
      localStorage.removeItem("carrito");
      alert("✅ ¡Listo! A continuación serás redirigido a Mercado Pago para finalizar tu compra");
      window.location.href = respPago.datos.init_point;
    } else {
      alert(respPago.mensaje || "No se pudo generar el enlace de pago");
    }
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    alert("Hubo un problema al procesar tu compra. Intentá nuevamente.");
  }
}