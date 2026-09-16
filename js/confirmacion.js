// ===== PÁGINA DE CONFIRMACIÓN DE PAGO =====
window.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Página de confirmación cargada");

    // ✅ RECUPERAR DATOS
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

    // ==================================================
    // ✅ SEPARAR: ID DE PAGO (MP) ↔ ID DEL PEDIDO (TUYO)
    // ==================================================
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id") || params.get("preference_id") || "";
    const pedidoId = pedidoGuardado.pedidoId || null;
    const sesionId = pedidoGuardado.sesion_id || pedidoGuardado.sesion || 'invitado';

    // ✅ MOSTRAR EN PANTALLA EL ID DE PAGO
    const ordenElem = document.getElementById("mp-orden-id");
    if (ordenElem) {
        ordenElem.textContent = paymentId || pedidoId || "Pendiente";
    }

    // ✅ GUARDAR TODOS LOS DATOS
    window._datosPedido = {
        nombre: pedidoGuardado.nombre || "Consumidor Final",
        whatsapp: pedidoGuardado.whatsapp || "",
        sesion_id: sesionId,
        pedidoId: pedidoId,
        paymentId: paymentId,
        dni: pedidoGuardado.dni_comprador || null,
        domicilio: pedidoGuardado.domicilio_comprador || null,
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
        // ✅ Ocultar factura si desmarca
        const contFactura = document.getElementById("contenedor-factura-generada");
        if (contFactura) contFactura.style.display = "none";
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

// ✅ NUEVA FUNCIÓN — CARGA PLANTILLA Y MUESTRA FACTURA ACÁ MISMO
async function generarFacturaAqui() {
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
        // ✅ PASO 1: Guardar WhatsApp en la base
        await peticion("/actualizar-factura", "POST", {
            sesion_id: datos.sesion_id,
            whatsapp: whatsapp
        });

        // ✅ PASO 2: Pedir factura al servidor
        const respuesta = await peticion("/generar-factura-pdf", "POST", {
            nombre: datos.nombre,
            whatsapp: whatsapp,
            pedido_id: datos.pedidoId,
            sesion_id: datos.sesion_id,
            dni: datos.dni,
            domicilio: datos.domicilio,
            productos: datos.carrito,
            total: datos.totalCompra
        });

        console.log("📄 Respuesta factura:", respuesta);

        if (!respuesta.ok || !respuesta.datos) {
            throw new Error(respuesta.mensaje || "No se pudo generar la factura");
        }

        // ✅ PASO 3: Cargar plantilla de factura-imprimible.html
        const plantillaRes = await fetch('/facturacionadmin/factura-imprimible.html');
        if (!plantillaRes.ok) throw new Error("No se pudo cargar el formato de factura");
        let htmlFactura = await plantillaRes.text();

        // ✅ PASO 4: Rellenar datos en la plantilla
        const nroFactura = (respuesta.datos.numero || 'Pendiente').split('|')[0].trim();
        const cae = respuesta.datos.cae || 'En trámite';
        const fecha = new Date().toLocaleString('es-AR');

        // ✅ Generar filas de productos
        const filasProductos = datos.carrito.map(p => `
            <tr>
                <td style="padding:8px; border-bottom:1px solid #ddd;">${p.nombre}</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${p.cantidad}</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">$ ${p.precio.toLocaleString("es-AR")}</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">$ ${(p.precio * p.cantidad).toLocaleString("es-AR")}</td>
            </tr>
        `).join('');

        // ✅ Reemplazar marcadores
        htmlFactura = htmlFactura
            .replace(/\[NRO_FACTURA\]/g, nroFactura)
            .replace(/\[FECHA\]/g, fecha)
            .replace(/\[CAE\]/g, cae)
            .replace(/\[NOMBRE_CLIENTE\]/g, datos.nombre)
            .replace(/\[DNI\]/g, datos.dni || 'Consumidor Final')
            .replace(/\[DIRECCION\]/g, datos.domicilio || 'Sin especificar')
            .replace(/\[WHATSAPP\]/g, whatsapp)
            .replace(/\[FILAS_PRODUCTOS\]/g, filasProductos)
            .replace(/\[TOTAL\]/g, `$ ${datos.totalCompra.toLocaleString("es-AR")}`);

        // ✅ PASO 5: Mostrar factura en la página
        const contenedor = document.getElementById("plantilla-factura");
        contenedor.innerHTML = htmlFactura;

        const contFactura = document.getElementById("contenedor-factura-generada");
        contFactura.style.display = "block";

        // ✅ PASO 6: Guardar datos para descarga
        window._facturaGenerada = {
            sesion_id: datos.sesion_id,
            numero: nroFactura
        };

        // ✅ PASO 7: Preparar enlace WhatsApp
        const linkWsp = document.getElementById("enlace-whatsapp");
        const mensajeWsp = encodeURIComponent(
            `¡Hola ${datos.nombre}! Gracias por tu compra 🧾\n\n` +
            `Factura N°: ${nroFactura}\nCAE: ${cae}\n\n` +
            `Descargala aquí: https://maximuebles-online.onrender.com/api/descargar-mi-factura/${encodeURIComponent(datos.sesion_id)}`
        );
        linkWsp.href = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${mensajeWsp}`;

        // ✅ Mensaje final
        mensaje.innerHTML = `
            ✅ <strong>¡Factura generada con éxito!</strong><br>
            🧾 N°: ${nroFactura}<br>
            🔢 CAE: ${cae}<br>
            Tu factura está abajo lista para descargar o imprimir.
        `;

    } catch (error) {
        console.error("❌ Error:", error);
        mensaje.style.color = "red";
        mensaje.textContent = `⚠️ Error: ${error.message || "Intentá nuevamente"}`;
    }
}

// ✅ DESCARGAR PDF — usa la ruta segura
function descargarPDF() {
    if (!window._facturaGenerada) {
        alert("⚠️ Primero generá tu factura");
        return;
    }
    const sesion = window._facturaGenerada.sesion_id;
    window.open(`/api/descargar-mi-factura/${encodeURIComponent(sesion)}`, '_blank');
}

// ✅ Mantener nombre antiguo por si algo lo llama → redirige a la nueva
async function generarYDescargarPDF() {
    await generarFacturaAqui();
}