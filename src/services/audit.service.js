import pool from "../config/db.js";


// =====================================
// REGISTRO BÁSICO DE EVENTOS
// =====================================

const logEvent = async ({
  userId = null,
  action,
  description = "",
  ip = null,
  userAgent = null
}) => {

  try {

    await pool.query(
      `INSERT INTO audit_log
      (user_id, action, description, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)`,
      [userId, action, description, ip, userAgent]
    );

  } catch (error) {

    console.error("Audit log error:", error);

  }

};


// =====================================
// EVENTOS DE SEGURIDAD
// =====================================

const logSecurityEvent = async ({
  userId = null,
  action,
  description = "",
  ip = null
}) => {

  try {

    await pool.query(
      `INSERT INTO audit_log
      (user_id, action, description, ip_address)
      VALUES (?, ?, ?, ?)`,
      [userId, action, description, ip]
    );

  } catch (error) {

    console.error("Security audit error:", error);

  }

};


// =====================================
// ACCIONES ADMINISTRADOR
// =====================================

const logAdminAction = async ({
  adminId,
  action,
  description = "",
  ip = null
}) => {

  try {

    await pool.query(
      `INSERT INTO audit_log
      (user_id, action, description, ip_address)
      VALUES (?, ?, ?, ?)`,
      [adminId, action, description, ip]
    );

  } catch (error) {

    console.error("Admin audit error:", error);

  }

};


// =====================================
// ACCIONES DE USUARIO
// =====================================

const logUserAction = async ({
  userId,
  action,
  description = "",
  ip = null
}) => {

  try {

    await pool.query(
      `INSERT INTO audit_log
      (user_id, action, description, ip_address)
      VALUES (?, ?, ?, ?)`,
      [userId, action, description, ip]
    );

  } catch (error) {

    console.error("User audit error:", error);

  }

};


// =====================================
// OBTENER AUDITORÍA COMPLETA
// =====================================

const getAuditLogs = async (limit = 100) => {

  const [rows] = await pool.query(
    `SELECT 
      a.id,
      a.user_id,
      u.email,
      a.action,
      a.description,
      a.ip_address,
      a.user_agent,
      a.created_at
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?`,
    [limit]
  );

  return rows;

};


// =====================================
// AUDITORÍA POR USUARIO
// =====================================

const getUserAuditLogs = async (userId, limit = 50) => {

  const [rows] = await pool.query(
    `SELECT 
      id,
      action,
      description,
      ip_address,
      created_at
    FROM audit_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?`,
    [userId, limit]
  );

  return rows;

};


// =====================================
// EXPORTACIONES
// =====================================

export default {

  logEvent,
  logSecurityEvent,
  logAdminAction,
  logUserAction,

  getAuditLogs,
  getUserAuditLogs

};