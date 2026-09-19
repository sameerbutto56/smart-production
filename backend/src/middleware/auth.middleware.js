const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.set('X-Token-Error', 'missing');
    return res.status(401).json({ message: 'No token provided', code: 'NO_TOKEN' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.set('X-Token-Error', 'invalid');
    return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

const authorize = (...args) => {
  let roles = [];
  if (args.length === 1 && Array.isArray(args[0])) {
    roles = args[0];
  } else if (args.length === 1 && typeof args[0] === 'string') {
    roles = [args[0]];
  } else {
    roles = args.flat();
  }

  return (req, res, next) => {
    if (roles.length && !roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
