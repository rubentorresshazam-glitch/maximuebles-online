// ===== PÁGINA DE CONFIRMACIÓN DE PAGO =====
window.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Página de confirmación cargada");

    // ✅ RECUPERAR DATOS — PROBAMOS TODAS LAS CLAVES POSIBLES
    const guardado = localStorage.getItem("carrito_pago");
    const pedidoGuardado = JSON.parse(localStorage.getItem("ultimaCompra") || localStorage.getItem("pedido_confirmado") || '{}');
    
    console.log("📦 Carrito guardado:", guardado);
    console.log("🧾 Pedido guardado:", pedidoGuardado);

    let carrito = [];
    let totalCompra = 0;

    // ✅ LEER DATOS DEL CARRITO
    if (guardado) {
        try {
            const datos = JSON.parse(guardado);
            carrito = datos.carrito || [];
            totalCompra = datos.totalCompra || 0;
        } catch (e) {
            console.warn("⚠️ Error leyendo carrito:", e);
        }
    }

    // ✅ SI NO HAY CARRITO, USAR LOS DATOS DEL PEDIDO
    if (carrito.length === 0 && pedidoGuardado.carrito) {
        carrito = pedidoGuardado.carrito || [];
        totalCompra = pedidoGuardado.totalCompra || pedidoGuardado.total || 0;
    }

    console.log("✅ Productos a mostrar:", carrito);
    console.log("✅ Total:", totalCompra);

    // ✅ MOSTRAR PRODUCTOS
    mostrarProductos(carrito);

    // ✅ MOSTRAR TOTAL
    const totalElem = document.getElementById("mp-total");
    if (totalElem && totalCompra > 0) {
        totalElem.textContent = `$ ${totalCompra.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
    }

    // ✅ OBTENER NÚMERO DE OPERACIÓN
    const params = new URLSearchParams(window.location.search);
    const pagoId = params.get("payment_id") || params.get("preference_id") || pedidoGuardado.pedidoId || "Pendiente";
    const ordenElem = document.getElementById("mp-orden-id");
    if (ordenElem) ordenElem.textContent = pagoId;

    // ✅ GUARDAR DATOS PARA USAR DESPUÉS
    window._datosPedido = {
        nombre: pedidoGuardado.nombre || "Consumidor Final",
        whatsapp: pedidoGuardado.whatsapp || "",
        sesion_id: pedidoGuardado.sesion_id || pedidoGuardado.sesion || 'invitado',
        pedidoId: pedidoGuardado.pedidoId || pagoId,
        carrito,
        totalCompra
    };

    console.log("✅ Datos listos:", window._datosPedido);

    // ✅ PRE-LLENAR WHATSAPP SI YA ESTÁ GUARDADO
    if (pedidoGuardado.whatsapp) {
        const inputWsp = document.getElementById("whatsapp_cliente");
        if (inputWsp) inputWsp.value = pedidoGuardado.whatsapp;
    }

    // ✅ MOSTRAR FECHA
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
    if (!contenedor) {
        console.warn("⚠️ No se encontró el contenedor #lista_productos");
        return;
    }
    
    if (!carrito || carrito.length === 0) {
        contenedor.innerHTML = "<span style='color:#888;'>Sin productos</span>";
        return;
    }

    contenedor.innerHTML = "";
    carrito.forEach(item => {
        const nombre = item.nombre || "Producto";
        const cantidad = item.cantidad || 1;
        const precio = Number(item.precio) || 0;
        const subtotal = precio * cantidad;
        contenedor.innerHTML += `
            <div class="producto-confirmacion" style="padding:6px 0; border-bottom:1px solid #222;">
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
    
    if (seleccion.value === "no") {
        const input = document.getElementById("whatsapp_cliente");
        if (input) input.value = "";
    }
}

// ✅ FUNCIÓN DE PETICIÓN A LA API
async function peticion(url, metodo = "POST", datos = {}) {
    const respuesta = await fetch(`/api/pedidos${url}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: Object.keys(datos).length ? JSON.stringify(datos) : undefined
    });
    return await respuesta.json();
}

// ✅ GENERAR FACTURA Y DESCARGAR PDF
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
        await peticion("/actualizar-factura", "POST", {
            sesion_id: datos.sesion_id,
            whatsapp: whatsapp
        });

        // ✅ PASO 2: PEDIR AL SERVIDOR QUE GENERE EL PDF
        const respuesta = await peticion("/generar-factura-pdf", "POST", {
            nombre: datos.nombre,
            whatsapp: whatsapp,
            pedido_id: datos.pedidoId,
            productos: datos.carrito,
            total: datos.totalCompra
        });

        console.log("📄 Respuesta factura:", respuesta);

        if (respuesta.ok && respuesta.datos) {
            // ✅ MOSTRAR DATOS DE LA FACTURA
            mensaje.textContent = "✅ ¡Factura lista! Descargando...";
            
            // ✅ ABRIR PDF EN NUEVA PESTAÑA
            if (respuesta.datos.url) {
                window.open(respuesta.datos.url, '_blank');
            }

            mensaje.innerHTML = `
                ✅ <strong>¡Factura descargada con éxito!</strong><br>
                🧾 N° Factura: ${respuesta.datos.numero || '—'}<br>
                🔢 CAE: ${respuesta.datos.cae || 'En proceso'}<br>
                Tu WhatsApp quedó guardado en nuestro sistema.
            `;
        } else {
            throw new Error(respuesta.mensaje || "No se pudo generar la factura");
        }
    } catch (error) {
        console.error("❌ Error:", error);
        mensaje.style.color = "red";
        mensaje.textContent = `⚠️ Error: ${error.message || "Intentá nuevamente"}`;
    }
}