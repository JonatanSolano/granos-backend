import pool from "../config/db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import ubicacionesService from "./ubicaciones.service.js";

const SALT_ROUNDS = 12;
const TOTP_ISSUER = "Granos La Tradición";

// =====================================
// REGISTRO AUDITORIA
// =====================================

const logAudit = async (userId, action, entity, details, ip = null) => {
  await pool.query(
    `INSERT INTO audit_log
     (user_id, action, entity, details, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, action, entity, details, ip]
  );
};

// =====================================
// DETECTAR SI EXISTE users.cedula
// =====================================

let usersCedulaColumnCache = null;

const hasUsersCedulaColumn = async (executor = pool) => {
  if (usersCedulaColumnCache !== null) {
    return usersCedulaColumnCache;
  }

  const [rows] = await executor.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'cedula'
    `
  );

  usersCedulaColumnCache = Number(rows?.[0]?.total || 0) > 0;
  return usersCedulaColumnCache;
};

// =====================================
// GENERAR USERNAME AUTOMÁTICO
// =====================================

const generateUsername = async () => {
  let username = "";
  let exists = true;

  while (exists) {
    const random = Math.random().toString(36).substring(2, 8);
    username = `usr_${random}`;

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    exists = rows.length > 0;
  }

  return username;
};

// =====================================
// HELPERS SECURITY QUESTIONS
// =====================================

const normalizeSecurityAnswers = (answers = []) => {
  if (!Array.isArray(answers)) return [];

  return answers
    .map((item) => {
      const rawQuestionId = item.questionId ?? item.id;
      const questionId = Number(rawQuestionId);
      const answer = String(item.answer ?? "").trim();

      return {
        questionId,
        answer,
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.questionId) &&
        item.questionId > 0 &&
        item.answer.length > 0
    );
};

const validateSecurityAnswersPayload = async (executor, answers) => {
  const normalizedAnswers = normalizeSecurityAnswers(answers);

  if (normalizedAnswers.length !== 2) {
    throw new Error(
      "Debe seleccionar y responder exactamente 2 preguntas de seguridad."
    );
  }

  const ids = normalizedAnswers.map((a) => a.questionId);

  if (new Set(ids).size !== 2) {
    throw new Error("Las 2 preguntas de seguridad deben ser distintas.");
  }

  const [questionRows] = await executor.query(
    `SELECT id
     FROM security_questions
     WHERE id IN (?)`,
    [ids]
  );

  if (questionRows.length !== 2) {
    throw new Error("Una o más preguntas de seguridad no existen.");
  }

  return normalizedAnswers;
};

const insertSecurityAnswersWithExecutor = async (
  executor,
  userId,
  answers
) => {
  const normalizedAnswers = await validateSecurityAnswersPayload(
    executor,
    answers
  );

  for (const ans of normalizedAnswers) {
    const hash = await bcrypt.hash(ans.answer, SALT_ROUNDS);

    await executor.query(
      `INSERT INTO security_answers
       (user_id, question_id, answer_hash)
       VALUES (?, ?, ?)`,
      [userId, ans.questionId, hash]
    );
  }
};

// =====================================
// HELPERS TOTP
// =====================================

const sanitizeOtpCode = (code) => String(code ?? "").replace(/\s+/g, "").trim();

const verifyTotpWithSecret = (secret, code) => {
  const token = sanitizeOtpCode(code);

  if (!secret || !token) return false;

  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
};

// =====================================
// BUSCAR USUARIO POR CÉDULA
// =====================================

const findUserByCedula = async (cedula) => {
  const cleanCedula = String(cedula ?? "").replace(/\D/g, "").trim();

  if (!cleanCedula) return null;

  const hasCedula = await hasUsersCedulaColumn(pool);

  if (!hasCedula) {
    return null;
  }

  const [rows] = await pool.query(
    "SELECT * FROM users WHERE cedula = ? LIMIT 1",
    [cleanCedula]
  );

  if (rows.length === 0) return null;

  return rows[0];
};

// =====================================
// REGISTRO USER
// =====================================
const registerUser = async ({
  cedula = null,
  username,
  name,
  email,
  password,
  phone = "",
  address = "",
  ubicacionId = null,
}) => {
  const [existing] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existing.length > 0) {
    throw new Error("El usuario ya existe");
  }

  const hasCedula = await hasUsersCedulaColumn(pool);

  if (hasCedula && cedula) {
    const [existingCedula] = await pool.query(
      "SELECT id FROM users WHERE cedula = ?",
      [cedula]
    );

    if (existingCedula.length > 0) {
      throw new Error("La cédula ya está registrada");
    }
  }

  let finalUsername = username;

  if (!finalUsername || finalUsername.trim() === "") {
    finalUsername = await generateUsername();
  }

  const [existingUsername] = await pool.query(
    "SELECT id FROM users WHERE username = ?",
    [finalUsername]
  );

  if (existingUsername.length > 0) {
    finalUsername = await generateUsername();
  }

  const finalUbicacionId = await ubicacionesService.validateFinalUbicacion(
    pool,
    ubicacionId
  );

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  let result;

  if (hasCedula) {
    const [insertResult] = await pool.query(
      `INSERT INTO users 
       (cedula, username, name, email, password_hash, role, status, phone, address, ubicacion_id, password_last_changed) 
       VALUES (?, ?, ?, ?, ?, 'cliente', 'activo', ?, ?, ?, NOW())`,
      [cedula, finalUsername, name, email, hashedPassword, phone, address, finalUbicacionId]
    );
    result = insertResult;
  } else {
    const [insertResult] = await pool.query(
      `INSERT INTO users 
       (username, name, email, password_hash, role, status, phone, address, ubicacion_id, password_last_changed) 
       VALUES (?, ?, ?, ?, 'cliente', 'activo', ?, ?, ?, NOW())`,
      [finalUsername, name, email, hashedPassword, phone, address, finalUbicacionId]
    );
    result = insertResult;
  }

  await pool.query(
    "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
    [result.insertId, hashedPassword]
  );

  await logAudit(
    result.insertId,
    "REGISTER",
    "users",
    `Nuevo usuario registrado: ${email}`
  );

  return {
    id: result.insertId,
    cedula: cedula ?? null,
    username: finalUsername,
    name,
    email,
    role: "cliente",
    status: "activo",
    phone,
    address,
    ubicacionId: finalUbicacionId,
  };
};

