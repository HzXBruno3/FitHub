const WorkoutPlan = require('./workout').WorkoutPlan;
const WorkoutCompletion = require('./workout').WorkoutCompletion;
const WorkoutsService = require('./service');

const service = WorkoutsService(WorkoutPlan, WorkoutCompletion);

module.exports = service;
