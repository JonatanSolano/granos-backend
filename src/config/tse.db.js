import mysql from "mysql2/promise";

const tsePool = mysql.createPool({
  host: process.env.TSE_DB_HOST || "localhost",
  port: Number(process.env.TSE_DB_PORT || 3306),
  user: process.env.TSE_DB_USER || "root",
  password: process.env.TSE_DB_PASSWORD || "",
  database: process.env.TSE_DB_NAME || "tse_simulado",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

export default tsePool;