// controllers/ordersController.js
// Versión en memoria (temporal) — sin base de datos
let orders = [];
let nextOrderId = 1;

// Obtener todas las órdenes
exports.getAllOrders = (req, res) => {
  res.json(orders);
};

// Obtener orden por ID
exports.getOrderById = (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });
  res.json(order);
};

// Crear una nueva orden
exports.createOrder = (req, res) => {
  const { clientId, items, total } = req.body || {};

  if (!clientId || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: "clientId e items son requeridos" });
  }

  const order = {
    id: nextOrderId++,
    clientId,
    items,
    total: total || 0,
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  res.status(201).json(order);
};

// Actualizar orden
exports.updateOrder = (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ message: "Orden no encontrada" });

  const { items, total } = req.body || {};
  if (items !== undefined && Array.isArray(items)) order.items = items;
  if (total !== undefined) order.total = total;

  order.updatedAt = new Date().toISOString();
  res.json(order);
};

// Eliminar orden
exports.deleteOrder = (req, res) => {
  const id = parseInt(req.params.id);
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ message: "Orden no encontrada" });

  orders.splice(idx, 1);
  res.json({ message: "Orden eliminada correctamente" });
};
