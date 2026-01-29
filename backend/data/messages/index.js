const Message = require('./message');
const MessagesService = require('./service');

const service = MessagesService(Message);

module.exports = service;
