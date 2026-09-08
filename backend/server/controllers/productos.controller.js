const db = require('../config/database');

// 📌 OBTENER TODOS LOS PRODUCTOS — con filtro por categoría y por más vendidos
exports.obtenerTodos = async (req, res) => {
  try {
    // ✅ Filtrar por categoría o por más vendidos
    const categoria = req.query.categoria || '';
    const orden = req.query.orden || '';
    let productos;

    // 🔥 Si pide LOS MÁS VENDIDOS primero
    if (orden === 'vendidos') {
      productos = await db.query(`
        SELECT *, COALESCE(vendidos, 0) AS ventas 
        FROM productos 
        ORDER BY ventas DESC, id DESC
      `);
    }
    // 📂 Si filtra por categoría
    else if (categoria) {
      productos = await db.query(
        `SELECT id, nombre, descripcion, precio, stock, imagenes, categoria, created_at
         FROM productos 
         WHERE LOWER(categoria) = LOWER($1)
         ORDER BY id DESC`,
        [categoria.trim()]
      );
    }
    // 📋 Todos los productos normales
    else {
      productos = await db.query(`
        SELECT id, nombre, descripcion, precio, stock, imagenes, categoria, created_at
        FROM productos 
        ORDER BY id DESC
      `);
    }

    res.json({ ok: true, datos: productos.rows });
  } catch (error) {
    console.error('❌ Error al obtener productos:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
};

// 📌 OBTENER UN PRODUCTO POR ID
exports.obtenerPorId = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;
    if (!id) {
      return res.json({ ok: false, mensaje: 'Falta el ID del producto' });
    }
    const producto = await db.query(
      `SELECT id, nombre, descripcion, precio, stock, imagenes, categoria, created_at
       FROM productos 
       WHERE id = $1`,
      [id]
    );
    if (producto.rows.length === 0) {
      return res.json({ ok: false, mensaje: 'Producto no encontrado' });
    }
    res.json({ ok: true, datos: producto.rows[0] });
  } catch (error) {
    console.error('❌ Error al obtener producto:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
};

// 📌 CREAR NUEVO PRODUCTO
exports.crear = async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria, imagenes } = req.body;
    if (!nombre || !precio || stock === undefined) {
      return res.json({ ok: false, mensaje: 'Faltan datos obligatorios (nombre, precio, stock)' });
    }
    const resultado = await db.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagenes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [nombre.trim(), descripcion || '', precio, stock, categoria || '', imagenes || '']
    );
    res.status(201).json({
      ok: true,
      mensaje: '✅ Producto creado correctamente',
      id: resultado.rows[0].id
    });
  } catch (error) {
    console.error('❌ Error al crear producto:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
};

// 📌 ACTUALIZAR PRODUCTO
exports.actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagenes } = req.body;
    if (!id) {
      return res.json({ ok: false, mensaje: 'Falta el ID del producto' });
    }
    await db.query(
      `UPDATE productos 
       SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria = $5, imagenes = $6
       WHERE id = $7`,
      [nombre, descripcion, precio, stock, categoria, imagenes, id]
    );
    res.json({ ok: true, mensaje: '✅ Producto actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error al actualizar producto:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
};

// 📌 ELIMINAR PRODUCTO
exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.json({ ok: false, mensaje: 'Falta el ID del producto' });
    }
    await db.query('DELETE FROM productos WHERE id = $1', [id]);
    res.json({ ok: true, mensaje: '✅ Producto eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar producto:', error.message);
    res.json({ ok: false, mensaje: error.message });
  }
};