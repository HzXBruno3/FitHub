const Users = require('../data/users');

module.exports = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  console.log("Cookies recebidos:", req.cookies)
  if (!token) {
    return res.status(401).send({ auth: false, message: 'No token provided.' });
  }

  Users.verifyToken(token)
  .then((decoded) => {
    req.roleUser = decoded;
    req.userId = decoded.id;
    next();
  })
  .catch(() => {
    res.status(401).send({ auth: false, message: 'Not authorized' })
  })
};