// =====================================
// REGISTRO CON 2 PREGUNTAS
// =====================================
const registerUserWithSecurityQuestions = async ({
  cedula = null,
  username,
  name,
  email,
  password,
  phone = "",
  address = "",
  ubicacionId = null,
  securityQuestions = [],
  tseMetadata = null,
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      throw new Error("El usuario ya existe");
    }

    const hasCedula = await hasUsersCedulaColumn(connection);

    if (hasCedula && cedula) {
      const [existingCedula] = await connection.query(
        "SELECT id FROM users WHERE cedula = ? LIMIT 1",
        [cedula]
      );

      if (existingCedula.length > 0) {
        throw new Error("La cédula ya está registrada");
      }
    }

    let finalUsername = username;

    if (!finalUsername || finalUsername.trim() === "") {
      finalUsername = await generateUsername();
    }

    const [existingUsername] = await connection.query(
      "SELECT id FROM users WHERE username = ?",
      [finalUsername]
    );

    if (existingUsername.length > 0) {
      finalUsername = await generateUsername();
    }

    const finalUbicacionId = await ubicacionesService.validateFinalUbicacion(
      connection,
      ubicacionId
    );

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let result;

    if (hasCedula) {
      const [insertResult] = await connection.query(
        `INSERT INTO users 
         (cedula, username, name, email, password_hash, role, status, phone, address, ubicacion_id, password_last_changed) 
         VALUES (?, ?, ?, ?, ?, 'cliente', 'activo', ?, ?, ?, NOW())`,
        [
          cedula,
          finalUsername,
          name,
          email,
          hashedPassword,
          phone,
          address,
          finalUbicacionId,
        ]
      );
      result = insertResult;
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO users 
         (username, name, email, password_hash, role, status, phone, address, ubicacion_id, password_last_changed) 
         VALUES (?, ?, ?, ?, 'cliente', 'activo', ?, ?, ?, NOW())`,
        [
          finalUsername,
          name,
          email,
          hashedPassword,
          phone,
          address,
          finalUbicacionId,
        ]
      );
      result = insertResult;
    }

    await connection.query(
      "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
      [result.insertId, hashedPassword]
    );

    await insertSecurityAnswersWithExecutor(
      connection,
      result.insertId,
      securityQuestions
    );

    await connection.commit();

    await logAudit(
      result.insertId,
      "REGISTER",
      "users",
      tseMetadata?.encontrado
        ? `Nuevo usuario registrado con validación TSE: ${email}`
        : `Nuevo usuario registrado manualmente tras consulta TSE: ${email}`
    );

    return {
      id: result.insertId,
      cedula: cedula ?? null,
      username: finalUsername,
      name,
      email,
      role: "cliente",
      status: "activo",
      phone,
      address,
      ubicacionId: finalUbicacionId,
      tse: tseMetadata
        ? {
            consultado: !!tseMetadata.consultado,
            encontrado: !!tseMetadata.encontrado,
          }
        : null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// =====================================
// BUSCAR USUARIO POR EMAIL
// =====================================

const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0) return null;

  return rows[0];
};

// =====================================
// BUSCAR USUARIO POR ID
// =====================================

const findUserById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );

  if (rows.length === 0) return null;

  return rows[0];
};

// =====================================
// ESTADO TOTP
// =====================================

const getTotpStatus = async (userId) => {
  const [rows] = await pool.query(
    `SELECT totp_enabled, totp_pending_secret, totp_enabled_at
     FROM users
     WHERE id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  const user = rows[0];

  return {
    totpEnabled: !!user.totp_enabled,
    pendingSetup: !!user.totp_pending_secret,
    totpEnabledAt: user.totp_enabled_at ?? null,
  };
};

// =====================================
// CREAR SETUP TOTP
// =====================================

const createTotpSetup = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (user.totp_enabled) {
    throw new Error("Google Authenticator ya está activado.");
  }

  const secret = speakeasy.generateSecret({
    name: `${TOTP_ISSUER} (${user.email})`,
    issuer: TOTP_ISSUER,
    length: 20,
  });

  await pool.query(
    `UPDATE users
     SET totp_pending_secret = ?
     WHERE id = ?`,
    [secret.base32, userId]
  );

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    qrDataUrl,
    manualKey: secret.base32,
    otpauthUrl: secret.otpauth_url,
    totpEnabled: false,
    pendingSetup: true,
  };
};

