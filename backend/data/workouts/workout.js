let mongoose = require("mongoose");
let Schema = mongoose.Schema;

// Schema para um exercício dentro de um treino (com séries e repetições)
let WorkoutExerciseSchema = new Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
  sets: { type: Number, required: true }, // Número de séries
  reps: { type: String, required: true }, // Repetições (pode ser "10-12" ou "30 segundos")
  rest: { type: String }, // Tempo de descanso entre séries
  notes: { type: String } // Notas específicas para este exercício no treino
});

// Schema para um dia de treino
let DayWorkoutSchema = new Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Domingo, 6 = Sábado
  exercises: { type: [WorkoutExerciseSchema], validate: [arrayLimit, '{PATH} exceeds the limit of 10'] }
});

function arrayLimit(val) {
  return val.length <= 10;
}

// Schema principal do plano de treino
let WorkoutPlanSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  frequency: { type: Number, required: true, enum: [3, 4, 5] }, // 3, 4 ou 5 vezes por semana
  weeklySchedule: [DayWorkoutSchema], // Treinos por dia da semana
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Schema para registro de cumprimento de treino
let WorkoutCompletionSchema = new Schema({
  workoutPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkoutPlan", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  dayOfWeek: { type: Number, required: true },
  completed: { type: Boolean, required: true },
  missedReason: { type: String }, // Motivo caso não tenha cumprido
  proofImage: { type: String }, // Caminho para imagem de comprovação
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

let WorkoutPlan = mongoose.model("WorkoutPlan", WorkoutPlanSchema);
let WorkoutCompletion = mongoose.model("WorkoutCompletion", WorkoutCompletionSchema);

module.exports = {
  WorkoutPlan,
  WorkoutCompletion
};
