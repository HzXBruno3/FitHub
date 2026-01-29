let mongoose = require("mongoose");
let Schema = mongoose.Schema;

// Schema para exercício individual
let ExerciseSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String }, // Link para vídeo de demonstração
  instructions: { type: String }, // Instruções escritas
  muscleGroup: { type: String }, // Grupo muscular trabalhado
  equipment: { type: String }, // Equipamento necessário
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Personal trainer que criou
  createdAt: { type: Date, default: Date.now }
});

let Exercise = mongoose.model("Exercise", ExerciseSchema);

module.exports = Exercise;
