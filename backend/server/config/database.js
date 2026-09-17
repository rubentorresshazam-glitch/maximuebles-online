// ==================================================
// 🗄️  CONEXIÓN NEON POSTGRESQL — MAXIMUEBLES
// ✅ Ubicación: backend/server/config/database.js
// ✅ SSL compatible con Neon + Render
// ==================================================
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

// ✅ Confirmar conexión
pool.on('connect', () => {
  console.log('🗄️  ✅ Conectado a Neon PostgreSQL');
});

pool.on('error', (err) => {
  console.error('🗄️  ❌ Error de conexión BD:', err.message);
});

// ✅ Interfaz unificada
module.exports = {
  query: async (texto, parametros = []) => {
    return await pool.query(texto, parametros);
  }
};