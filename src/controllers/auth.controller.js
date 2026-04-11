import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import authService from "../services/auth.service.js";
import emailService from "../services/email.service.js";
import { consultarCiudadanoPorCedula } from "../services/tse.service.js";

console.log("AUTH CONTROLLER CARGADO");

// =============================
// VALIDACIÓN PASSWORD
// =============================

const isValidPassword = (password) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*]/.test(password);

  return minLength && hasUppercase && hasNumber && hasSymbol;
};

// =============================
// MENSAJE POLÍTICA PASSWORD
// =============================

const passwordPolicyMessage = `
La contraseña debe contener:
- mínimo 8 caracteres
- al menos una mayúscula
- al menos un número
- al menos un símbolo (!@#$%^&*)
`;

// =============================
// GENERAR USERNAME
// =============================

const generateUsername = (name) => {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "")
    .substring(0, 8);

  const random = Math.floor(1000 + Math.random() * 9000);

  return `${base}${random}`;
};

// =============================
// HELPERS
// =============================

const limpiarCedula = (cedula = "") =>
  String(cedula).replace(/\D/g, "").trim();

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// =============================
// NORMALIZAR RESPUESTAS SEGURIDAD
// =============================

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

const validateSecurityAnswersPayload = (answers) => {
  if (!Array.isArray(answers) || answers.length !== 2) {
    return "Debe seleccionar y responder exactamente 2 preguntas de seguridad.";
  }

  const ids = answers.map((a) => a.questionId);

  if (new Set(ids).size !== 2) {
    return "Las 2 preguntas de seguridad deben ser distintas.";
  }

  for (const item of answers) {
    if (!item.answer || !item.answer.trim()) {
      return "Debe responder las 2 preguntas de seguridad.";
    }
  }

  return null;
};

const buildAuthResponse = async (userId) => {
  const user = await authService.findUserById(userId);

  const token = jwt.sign(
    {
      id: userId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      status: user.status,
      ubicacionId: user.ubicacion_id ?? null,
      totpEnabled: !!user.totp_enabled,
    },
  };
};

// =============================
// REGISTER
// =============================

