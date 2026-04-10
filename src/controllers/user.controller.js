import pool from "../config/db.js";

const validateUbicacionFinal = async (ubicacionId) => {
  const numericId = Number(ubicacionId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return {
      valid: false,
      message: "Debe seleccionar una ubicación válida.",
    };
  }

  const [rows] = await pool.query(
    `SELECT id, nivel
     FROM ubicaciones
     WHERE id = ?
       AND activo = 1
     LIMIT 1`,
    [numericId]
  );

  if (rows.length === 0) {
    return {
      valid: false,
      message: "La ubicación seleccionada no existe.",
    };
  }

  const nivel = Number(rows[0].nivel);

  if (nivel !== 3 && nivel !== 4) {
    return {
      valid: false,
      message: "Debe seleccionar una ubicación final válida.",
    };
  }

  return {
    valid: true,
    id: numericId,
  };
};

export const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         username,
         name,
         email,
         phone,
         address,
         role,
         status,
         ubicacion_id AS ubicacionId,
         totp_enabled AS totpEnabled
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo perfil",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, address, ubicacionId } = req.body;

    if (!name || !email || !phone || !address || !ubicacionId) {
      return res.status(400).json({
        message: "Todos los campos son obligatorios",
      });
    }

    const [existingEmail] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, userId]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "Ese correo ya está en uso por otro usuario",
      });
    }

    const ubicacionValidation = await validateUbicacionFinal(ubicacionId);

    if (!ubicacionValidation.valid) {
      return res.status(400).json({
        message: ubicacionValidation.message,
      });
    }

    await pool.query(
      `UPDATE users
       SET name = ?, email = ?, phone = ?, address = ?, ubicacion_id = ?
       WHERE id = ?`,
      [name, email, phone, address, ubicacionValidation.id, userId]
    );

    res.json({
      message: "Perfil actualizado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error actualizando perfil",
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         username,
         name,
         email,
         role,
         phone,
         address,
         status,
         ubicacion_id AS ubicacionId,
         totp_enabled AS totpEnabled,
         created_at
       FROM users
       WHERE role = 'cliente'
       ORDER BY id DESC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo usuarios",
    });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["activo", "bloqueado"].includes(status)) {
      return res.status(400).json({
        message: "Estado inválido",
      });
    }

    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND role = 'cliente' LIMIT 1",
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    await pool.query(
      "UPDATE users SET status = ? WHERE id = ?",
      [status, id]
    );

    res.json({
      message: "Estado actualizado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error actualizando estado del usuario",
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND role = 'cliente' LIMIT 1",
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    await pool.query(
      "DELETE FROM users WHERE id = ?",
      [id]
    );

    res.json({
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error eliminando usuario",
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      ubicacionId,
      status,
    } = req.body;

    if (!name || !email || !phone || !address) {
      return res.status(400).json({
        message: "Nombre, correo, teléfono y dirección son obligatorios",
      });
    }

    const [existingUser] = await pool.query(
      `SELECT
         id,
         ubicacion_id
       FROM users
       WHERE id = ? AND role = 'cliente'
       LIMIT 1`,
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    const [existingEmail] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, id]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "Ese correo ya está en uso por otro usuario",
      });
    }

    let finalUbicacionId = existingUser[0].ubicacion_id ?? null;

    if (ubicacionId !== null && ubicacionId !== undefined && ubicacionId !== "") {
      const ubicacionValidation = await validateUbicacionFinal(ubicacionId);

      if (!ubicacionValidation.valid) {
        return res.status(400).json({
          message: ubicacionValidation.message,
        });
      }

      finalUbicacionId = ubicacionValidation.id;
    }

    let finalStatus = status ?? "activo";

    if (!["activo", "bloqueado"].includes(finalStatus)) {
      return res.status(400).json({
        message: "Estado inválido",
      });
    }

    await pool.query(
      `UPDATE users
       SET name = ?, email = ?, phone = ?, address = ?, ubicacion_id = ?, status = ?
       WHERE id = ?`,
      [name, email, phone, address, finalUbicacionId, finalStatus, id]
    );

    res.json({
      message: "Usuario actualizado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error actualizando usuario",
    });
  }
};