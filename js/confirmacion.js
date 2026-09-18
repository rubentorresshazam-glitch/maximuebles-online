// ===== PÁGINA DE CONFIRMACIÓN DE PAGO =====
window.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Página de confirmación cargada");
    
    // ✅ RECUPERAR DATOS — BUSCAR EN TODAS LAS UBICACIONES POSIBLES
    let pedidoGuardado = null;
    try {
        pedidoGuardado = JSON.parse(localStorage.getItem("ultimaCompra") || localStorage.getItem("pedido_confirmado") || '{}');
    } catch (e) {
        console.warn("⚠️ Error leyendo pedido:", e);
        pedidoGuardado = {};
    }

    let carrito = [];
    let totalCompra = 0;

    // ✅ LEER CARRITO
    const guardado = localStorage.getItem("carrito_pago");
    if (guardado) {
        try {
            const datos = JSON.parse(guardado);
            carrito = datos.carrito || datos.productos || [];
            totalCompra = datos.totalCompra || datos.total || 0;
        } catch (e) {
            console.warn("⚠️ Error leyendo carrito:", e);
        }
    }

    // ✅ SI ESTÁ VACÍO, USAR DIRECTAMENTE DEL PEDIDO
    if (carrito.length === 0 && pedidoGuardado.carrito) {
        carrito = pedidoGuardado.carrito || [];
        totalCompra = pedidoGuardado.totalCompra || pedidoGuardado.total || 0;
    }
    if (carrito.length === 0 && pedidoGuardado.productos) {
        carrito = pedidoGuardado.productos || [];
        totalCompra = pedidoGuardado.total || 0;
    }

    console.log("📦 Productos cargados:", carrito);
    console.log("💰 Total:", totalCompra);

    // ✅ MOSTRAR PRODUCTOS
    mostrarProductos(carrito);

    // ✅ MOSTRAR TOTAL
    const totalElem = document.getElementById("mp-total");
    if (totalElem && totalCompra > 0) {
        totalElem.textContent = `$ ${totalCompra.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
    }

    // ✅ DATOS DE SESIÓN
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id") || params.get("preference_id") || "";
    const pedidoId = pedidoGuardado.pedidoId || pedidoGuardado.id || null;
    const sesionId = pedidoGuardado.sesion_id || pedidoGuardado.sesion || localStorage.getItem("sesion_id") || 'invitado';

    // ✅ MOSTRAR NÚMERO DE OPERACIÓN
    const ordenElem = document.getElementById("mp-orden-id");
    if (ordenElem) {
        ordenElem.textContent = paymentId || pedidoId || "Completado";
    }

    // ✅ GUARDAR TODO
    window._datosPedido = {
        nombre: pedidoGuardado.nombre || "Consumidor Final",
        whatsapp: pedidoGuardado.whatsapp || pedidoGuardado.telefono || "",
        sesion_id: sesionId,
        pedidoId: pedidoId,
        paymentId: paymentId,
        dni: pedidoGuardado.dni_comprador || pedidoGuardado.dni || null,
        domicilio: pedidoGuardado.domicilio_comprador || pedidoGuardado.direccion || null,
        carrito: carrito,
        totalCompra: totalCompra
    };
    console.log("✅ Datos completos:", window._datosPedido);

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
    if (!contenedor) return;
    
    if (!carrito || carrito.length === 0) {
        contenedor.innerHTML = "<span style='color:#888;'>Sin productos</span>";
        return;
    }
    
    contenedor.innerHTML = "";
    carrito.forEach(item => {
        const nombre = item.nombre || "Producto";
        const cantidad = Number(item.cantidad) || 1;
        const precio = Number(item.precio) || 0;
        const subtotal = precio * cantidad;
        contenedor.innerHTML += `
            <div class="producto-confirmacion" style="padding:6px 0; border-bottom:1px solid #eee;">
                <span>${nombre}</span>
                <span>${cantidad} × $ ${precio.toLocaleString("es-AR")} = $ ${subtotal.toLocaleString("es-AR")}</span>
            </div>
        `;
    });
}

// ===== MOSTRAR / OCULTAR BOTÓN =====
function mostrarBotonDescarga() {
    const seleccion = document.querySelector('input[name="quiero_factura"]:checked');
    if (!seleccion) return;
    
    const zonaDescarga = document.getElementById("zona-descarga");
    if (!zonaDescarga) return;
    
    if (seleccion.value === "si") {
        zonaDescarga.classList.add("mostrar");
    } else {
        zonaDescarga.classList.remove("mostrar");
        const contFactura = document.getElementById("contenedor-factura-generada");
        if (contFactura) contFactura.style.display = "none";
    }
}

// ✅ FUNCIÓN PETICIÓN CORREGIDA
async function peticion(url, metodo = "POST", datos = {}) {
    const respuesta = await fetch(`/api${url}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: Object.keys(datos).length ? JSON.stringify(datos) : undefined
    });
    return await respuesta.json();
}

