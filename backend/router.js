const express = require('express');
let AuthAPI = require('./server/auth');
let UsersAPI = require('./server/users');
let WorkoutsAPI = require('./server/workouts');
let ExercisesAPI = require('./server/exercises');
let MessagesAPI = require('./server/messages');
let TrainerRequestsAPI = require('./server/trainerRequests');

function init (io) {
    let api = express.Router();

    api.use('/auth', AuthAPI());
    api.use('/users', UsersAPI(io));
    api.use('/workouts', WorkoutsAPI(io));
    api.use('/exercises', ExercisesAPI());
    api.use('/messages', MessagesAPI(io));
    api.use('/trainer-requests', TrainerRequestsAPI(io));

    return api;
}

module.exports = {
    init: init,
}