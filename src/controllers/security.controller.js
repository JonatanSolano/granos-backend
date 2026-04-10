import securityService from "../services/security.service.js";
import authService from "../services/auth.service.js";

// =================================
// NORMALIZAR RESPUESTAS
// =================================

const normalizeAnswers = (answers = []) => {
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

const buildLegacyAnswers = async (userId, body) => {
  const questions = await securityService.getUserSecurityQuestions(userId);

  if (!questions || questions.length !== 3) {
    throw new Error(
      "El usuario no tiene configuradas correctamente sus 3 preguntas de seguridad."
    );
  }

  const legacyAnswers = [
    { questionId: questions[0].id, answer: body.answer1 },
    { questionId: questions[1].id, answer: body.answer2 },
    { questionId: questions[2].id, answer: body.answer3 },
  ];

  return normalizeAnswers(legacyAnswers);
};

// =================================
// OBTENER PREGUNTAS DE RECUPERACIÓN
// =================================

const getRecoveryQuestions = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: "El correo es obligatorio",
      });
    }

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    const questions = await securityService.getUserSecurityQuestions(user.id);

    if (!questions || questions.length !== 3) {
      return res.status(400).json({
        error: "El usuario no tiene 3 preguntas de seguridad configuradas",
      });
    }

    return res.json({
      questions,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =================================
// GUARDAR RESPUESTAS
// =================================

const saveAnswers = async (req, res) => {
  try {
    const userId = req.user.id;

    const payloadAnswers = Array.isArray(req.body)
        ? req.body
        : req.body.answers;

    const normalizedAnswers = normalizeAnswers(payloadAnswers);

    await securityService.saveSecurityAnswers(userId, normalizedAnswers);

    return res.json({
      message: "Preguntas de seguridad guardadas",
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
};

// =================================
// VERIFICAR RESPUESTAS
// =================================

const verifyAnswers = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: "El correo es obligatorio",
      });
    }

    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    let normalizedAnswers = [];

    if (Array.isArray(req.body.answers)) {
      normalizedAnswers = normalizeAnswers(req.body.answers);
    } else if (req.body.answer1 || req.body.answer2 || req.body.answer3) {
      normalizedAnswers = await buildLegacyAnswers(user.id, req.body);
    }

    if (normalizedAnswers.length !== 3) {
      return res.status(400).json({
        error: "Debe responder exactamente 3 preguntas de seguridad distintas",
      });
    }

    const verified = await securityService.verifySecurityAnswers(
      user.id,
      normalizedAnswers
    );

    if (!verified) {
      return res.status(401).json({
        error: "Respuestas incorrectas",
      });
    }

    const token = await authService.createPasswordResetToken(email);

    return res.json({
      message: "Respuestas correctas",
      resetToken: token,
    });
  } catch (error) {
    return res.status(401).json({
      error: error.message,
    });
  }
};

export default {
  getRecoveryQuestions,
  saveAnswers,
  verifyAnswers,
};