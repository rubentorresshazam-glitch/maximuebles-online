// ==================================================
// ❤️ FAVORITOS + 🔥 MÁS VENDIDOS
// MaxiMuebles — Se carga automáticamente
// ==================================================

// 📦 Almacenamiento local de favoritos del cliente
let favoritos = JSON.parse(localStorage.getItem('favoritos') || '[]');

// ✅ Actualizar contador de favoritos
function actualizarContadorFavoritos() {
    const contador = document.getElementById('favCount');
    if (contador) {
        contador.textContent = favoritos.length || '';
        contador.style.display = favoritos.length > 0 ? 'flex' : 'none';
    }
}

// ✅ Renderizar los productos que el cliente guardó como favoritos
async function cargarMisFavoritos() {
    const contenedor = document.getElementById('favoritos-grid');
    if (!contenedor) return;

    if (favoritos.length === 0) {
        contenedor.innerHTML = `
            <div class="mensaje-vacio-contenedor" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fa-solid fa-heart" style="font-size: 3rem; color: #333; margin-bottom: 1rem;"></i>
                <p style="color: #888; font-size: 1rem;">Todavía no guardaste ningún producto como favorito.</p>
                <p style="color: #666; font-size: 0.9rem;">💡 Hacé clic en el corazón en cualquier producto para agregarlo acá.</p>
            </div>`;
        return;
    }

    try {
        const respuesta = await peticion('/productos');
        if (!respuesta.ok || !respuesta.datos) throw new Error('Sin datos');

        const todos = respuesta.datos;
        const productosFavoritos = todos.filter(p => favoritos.includes(p.id));

        if (productosFavoritos.length === 0) {
            contenedor.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Los productos que guardaste aparecerán acá.</p>`;
            return;
        }

        contenedor.innerHTML = productosFavoritos.map(producto => crearTarjetaProducto(producto)).join('');
    } catch (err) {
        contenedor.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">No se pudieron cargar tus favoritos.</p>`;
    }
}

// ✅ Cargar LOS MÁS VENDIDOS — se ordenan automáticamente desde la API
async function cargarMasVendidos() {
    const contenedor = document.getElementById('mas-vendidos-grid');
    if (!contenedor) return;

    try {
        // 📌 La API devuelve productos ordenados por "cantidad vendida" automáticamente
        const respuesta = await peticion('/productos?orden=vendidos');
        if (!respuesta.ok || !respuesta.datos) throw new Error('Sin datos');

        const masVendidos = respuesta.datos.slice(0, 8); // Los 8 más vendidos
        contenedor.innerHTML = masVendidos.map(producto => crearTarjetaProducto(producto)).join('');
    } catch (err) {
        // Fallback: mostrar todos si no viene el filtro
        try {
            const respuesta = await peticion('/productos');
            if (respuesta.ok && respuesta.datos) {
                const productos = respuesta.datos.slice(0, 8);
                contenedor.innerHTML = productos.map(p => crearTarjetaProducto(p)).join('');
            } else {
                contenedor.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">No se pudieron cargar los productos.</p>`;
            }
        } catch {
            contenedor.innerHTML = `<p class="mensaje-vacio" style="grid-column:1/-1;">Sin conexión en este momento.</p>`;
        }
    }
}

// ✅ Crear tarjeta de producto (igual al resto del sitio)
function crearTarjetaProducto(producto) {
    const tieneDescuento = producto.precio_oferta && producto.precio_oferta < producto.precio;
    const precioFinal = tieneDescuento ? producto.precio_oferta : producto.precio;
    const imagen = producto.imagenes ? JSON.parse(producto.imagenes)[0] : '/assets/sin-imagen.jpg';
    const esFavorito = favoritos.includes(producto.id);

    return `
    <div class="product-card">
        ${tieneDescuento ? `<div class="etiqueta-oferta">¡OFERTA!</div>` : ''}
        <button class="btn-corazon-favorito ${esFavorito ? 'activo' : ''}" 
                data-id="${producto.id}" 
                onclick="alternarFavorito(${producto.id}, this)"
                title="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
            <i class="fa-solid fa-heart"></i>
        </button>
        <a href="/pages/producto-detalle.html?id=${producto.id}" class="product-link">
            <div class="product-image">
                <img src="${imagen}" alt="${producto.nombre}" loading="lazy">
            </div>
            <div class="product-info">
                <h3 class="product-name">${producto.nombre}</h3>
                <div class="product-price">
                    ${tieneDescuento ? `<span class="precio-anterior">$ ${formatearPrecio(producto.precio)}</span>` : ''}
                    <span class="precio-actual">$ ${formatearPrecio(precioFinal)}</span>
                </div>
                <div class="cuotas">Hasta 12 cuotas sin interés</div>
            </div>
        </a>
    </div>`;
}

// ✅ Agregar / Quitar de favoritos
function alternarFavorito(id, boton) {
    const existe = favoritos.indexOf(id);
    if (existe >= 0) {
        favoritos.splice(existe, 1);
        boton.classList.remove('activo');
    } else {
        favoritos.push(id);
        boton.classList.add('activo');
    }
    localStorage.setItem('favoritos', JSON.stringify(favoritos));
    actualizarContadorFavoritos();
    cargarMisFavoritos(); // Recarga la sección
}

// ✅ Formatear precio
function formatearPrecio(precio) {
    return Number(precio).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

// ✅ Cargar todo al entrar a la página
document.addEventListener('DOMContentLoaded', () => {
    actualizarContadorFavoritos();
    cargarMisFavoritos();
    cargarMasVendidos();
});