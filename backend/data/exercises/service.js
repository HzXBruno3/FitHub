function ExercisesService(ExerciseModel) {
  let service = {
    create,
    findAll,
    findById,
    update,
    deleteExercise,
    findByTrainer,
  };

  function create(exerciseData) {
    return new Promise(function (resolve, reject) {
      const newExercise = new ExerciseModel(exerciseData);
      newExercise.save(function (err, exercise) {
        if (err) {
          console.error('Erro ao criar exercício:', err);
          reject("Erro ao criar exercício");
        }
        resolve(exercise);
      });
    });
  }

  function findAll(query = {}) {
    return new Promise(function (resolve, reject) {
      ExerciseModel.find(query)
        .populate("createdBy", "name")
        .sort({ name: 1 })
        .exec(function (err, exercises) {
          if (err) reject(err);
          resolve(exercises);
        });
    });
  }

  function findById(id) {
    return new Promise(function (resolve, reject) {
      ExerciseModel.findById(id)
        .populate("createdBy", "name email")
        .exec(function (err, exercise) {
          if (err) reject(err);
          if (!exercise) reject('Exercício não encontrado');
          resolve(exercise);
        });
    });
  }

  function update(id, exerciseData) {
    return new Promise(function (resolve, reject) {
      ExerciseModel.findByIdAndUpdate(
        id, 
        exerciseData, 
        { new: true },
        function (err, exercise) {
          if (err) reject('Erro ao atualizar exercício');
          if (!exercise) reject('Exercício não encontrado');
          resolve(exercise);
        }
      );
    });
  }

  function deleteExercise(id) {
    return new Promise(function (resolve, reject) {
      ExerciseModel.findByIdAndDelete(id, function (err, exercise) {
        if (err) reject('Erro ao deletar exercício');
        if (!exercise) reject('Exercício não encontrado');
        resolve(exercise);
      });
    });
  }

  function findByTrainer(trainerId) {
    return new Promise(function (resolve, reject) {
      ExerciseModel.find({ createdBy: trainerId })
        .sort({ name: 1 })
        .exec(function (err, exercises) {
          if (err) reject(err);
          resolve(exercises);
        });
    });
  }

  return service;
}

module.exports = ExercisesService;