// =====================================
// CONFIRMAR SETUP TOTP
// =====================================

const confirmTotpSetup = async (userId, code) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (!user.totp_pending_secret) {
    throw new Error("No hay una configuración TOTP pendiente.");
  }

  const valid = verifyTotpWithSecret(user.totp_pending_secret, code);

  if (!valid) {
    throw new Error("Código de Google Authenticator inválido o expirado.");
  }

  await pool.query(
    `UPDATE users
     SET totp_enabled = 1,
         totp_secret = totp_pending_secret,
         totp_pending_secret = NULL,
         totp_enabled_at = NOW()
     WHERE id = ?`,
    [userId]
  );

  return true;
};

// =====================================
// VERIFICAR CÓDIGO TOTP
// =====================================

const verifyTotpCode = async (userId, code) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (!user.totp_enabled || !user.totp_secret) {
    throw new Error("Google Authenticator no está activado para este usuario.");
  }

  const valid = verifyTotpWithSecret(user.totp_secret, code);

  if (!valid) {
    throw new Error("Código de Google Authenticator inválido o expirado.");
  }

  return true;
};

// =====================================
// DESACTIVAR TOTP
// =====================================

const disableTotp = async (userId, code) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  if (user.totp_enabled) {
    if (!code || !sanitizeOtpCode(code)) {
      throw new Error(
        "Debe ingresar el código actual de Google Authenticator para desactivarlo."
      );
    }

    const valid = verifyTotpWithSecret(user.totp_secret, code);

    if (!valid) {
      throw new Error("Código de Google Authenticator inválido o expirado.");
    }
  }

  await pool.query(
    `UPDATE users
     SET totp_enabled = 0,
         totp_secret = NULL,
         totp_pending_secret = NULL,
         totp_enabled_at = NULL
     WHERE id = ?`,
    [userId]
  );

  return true;
};

