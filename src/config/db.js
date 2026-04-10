import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  connectTimeout: 10000
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conexión MySQL exitosa");
    connection.release();
  } catch (error) {
    console.error("❌ Error conectando a MySQL:", error.message);
  }
})();

export default pool;