// ✅ GENERAR FACTURA — MÉTODO CORREGIDO ✅
async function generarYDescargar() {
    const datos = window._datosPedido || {};
    const contFactura = document.getElementById("contenedor-factura-generada");
    
    if (!datos.whatsapp) {
        alert("⚠️ No encontramos tu número de WhatsApp. Contactanos para tu factura.");
        return;
    }
    if (!datos.carrito || datos.carrito.length === 0) {
        alert("⚠️ No encontramos los productos de tu compra. Recargá la página e intentá nuevamente.");
        return;
    }

    try {
        // 🔑 CORRECCIÓN PRINCIPAL: Pasar 'POST' como segundo parámetro
        const respuesta = await peticion("/pedidos/generar-factura-pdf", "POST", {
            nombre: datos.nombre,
            whatsapp: datos.whatsapp,
            pedido_id: datos.pedidoId,
            sesion_id: datos.sesion_id,
            dni: datos.dni,
            domicilio: datos.domicilio,
            productos: datos.carrito,
            total: datos.totalCompra
        });

        console.log("📄 Respuesta factura:", respuesta);

        if (!respuesta.ok && !respuesta.datos) {
            throw new Error(respuesta.mensaje || "No se pudo generar la factura");
        }

        // ✅ Cargar plantilla de factura
        const plantillaRes = await fetch('/facturacionadmin/factura-imprimible.html');
        if (!plantillaRes.ok) throw new Error("No se pudo cargar el formato de factura");
        let htmlFactura = await plantillaRes.text();

        // ✅ Datos para la factura
        const nroFactura = (respuesta.datos?.numero || respuesta.numero || 'Pendiente').split('|')[0].trim();
        const cae = respuesta.datos?.cae || respuesta.cae || 'En trámite';
        const fecha = new Date().toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const totalNum = Number(datos.totalCompra) || 0;
        const ivaNum = totalNum * 0.21;

        // ✅ Filas de productos
        const filasCompletas = datos.carrito.map(p => {
            const precio = Number(p.precio) || 0;
            const cant = Number(p.cantidad) || 1;
            const subtotal = precio * cant;
            return `
                <tr>
                    <td class="cod"></td>
                    <td class="descr">${p.nombre || 'Producto'}</td>
                    <td class="cant">${cant}</td>
                    <td class="um">unidades</td>
                    <td class="pu">$ ${precio.toLocaleString("es-AR", {minimumFractionDigits:2})}</td>
                    <td class="bon">0,00</td>
                    <td class="ib">0,00</td>
                    <td class="sub">$ ${subtotal.toLocaleString("es-AR", {minimumFractionDigits:2})}</td>
                </tr>
            `;
        }).join('');

        // ✅ Reemplazar marcadores
        htmlFactura = htmlFactura
            .replace(/\[NRO_FACTURA\]/g, nroFactura)
            .replace(/\[FECHA\]/g, fecha)
            .replace(/\[CAE\]/g, cae)
            .replace(/\[NOMBRE_CLIENTE\]/g, datos.nombre)
            .replace(/\[DNI\]/g, datos.dni || 'Consumidor Final')
            .replace(/\[DIRECCION\]/g, datos.domicilio || 'Sin especificar')
            .replace(/\[FILAS_PRODUCTOS\]/g, filasCompletas)
            .replace(/\[TOTAL\]/g, `$ ${totalNum.toLocaleString("es-AR", {minimumFractionDigits:2})}`)
            .replace(/\[IVA\]/g, `$ ${ivaNum.toLocaleString("es-AR", {minimumFractionDigits:2})}`);

        // ✅ Mostrar factura en pantalla
        document.getElementById("plantilla-factura").innerHTML = htmlFactura;
        contFactura.style.display = "block";

        // ✅ Guardar datos para descarga
        window._facturaGenerada = {
            sesion_id: datos.sesion_id,
            numero: nroFactura
        };

    } catch (error) {
        console.error("❌ Error:", error);
        alert(`⚠️ Error: ${error.message}`);
    }
}

// ✅ DESCARGAR PDF — RUTA CORRECTA
function descargarPDF() {
    if (!window._facturaGenerada) {
        alert("⚠️ Primero generá tu factura");
        return;
    }
    const sesion = window._facturaGenerada.sesion_id;
    // 🔑 Ruta directa al archivo generado
    window.open(`/api/descargar-mi-factura/${encodeURIComponent(sesion)}`, '_blank');
}