// =====================================
// OBTENER PREGUNTAS DE SEGURIDAD
// =====================================

const getSecurityQuestions = async () => {
  const [rows] = await pool.query(
    `SELECT id, question
     FROM security_questions
     ORDER BY id`
  );

  return rows;
};

// =====================================
// OBTENER PREGUNTAS CONFIGURADAS DE UN USUARIO
// =====================================

const getUserSecurityQuestions = async (userId) => {
  const [rows] = await pool.query(
    `SELECT sq.id, sq.question
     FROM security_answers sa
     INNER JOIN security_questions sq
       ON sq.id = sa.question_id
     WHERE sa.user_id = ?
     ORDER BY sa.question_id`,
    [userId]
  );

  return rows;
};

// =====================================
// GUARDAR / ACTUALIZAR RESPUESTAS DE SEGURIDAD
// =====================================

const saveSecurityAnswers = async (userId, answers) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedAnswers = await validateSecurityAnswersPayload(
      connection,
      answers
    );

    await connection.query(
      `DELETE FROM security_answers
       WHERE user_id = ?`,
      [userId]
    );

    await insertSecurityAnswersWithExecutor(
      connection,
      userId,
      normalizedAnswers
    );

    await connection.commit();

    await logAudit(
      userId,
      "SECURITY_ANSWERS_UPDATED",
      "security_answers",
      "Preguntas de seguridad actualizadas"
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// =====================================
// VALIDAR RESPUESTAS SEGURIDAD
// =====================================

const verifySecurityAnswers = async (userId, answers) => {
  const normalizedAnswers = normalizeSecurityAnswers(answers);

  if (normalizedAnswers.length !== 2) {
    return false;
  }

  const ids = normalizedAnswers.map((a) => a.questionId);

  if (new Set(ids).size !== 2) {
    return false;
  }

  const [rows] = await pool.query(
    `SELECT question_id, answer_hash
     FROM security_answers
     WHERE user_id = ?
       AND question_id IN (?)`,
    [userId, ids]
  );

  if (rows.length !== 2) {
    return false;
  }

  const answersMap = new Map(
    normalizedAnswers.map((item) => [item.questionId, item.answer])
  );

  for (const row of rows) {
    const plainAnswer = answersMap.get(row.question_id);

    if (!plainAnswer) {
      return false;
    }

    const match = await bcrypt.compare(
      plainAnswer,
      row.answer_hash
    );

    if (!match) {
      return false;
    }
  }

  return true;
};

// =====================================
// INTENTOS FALLIDOS
// =====================================

const incrementFailedAttempts = async (userId) => {
  await pool.query(
    "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?",
    [userId]
  );
};

const resetFailedAttempts = async (userId) => {
  await pool.query(
    "UPDATE users SET failed_attempts = 0 WHERE id = ?",
    [userId]
  );
};

// =====================================
// BLOQUEO AUTOMÁTICO
// =====================================

const lockAccount = async (userId) => {
  await pool.query(
    `UPDATE users 
     SET account_locked = TRUE,
         lock_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
     WHERE id = ?`,
    [userId]
  );

  await logAudit(
    userId,
    "ACCOUNT_LOCKED",
    "users",
    "Cuenta bloqueada por intentos fallidos"
  );
};

const resetLock = async (userId) => {
  await pool.query(
    `UPDATE users 
     SET account_locked = FALSE,
         failed_attempts = 0,
         lock_until = NULL
     WHERE id = ?`,
    [userId]
  );
};

// =====================================
// CAMBIO CONTRASEÑA
// =====================================

const changePassword = async (userId, newPassword) => {
  const [history] = await pool.query(
    `SELECT password_hash
     FROM password_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  for (const record of history) {
    const match = await bcrypt.compare(newPassword, record.password_hash);

    if (match) {
      throw new Error("No puede repetir una de las últimas 10 contraseñas.");
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await pool.query(
    `UPDATE users
     SET password_hash = ?, password_last_changed = NOW()
     WHERE id = ?`,
    [hashedPassword, userId]
  );

  await pool.query(
    "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
    [userId, hashedPassword]
  );

  await logAudit(
    userId,
    "PASSWORD_CHANGE",
    "users",
    "Cambio de contraseña"
  );
};

// =====================================
// LIMPIAR TOKENS EXPIRADOS
// =====================================

const cleanupExpiredTokens = async () => {
  await pool.query(
    `DELETE FROM mfa_tokens WHERE expires_at < NOW()`
  );

  await pool.query(
    `DELETE FROM password_reset_tokens WHERE expires_at < NOW()`
  );
};

// =====================================
// GENERAR TOKEN MFA
// =====================================

const createMFAToken = async (userId) => {
  await cleanupExpiredTokens();

  const token = Math.floor(100000 + Math.random() * 900000).toString();

  const expires = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    `INSERT INTO mfa_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, token, expires]
  );

  return token;
};

