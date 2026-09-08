// ==================================================
// ✅ URL DEL SERVIDOR — SIN DUPLICADOS
// ==================================================
const API_URL = window.location.origin + '/api';

// ==================================================
// 🔑 CÓDIGO ÚNICO AUTOMÁTICO → NADIE SE MEZCLA
// Se genera la primera vez y se queda en su navegador
// ==================================================
function obtenerIdSesion() {
  let id = localStorage.getItem('sesion_id');
  if (!id) {
    // Código irrepetible: fecha + letras/números aleatorios
    id = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('sesion_id', id);
    console.log('🆔 Sesión de invitado:', id);
  }
  return id;
}

// ✅ Identidad privada de este invitado
const SESION_ID = obtenerIdSesion();

// ==================================================
// 🔄 TODAS LAS PETICIONES → LLEVAN TU CÓDIGO PRIVADO
// El servidor filtra y devuelve SOLO LO TUYO
// ==================================================
async function peticion(url, metodo = 'GET', datos = null) {
  const opciones = {
    method: metodo,
    headers: { 'Content-Type': 'application/json' }
  };

  // ✅ Agregar el código de invitado a la URL
  const separador = url.includes('?') ? '&' : '?';
  const urlConSesion = `${API_URL}${url}${separador}sesion_id=${encodeURIComponent(SESION_ID)}`;

  // ✅ Si enviamos datos → también incluimos el código
  if (datos) {
    opciones.body = JSON.stringify({
      ...datos,
      sesion_id: SESION_ID
    });
  }

  try {
    const res = await fetch(urlConSesion, opciones);
    const cuerpo = await res.json();
    return {
      ok: res.ok,
      mensaje: cuerpo.mensaje || '',
      datos: cuerpo.datos || cuerpo
    };
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return { ok: false, mensaje: 'No se pudo conectar al servidor', datos: null };
  }
}

// ==================================================
// 🛒 CONTADOR DEL CARRITO → SOLO LOS TUYOS
// ==================================================
function actualizarContadorCarrito() {
  const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
  const cantidadTotal = carrito.reduce((total, item) => total + (item.cantidad || 1), 0);
  
  document.querySelectorAll('#headerCartCount, .contador-carrito').forEach(contador => {
    contador.textContent = cantidadTotal;
    contador.style.display = cantidadTotal > 0 ? 'flex' : 'none';
  });
}

// ==================================================
// 🔔 NOTIFICACIONES
// ==================================================
function mostrarNotificacion(mensaje) {
  const notif = Object.assign(document.createElement('div'), {
    style: `position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:linear-gradient(135deg,#226627,#34A039);color:white;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.3);z-index:99999;font-weight:600;`
  });
  notif.textContent = mensaje;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ==================================================
// ✅ AGREGAR AL CARRITO → SOLO TUYO
// ==================================================
window.agregarAlCarrito = function(producto) {
  let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
  const indice = carrito.findIndex(item => item.id === producto.id);

  if (indice !== -1) {
    carrito[indice].cantidad += 1;
    mostrarNotificacion(`✅ "${producto.nombre}" — cantidad aumentada`);
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      imagenes: producto.imagenes
    });
    mostrarNotificacion(`✅ "${producto.nombre}" agregado al carrito 🛒`);
  }

  localStorage.setItem('carrito', JSON.stringify(carrito));
  actualizarContadorCarrito();
};

// ==================================================
// ✅ VACIAR CARRITO
// ==================================================
window.vaciarCarrito = function() {
  localStorage.removeItem('carrito');
  mostrarNotificacion('🗑️ Carrito vaciado');
  actualizarContadorCarrito();
};

// ==================================================
// ✅ AL CARGAR CUALQUIER PÁGINA → ACTUALIZAR CONTADOR
// ==================================================
document.addEventListener('DOMContentLoaded', actualizarContadorCarrito);

// ✅ FAVORITOS — Compartido en toda la tienda
let favoritos = JSON.parse(localStorage.getItem('favoritos') || '[]');

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
}

function actualizarContadorFavoritos() {
    const contador = document.getElementById('favCount');
    if (contador) {
        contador.textContent = favoritos.length || '';
        contador.style.display = favoritos.length > 0 ? 'flex' : 'none';
    }
}

// ✅ Marcar corazones activos al cargar cualquier página
function marcarFavoritosEnTarjetas() {
    document.querySelectorAll('.btn-corazon-favorito').forEach(boton => {
        const id = parseInt(boton.dataset.id);
        if (favoritos.includes(id)) {
            boton.classList.add('activo');
        }
    });
    actualizarContadorFavoritos();
}

// Ejecutar cuando se cargue cualquier página
document.addEventListener('DOMContentLoaded', marcarFavoritosEnTarjetas);