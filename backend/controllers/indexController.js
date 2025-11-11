// controllers/indexController.js
exports.welcome = (req, res) => {
  res.json({ message: '🚀 Bienvenido a la API de Gestión' });
};

exports.healthCheck = (req, res) => {
  res.json({ status: '✅ API funcionando correctamente' });
};