// =====================================
// VERIFICAR TOKEN MFA
// =====================================

const verifyMFAToken = async (userId, token) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM mfa_tokens
     WHERE user_id = ?
     AND token = ?
     AND used = 0
     AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, sanitizeOtpCode(token)]
  );

  if (rows.length === 0) {
    throw new Error("Código MFA inválido o expirado");
  }

  const record = rows[0];

  await pool.query(
    "UPDATE mfa_tokens SET used = 1 WHERE id = ?",
    [record.id]
  );

  await logAudit(
    userId,
    "MFA_VERIFIED",
    "auth",
    "Código MFA verificado correctamente"
  );

  return true;
};

// =====================================
// TOKEN RECUPERACIÓN
// =====================================

const createPasswordResetToken = async (email) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("El usuario no existe");
  }

  const token = crypto.randomBytes(32).toString("hex");

  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens
     (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, token, expires]
  );

  await logAudit(
    user.id,
    "PASSWORD_RESET_REQUEST",
    "users",
    "Solicitud de recuperación de contraseña"
  );

  return token;
};

// =====================================
// VALIDAR TOKEN RESET
// =====================================

const validateResetToken = async (token) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM password_reset_tokens
     WHERE token = ?
     AND used = 0
     AND expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) {
    throw new Error("Token inválido o expirado");
  }

  return rows[0];
};

// =====================================
// RESET PASSWORD
// =====================================

const resetPasswordWithToken = async (token, newPassword) => {
  const tokenData = await validateResetToken(token);

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await pool.query(
    `UPDATE users
     SET password_hash = ?, password_last_changed = NOW()
     WHERE id = ?`,
    [hashedPassword, tokenData.user_id]
  );

  await pool.query(
    "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
    [tokenData.user_id, hashedPassword]
  );

  await pool.query(
    "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
    [tokenData.id]
  );

  await logAudit(
    tokenData.user_id,
    "PASSWORD_RESET",
    "users",
    "Contraseña restablecida mediante token"
  );
};

export default {
  registerUser,
  registerUserWithSecurityQuestions,
  findUserByEmail,
  findUserById,
  findUserByCedula,

  getTotpStatus,
  createTotpSetup,
  confirmTotpSetup,
  verifyTotpCode,
  disableTotp,

  getSecurityQuestions,
  getUserSecurityQuestions,
  saveSecurityAnswers,
  verifySecurityAnswers,

  incrementFailedAttempts,
  resetFailedAttempts,
  lockAccount,
  resetLock,

  changePassword,

  createMFAToken,
  verifyMFAToken,

  createPasswordResetToken,
  validateResetToken,
  resetPasswordWithToken,

  cleanupExpiredTokens,

  logAudit,
};