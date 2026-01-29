const Users = require('./users');
const UsersService = require('./service');

const service = UsersService(Users);

module.exports = service;