const register = async (req, res) => {
  try {
    const {
      cedula,
      name,
      email,
      password,
      phone,
      address,
      ubicacionId,
      tseConsultado,
      tseEncontrado,
      securityQuestions,
    } = req.body;

    const cedulaLimpia = limpiarCedula(cedula);

    if (!cedulaLimpia) {
      return res.status(400).json({
        error: "La cédula es obligatoria.",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    if (cedulaLimpia.length < 6) {
      return res.status(400).json({
        error: "La cédula ingresada no es válida.",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios.",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: "La contraseña no cumple la política de seguridad.",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    if (tseConsultado !== true) {
      return res.status(400).json({
        error: "Debe consultar la cédula en TSE antes de registrarse.",
      });
    }

    const normalizedSecurityQuestions =
      normalizeSecurityAnswers(securityQuestions);

    const securityValidationError =
      validateSecurityAnswersPayload(normalizedSecurityQuestions);

    if (securityValidationError) {
      return res.status(400).json({
        error: securityValidationError,
      });
    }

    const existingUser = await authService.findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: "El correo ya está registrado.",
      });
    }

    const existingUserByCedula = await authService.findUserByCedula(cedulaLimpia);

    if (existingUserByCedula) {
      return res.status(409).json({
        error: "La cédula ya está registrada.",
      });
    }

    let tseResult;
    try {
      tseResult = await consultarCiudadanoPorCedula(cedulaLimpia);
    } catch (error) {
      return res.status(502).json({
        error: "No fue posible validar la cédula contra el TSE simulado.",
        detail: error.message,
      });
    }

    const backendTseEncontrado = tseResult?.found === true;

    if (backendTseEncontrado !== Boolean(tseEncontrado)) {
      return res.status(400).json({
        error: backendTseEncontrado
          ? "La cédula sí existe en TSE. Vuelva a consultar antes de registrarse."
          : "La cédula no existe en TSE. Vuelva a consultar antes de registrarse.",
      });
    }

    let finalName = String(name).trim();
    let finalAddress = String(address ?? "").trim();

    if (backendTseEncontrado) {
      const nombreTse = String(tseResult.data?.nombreCompleto ?? "").trim();

      if (!finalName) {
        finalName = nombreTse;
      }

      if (
        nombreTse &&
        normalizeText(finalName) !== normalizeText(nombreTse)
      ) {
        return res.status(400).json({
          error:
            "El nombre no coincide con la información obtenida desde el TSE simulado.",
        });
      }

      if (!finalAddress) {
        finalAddress = String(tseResult.data?.domicilioElectoral ?? "").trim();
      }
    }

    const username = generateUsername(finalName);

    const user = await authService.registerUserWithSecurityQuestions({
      cedula: cedulaLimpia,
      username,
      name: finalName,
      email,
      password,
      phone,
      address: finalAddress,
      ubicacionId,
      securityQuestions: normalizedSecurityQuestions,
      tseMetadata: {
        consultado: true,
        encontrado: backendTseEncontrado,
        cedula: cedulaLimpia,
      },
    });

    await authService.logAudit(
      user.id,
      "REGISTER",
      "auth",
      backendTseEncontrado
        ? `Registro de nuevo usuario validado con TSE. Cédula: ${cedulaLimpia}`
        : `Registro manual de nuevo usuario. Cédula no encontrada en TSE: ${cedulaLimpia}`,
      req.ip
    );

    return res.status(201).json({
      message: backendTseEncontrado
        ? "Usuario registrado correctamente con validación TSE"
        : "Usuario registrado correctamente con datos manuales",
      passwordPolicy: passwordPolicyMessage,
      user,
      securityConfigured: true,
      tse: {
        consultado: true,
        encontrado: backendTseEncontrado,
        cedula: cedulaLimpia,
      },
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// LOGIN
// =============================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    if (user.password_last_changed) {
      const passwordAge = new Date() - new Date(user.password_last_changed);
      const days = passwordAge / (1000 * 60 * 60 * 24);

      if (days > 90) {
        return res.status(403).json({
          error: "Debe cambiar su contraseña.",
          passwordExpired: true,
        });
      }
    }

    if (user.status === "bloqueado") {
      return res.status(403).json({
        error: "Cuenta bloqueada por administrador.",
      });
    }

    if (user.account_locked) {
      if (user.lock_until && new Date() < new Date(user.lock_until)) {
        return res.status(403).json({
          error: "Cuenta bloqueada temporalmente.",
          lockUntil: user.lock_until,
        });
      } else {
        await authService.resetLock(user.id);
        await authService.resetFailedAttempts(user.id);
      }
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await authService.incrementFailedAttempts(user.id);

      await authService.logAudit(
        user.id,
        "LOGIN_FAILED",
        "auth",
        "Contraseña incorrecta",
        req.ip
      );

      const updatedUser = await authService.findUserByEmail(email);

      const maxAttempts = 3;
      const failed = updatedUser.failed_attempts;
      const remaining = maxAttempts - failed;

      if (failed >= maxAttempts) {
        await authService.lockAccount(user.id);

        const lockedUser = await authService.findUserByEmail(email);

        return res.status(403).json({
          error: "Cuenta bloqueada temporalmente.",
          lockUntil: lockedUser.lock_until,
          failedAttempts: failed,
        });
      }

      return res.status(401).json({
        error: "Contraseña incorrecta.",
        failedAttempts: failed,
        remainingAttempts: remaining,
      });
    }

    await authService.resetFailedAttempts(user.id);

    await authService.logAudit(
      user.id,
      "LOGIN_SUCCESS",
      "auth",
      "Inicio de sesión exitoso",
      req.ip
    );

    if (user.totp_enabled) {
      return res.status(200).json({
        mfaRequired: true,
        mfaType: "totp",
        userId: user.id,
        message: "Ingrese el código de Google Authenticator.",
      });
    }

    const mfaCode = await authService.createMFAToken(user.id);

    const emailResult = await emailService.sendMFACode(user.email, mfaCode);

    return res.status(200).json({
      mfaRequired: true,
      mfaType: "email",
      userId: user.id,
      message: emailResult?.simulated
        ? "Código MFA simulado generado correctamente."
        : "Código MFA enviado al correo.",
      ...(emailResult?.simulated ? { devMfaCode: mfaCode } : {}),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      error: "Error interno del servidor.",
    });
  }
};

// =============================
// VERIFY MFA / TOTP
// =============================

const verifyMFA = async (req, res) => {
  try {
    const { userId, code, method } = req.body;
    const mfaMethod = String(method || "email").toLowerCase();

    if (!userId || !code) {
      return res.status(400).json({
        error: "Debe enviar userId y code.",
      });
    }

    if (mfaMethod === "totp") {
      await authService.verifyTotpCode(userId, code);

      await authService.logAudit(
        userId,
        "TOTP_LOGIN_VERIFIED",
        "auth",
        "Verificación TOTP exitosa en login",
        req.ip
      );
    } else {
      await authService.verifyMFAToken(userId, code);

      await authService.logAudit(
        userId,
        "MFA_VERIFIED",
        "auth",
        "Verificación MFA por correo exitosa",
        req.ip
      );
    }

    const authResponse = await buildAuthResponse(userId);

    return res.status(200).json(authResponse);
  } catch (error) {
    await authService.logAudit(
      req.body.userId,
      req.body.method === "totp" ? "TOTP_LOGIN_FAILED" : "MFA_FAILED",
      "auth",
      req.body.method === "totp"
        ? "Código TOTP incorrecto"
        : "Código MFA incorrecto",
      req.ip
    );

    return res.status(401).json({
      error:
        req.body.method === "totp"
          ? "Código de Google Authenticator inválido"
          : "Código MFA inválido",
    });
  }
};

// =============================
// TOTP STATUS
// =============================

const getTotpStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await authService.getTotpStatus(userId);

    return res.status(200).json(status);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// TOTP SETUP
// =============================

const setupTotp = async (req, res) => {
  try {
    const userId = req.user.id;
    const setup = await authService.createTotpSetup(userId);

    await authService.logAudit(
      userId,
      "TOTP_SETUP_STARTED",
      "auth",
      "Inicio de configuración de Google Authenticator",
      req.ip
    );

    return res.status(200).json({
      message: "Escanee el código QR y confirme con el código generado.",
      ...setup,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// TOTP CONFIRM
// =============================

const confirmTotp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        error: "Debe ingresar el código de Google Authenticator.",
      });
    }

    await authService.confirmTotpSetup(userId, code);

    await authService.logAudit(
      userId,
      "TOTP_ENABLED",
      "auth",
      "Google Authenticator activado",
      req.ip
    );

    return res.status(200).json({
      message: "Google Authenticator activado correctamente.",
      totpEnabled: true,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// TOTP DISABLE
// =============================

const disableTotp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    await authService.disableTotp(userId, code);

    await authService.logAudit(
      userId,
      "TOTP_DISABLED",
      "auth",
      "Google Authenticator desactivado",
      req.ip
    );

    return res.status(200).json({
      message: "Google Authenticator desactivado correctamente.",
      totpEnabled: false,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// GET SECURITY QUESTIONS
// =============================

const getSecurityQuestions = async (_req, res) => {
  try {
    const questions = await authService.getSecurityQuestions();

    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo preguntas de seguridad",
    });
  }
};

// =============================
// GET RECOVERY SECURITY QUESTIONS BY EMAIL
// =============================

const getRecoverySecurityQuestionsByEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: "El correo es obligatorio.",
      });
    }

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: "No se encontró un usuario con ese correo.",
      });
    }

    const questions = await authService.getUserSecurityQuestions(user.id);

    if (!questions || questions.length !== 2) {
      return res.status(400).json({
        error: "El usuario no tiene configuradas 2 preguntas de seguridad.",
      });
    }

    return res.status(200).json({
      userId: user.id,
      questions,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo las preguntas de recuperación.",
    });
  }
};

