const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // ✅ Evita errores de SSL
  max: 10, // ✅ Mantiene conexiones abiertas
  idleTimeoutMillis: 30000, // ✅ No las cierra tan rápido
  connectionTimeoutMillis: 5000 // ✅ Tiempo máximo de espera
});

module.exports = pool;