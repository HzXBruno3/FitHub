function WorkoutsService(WorkoutPlanModel, WorkoutCompletionModel) {
  let service = {
    createPlan,
    updatePlan,
    findPlanById,
    findPlans,
    deletePlan,
    createCompletion,
    findCompletions,
    getStats,
    getDetailedStats,
  };

  function createPlan(planData) {
    return new Promise(function (resolve, reject) {
      const newPlan = new WorkoutPlanModel(planData);
      newPlan.save(function (err, plan) {
        if (err) {
          console.error('Erro ao criar plano:', err);
          reject("Erro ao criar plano de treino");
        }
        resolve(plan);
      });
    });
  }

  function updatePlan(id, planData) {
    return new Promise(function (resolve, reject) {
      WorkoutPlanModel.findByIdAndUpdate(
        id, 
        { ...planData, updatedAt: Date.now() }, 
        { new: true },
        function (err, plan) {
          if (err) reject('Erro ao atualizar plano');
          if (!plan) reject('Plano não encontrado');
          resolve(plan);
        }
      );
    });
  }

  function findPlanById(id) {
    return new Promise(function (resolve, reject) {
      WorkoutPlanModel.findById(id)
        .populate("clientId", "name email")
        .populate("trainerId", "name email")
        .populate("weeklySchedule.exercises.exercise")
        .exec(function (err, plan) {
          if (err) reject(err);
          if (!plan) reject('Plano não encontrado');
          resolve(plan);
        });
    });
  }

  function findPlans(query) {
    return new Promise(function (resolve, reject) {
      WorkoutPlanModel.find(query)
        .populate("clientId", "name email")
        .populate("trainerId", "name email")
        .populate("weeklySchedule.exercises.exercise", "name description videoUrl instructions muscleGroup equipment difficulty")
        .sort({ createdAt: -1 })
        .exec(function (err, plans) {
          if (err) reject(err);
          resolve(plans);
        });
    });
  }

  function deletePlan(id) {
    return new Promise(function (resolve, reject) {
      WorkoutPlanModel.findByIdAndDelete(id, function (err, plan) {
        if (err) reject('Erro ao deletar plano');
        if (!plan) reject('Plano não encontrado');
        resolve(plan);
      });
    });
  }

  function createCompletion(completionData) {
    return new Promise(function (resolve, reject) {
      // Verificar se já existe um registo para esta data e plano
      const dateOnly = new Date(completionData.date);
      dateOnly.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateOnly);
      nextDay.setDate(nextDay.getDate() + 1);

      WorkoutCompletionModel.findOne({
        workoutPlanId: completionData.workoutPlanId,
        clientId: completionData.clientId,
        date: { $gte: dateOnly, $lt: nextDay }
      })
      .exec(function (err, existingCompletion) {
        if (err) {
          console.error('Erro ao verificar registo existente:', err);
          reject("Erro ao verificar registo");
          return;
        }

        if (existingCompletion) {
          // Atualizar registo existente
          existingCompletion.completed = completionData.completed;
          existingCompletion.missedReason = completionData.missedReason;
          existingCompletion.notes = completionData.notes;
          existingCompletion.dayOfWeek = completionData.dayOfWeek;
          
          existingCompletion.save(function (err, updated) {
            if (err) {
              console.error('Erro ao atualizar registo:', err);
              reject("Erro ao atualizar registo");
            }
            resolve(updated);
          });
        } else {
          // Criar novo registo
          const newCompletion = new WorkoutCompletionModel(completionData);
          newCompletion.save(function (err, completion) {
            if (err) {
              console.error('Erro ao registrar cumprimento:', err);
              reject("Erro ao registrar cumprimento");
            }
            resolve(completion);
          });
        }
      });
    });
  }

  function findCompletions(query) {
    return new Promise(function (resolve, reject) {
      WorkoutCompletionModel.find(query)
        .populate("workoutPlanId")
        .sort({ date: -1 })
        .exec(function (err, completions) {
          if (err) reject(err);
          resolve(completions);
        });
    });
  }

  function getStats(clientId, startDate, endDate) {
    return new Promise(function (resolve, reject) {
      WorkoutCompletionModel.find({
        clientId: clientId,
        date: { $gte: startDate, $lte: endDate }
      })
      .exec(function (err, completions) {
        if (err) reject(err);
        
        const totalWorkouts = completions.length;
        const completedWorkouts = completions.filter(c => c.completed).length;
        const missedWorkouts = totalWorkouts - completedWorkouts;
        const completionRate = totalWorkouts > 0 
          ? ((completedWorkouts / totalWorkouts) * 100).toFixed(1) 
          : 0;

        resolve({
          totalWorkouts,
          completedWorkouts,
          missedWorkouts,
          completionRate,
        });
      });
    });
  }

  function getDetailedStats(clientId, period, startDate, endDate) {
    return new Promise(function (resolve, reject) {
      WorkoutCompletionModel.find({
        clientId: clientId,
        date: { $gte: startDate, $lte: endDate }
      })
      .sort({ date: 1 })
      .exec(function (err, completions) {
        if (err) {
          console.error('Error fetching detailed stats:', err);
          reject(err);
          return;
        }
        
        // Estatísticas gerais
        const totalWorkouts = completions.length;
        const completedWorkouts = completions.filter(c => c.completed).length;
        const missedWorkouts = totalWorkouts - completedWorkouts;
        const completionRate = totalWorkouts > 0 
          ? parseFloat(((completedWorkouts / totalWorkouts) * 100).toFixed(1))
          : 0;

        // Agrupar dados por período (semana ou mês)
        const groupedData = {};
        
        completions.forEach(completion => {
          const date = new Date(completion.date);
          let key;
          
          if (period === 'week') {
            // Obter número da semana no ano
            const onejan = new Date(date.getFullYear(), 0, 1);
            const weekNumber = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
            key = `Semana ${weekNumber}`;
          } else {
            // Agrupar por mês
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            key = `${months[date.getMonth()]} ${date.getFullYear()}`;
          }
          
          if (!groupedData[key]) {
            groupedData[key] = {
              period: key,
              completed: 0,
              missed: 0,
              total: 0,
            };
          }
          
          groupedData[key].total++;
          if (completion.completed) {
            groupedData[key].completed++;
          } else {
            groupedData[key].missed++;
          }
        });

        // Converter para array e calcular taxa de conclusão
        const chartData = Object.values(groupedData).map(item => ({
          ...item,
          completionRate: item.total > 0 
            ? parseFloat(((item.completed / item.total) * 100).toFixed(1))
            : 0
        }));

        resolve({
          overview: {
            totalWorkouts,
            completedWorkouts,
            missedWorkouts,
            completionRate,
          },
          chartData,
        });
      });
    });
  }

  return service;
}

module.exports = WorkoutsService;