// =============================
// SAVE SECURITY ANSWERS
// =============================

const saveSecurityAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    const normalizedAnswers = normalizeSecurityAnswers(answers);
    const validationError =
      validateSecurityAnswersPayload(normalizedAnswers);

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    await authService.saveSecurityAnswers(Number(userId), normalizedAnswers);

    return res.status(200).json({
      message: "Respuestas guardadas correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error guardando respuestas",
    });
  }
};

// =============================
// VERIFY SECURITY ANSWERS
// =============================

const verifySecurityAnswers = async (req, res) => {
  try {
    const { userId, email, answers } = req.body;

    const normalizedAnswers = normalizeSecurityAnswers(answers);
    const validationError =
      validateSecurityAnswersPayload(normalizedAnswers);

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    let resolvedUserId = userId;

    if (!resolvedUserId && email) {
      const user = await authService.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          error: "Usuario no encontrado.",
        });
      }

      resolvedUserId = user.id;
    }

    if (!resolvedUserId) {
      return res.status(400).json({
        error: "Debe enviar userId o email.",
      });
    }

    const valid = await authService.verifySecurityAnswers(
      Number(resolvedUserId),
      normalizedAnswers
    );

    if (!valid) {
      return res.status(401).json({
        error: "Respuestas incorrectas",
      });
    }

    return res.status(200).json({
      verified: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Error verificando respuestas",
    });
  }
};

