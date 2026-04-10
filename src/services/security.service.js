import authService from "./auth.service.js";

const extractAnswers = (payload = {}) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.answers)) {
    return payload.answers;
  }

  return [];
};

const saveSecurityAnswers = async (userId, payload) => {
  const answers = extractAnswers(payload);
  return await authService.saveSecurityAnswers(userId, answers);
};

const verifySecurityAnswers = async (userId, payload) => {
  const answers = extractAnswers(payload);
  return await authService.verifySecurityAnswers(userId, answers);
};

const getUserSecurityQuestions = async (userId) => {
  return await authService.getUserSecurityQuestions(userId);
};

export default {
  saveSecurityAnswers,
  verifySecurityAnswers,
  getUserSecurityQuestions,
};