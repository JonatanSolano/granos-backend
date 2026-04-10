import pool from "../config/db.js";

const getAuditLogs = async (req, res) => {

  try {

    const [rows] = await pool.query(`
      SELECT 
        audit_log.id,
        users.email,
        audit_log.action,
        audit_log.entity,
        audit_log.details,
        audit_log.ip_address,
        audit_log.created_at
      FROM audit_log
      LEFT JOIN users
      ON users.id = audit_log.user_id
      ORDER BY audit_log.created_at DESC
      LIMIT 200
    `);

    res.json(rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error obteniendo auditoría"
    });

  }

};

export default {
  getAuditLogs
};