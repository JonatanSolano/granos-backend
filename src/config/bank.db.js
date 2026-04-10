import mysql from "mysql2/promise";

const bankDb = mysql.createPool({
  host: process.env.BANK_DB_HOST || "localhost",
  user: process.env.BANK_DB_USER || "root",
  password: process.env.BANK_DB_PASSWORD || "",
  database: process.env.BANK_DB_NAME || "banco_simulado",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default bankDb;