// =====================================
// VALIDADOR DE CONTRASEÑA
// =====================================

const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true
};


// =====================================
// VALIDAR PASSWORD
// =====================================

const validatePassword = (password) => {

  const regex =
    /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

  return regex.test(password);

};


// =====================================
// OBTENER MENSAJE POLÍTICA PASSWORD
// =====================================

const getPasswordPolicyMessage = () => {

  return `
La contraseña debe cumplir con las siguientes reglas:

• mínimo 8 caracteres
• al menos una letra mayúscula
• al menos un número
• al menos un símbolo (!@#$%^&*)

`;

};


// =====================================
// EXPORTACIONES
// =====================================

export default {

  validatePassword,
  getPasswordPolicyMessage

};