// =============================
// VALIDATE RESET TOKEN
// =============================

const validateResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    const tokenData = await authService.validateResetToken(token);

    return res.status(200).json({
      valid: true,
      userId: tokenData.user_id,
    });
  } catch (error) {
    return res.status(400).json({
      error: "Token inválido o expirado",
    });
  }
};

// =============================
// RECOVER PASSWORD WITH SECURITY
// =============================

const recoverPasswordWithSecurity = async (req, res) => {
  try {
    const { email, answers } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: "El correo es obligatorio.",
      });
    }

    const normalizedAnswers = normalizeSecurityAnswers(answers);
    const validationError =
      validateSecurityAnswersPayload(normalizedAnswers);

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado.",
      });
    }

    const valid = await authService.verifySecurityAnswers(
      user.id,
      normalizedAnswers
    );

    if (!valid) {
      await authService.logAudit(
        user.id,
        "SECURITY_QUESTIONS_FAILED",
        "auth",
        "Intento fallido de recuperación por preguntas de seguridad",
        req.ip
      );

      return res.status(401).json({
        error: "Respuestas incorrectas.",
      });
    }

    const token = await authService.createPasswordResetToken(email);

    await authService.logAudit(
      user.id,
      "SECURITY_QUESTIONS_SUCCESS",
      "auth",
      "Recuperación por preguntas de seguridad validada",
      req.ip
    );

    return res.status(200).json({
      message: "Respuestas correctas. Puede restablecer su contraseña.",
      resetToken: token,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// CHANGE PASSWORD
// =============================

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPassword } = req.body;

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: "La contraseña no cumple la política.",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    await authService.changePassword(userId, newPassword);

    return res.status(200).json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// FORGOT PASSWORD
// =============================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const token = await authService.createPasswordResetToken(email);

    return res.status(200).json({
      message: "Token generado",
      token,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// RESET PASSWORD
// =============================

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: "Contraseña no cumple la política",
        passwordPolicy: passwordPolicyMessage,
      });
    }

    await authService.resetPasswordWithToken(token, newPassword);

    return res.status(200).json({
      message: "Contraseña restablecida",
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =============================
// RECOVER USERNAME
// =============================

const recoverUsername = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await authService.findUserByEmail(email);

    if (user) {
      await emailService.sendUsernameRecovery(
        user.email,
        user.username
      );
    }

    return res.status(200).json({
      message: "Si el correo existe, se ha enviado el usuario.",
    });
  } catch (_error) {
    return res.status(200).json({
      message: "Si el correo existe, se ha enviado el usuario.",
    });
  }
};

export default {
  register,
  login,
  verifyMFA,
  getTotpStatus,
  setupTotp,
  confirmTotp,
  disableTotp,
  verifySecurityAnswers,
  recoverPasswordWithSecurity,
  validateResetToken,
  changePassword,
  forgotPassword,
  resetPassword,
  recoverUsername,
  getSecurityQuestions,
  getRecoverySecurityQuestionsByEmail,
  saveSecurityAnswers,
};