// ===== PÁGINA DE CONFIRMACIÓN DE PAGO =====
window.addEventListener("DOMContentLoaded", () => {
    const guardado = localStorage.getItem("carrito_pago");
    const pedidoGuardado = JSON.parse(localStorage.getItem("ultimaCompra") || '{}');
    
    let carrito = [];
    let totalCompra = 0;
    if (guardado) {
        const datos = JSON.parse(guardado);
        carrito = datos.carrito || [];
        totalCompra = datos.totalCompra || 0;
        mostrarProductos(carrito);
        const totalElem = document.getElementById("mp-total");
        if (totalElem) {
            totalElem.textContent = `$ ${totalCompra.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
        }
    }
    const params = new URLSearchParams(window.location.search);
    const pagoId = params.get("payment_id") || params.get("preference_id") || pedidoGuardado.pedidoId || "Pendiente";
    const ordenElem = document.getElementById("mp-orden-id");
    if (ordenElem) ordenElem.textContent = pagoId;

    window._datosPedido = {
        nombre: pedidoGuardado.nombre || "Consumidor Final",
        whatsapp: pedidoGuardado.whatsapp || "",
        sesion_id: pedidoGuardado.sesion_id || 'invitado',
        pedidoId: pedidoGuardado.pedidoId || pagoId,
        carrito,
        totalCompra
    };

    if (pedidoGuardado.whatsapp) {
        const inputWsp = document.getElementById("whatsapp_cliente");
        if (inputWsp) inputWsp.value = pedidoGuardado.whatsapp;
    }

    const fecha = new Date().toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
    const fechaElem = document.getElementById("mp-fecha");
    if (fechaElem) fechaElem.textContent = fecha;
});

// ===== MOSTRAR PRODUCTOS EN EL RESUMEN =====
function mostrarProductos(carrito) {
    const contenedor = document.getElementById("lista_productos");
    if (!contenedor || !carrito.length) return;
    contenedor.innerHTML = "";
    carrito.forEach(item => {
        const nombre = item.nombre || "Producto";
        const cantidad = item.cantidad || 1;
        const precio = Number(item.precio) || 0;
        const subtotal = precio * cantidad;
        contenedor.innerHTML += `
            <div class="producto-confirmacion">
                <span>${nombre}</span>
                <span>${cantidad} × $ ${precio.toLocaleString("es-AR")} = $ ${subtotal.toLocaleString("es-AR")}</span>
            </div>
        `;
    });
}

// ===== MOSTRAR / OCULTAR CAMPO DE WHATSAPP =====
function mostrarCampoWhatsApp() {
    const seleccion = document.querySelector('input[name="enviar_factura"]:checked');
    if (!seleccion) return;
    const campoWhatsApp = document.getElementById("campo-whatsapp");
    if (!campoWhatsApp) return;
    campoWhatsApp.style.display = seleccion.value === "si" ? "block" : "none";
    if (seleccion.value === "no") document.getElementById("whatsapp_cliente").value = "";
}

// ✅ GENERAR FACTURA Y DESCARGAR PDF DIRECTAMENTE
async function generarYDescargarPDF() {
    const whatsappElem = document.getElementById("whatsapp_cliente");
    const whatsapp = whatsappElem.value.trim().replace(/\s/g, '');
    const datos = window._datosPedido || {};
    const mensaje = document.getElementById("mensaje-descarga");

    // ✅ Validar WhatsApp
    if (!whatsapp || whatsapp.length < 8) {
        alert("⚠️ Escribí tu número de WhatsApp completo por favor.");
        whatsappElem.focus();
        return;
    }

    mensaje.style.display = "block";
    mensaje.style.color = "#22b548";
    mensaje.textContent = "✅ Generando tu factura... por favor esperá un momento";

    try {
        // ✅ PASO 1: GUARDAR WHATSAPP EN LA BASE DE DATOS
        await peticion("/pedidos/actualizar-factura", "POST", {
            sesion_id: datos.sesion_id,
            whatsapp: whatsapp
        });

        // ✅ PASO 2: PEDIR AL SERVIDOR QUE DEVUELVA EL PDF
        const respuesta = await peticion("/pedidos/generar-factura-pdf", "POST", {
            nombre: datos.nombre,
            whatsapp: whatsapp,
            pedidoId: datos.pedidoId,
            productos: datos.carrito,
            total: datos.totalCompra
        });

        if (respuesta.ok && respuesta.datos && respuesta.datos.url) {
            // ✅ PASO 3: DESCARGAR EL PDF
            mensaje.textContent = "✅ ¡Factura lista! Descargando...";
            window.open(respuesta.datos.url, '_blank');
            mensaje.innerHTML = "✅ <strong>¡Factura descargada con éxito!</strong><br>Tu WhatsApp quedó guardado en nuestro sistema.";
        } else {
            throw new Error(respuesta.mensaje || "No se pudo generar");
        }
    } catch (error) {
        console.error("❌ Error:", error);
        mensaje.style.color = "red";
        mensaje.textContent = "⚠️ Error al generar la factura. Intentá nuevamente.";
    }
}