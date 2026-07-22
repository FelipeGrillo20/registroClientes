// backend/utils/captchaService.js
const jwt = require("jsonwebtoken");

// Reutiliza el mismo secreto que el resto del sistema de auth
const CAPTCHA_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_temporal_2024";
const CAPTCHA_EXPIRES_IN = "2m";

// Genera una operación de suma y firma la respuesta esperada.
// El cliente nunca ve la respuesta, solo el token firmado.
exports.generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;

  const captchaToken = jwt.sign({ answer }, CAPTCHA_SECRET, {
    expiresIn: CAPTCHA_EXPIRES_IN
  });

  return {
    question: `${num1} + ${num2} = ?`,
    captchaToken
  };
};

// Verifica que la respuesta del usuario coincida con la firmada en el token
// y que el token no haya expirado ni sido manipulado.
exports.verifyCaptcha = (captchaToken, userAnswer) => {
  if (!captchaToken || userAnswer === undefined || userAnswer === null || userAnswer === "") {
    return false;
  }

  try {
    const decoded = jwt.verify(captchaToken, CAPTCHA_SECRET);
    return parseInt(userAnswer, 10) === decoded.answer;
  } catch (err) {
    // Token inválido, manipulado o expirado
    return false;
  }
};
