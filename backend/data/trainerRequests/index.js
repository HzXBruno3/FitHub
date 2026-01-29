const TrainerRequest = require('./trainerRequest');
const TrainerRequestsService = require('./service');

const service = TrainerRequestsService(TrainerRequest);

module.exports = service;
