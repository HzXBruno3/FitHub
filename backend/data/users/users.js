let mongoose = require("mongoose");
let scopes = require("./scopes");

let Schema = mongoose.Schema;

let RoleSchema = new Schema({
  name: { type: String, required: true },
  scope: [
    {
      type: String,
      enum: [scopes.Admin, scopes.PersonalTrainer, scopes.Client],
    },
  ],
});

// create a schema
let UserSchema = new Schema({
  name: { type: String, required: true},
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: RoleSchema },
  birthDate: { type: Date },
  phone: { type: String },
  country: { type: String },
  address: { type: String },
  profileImage: { type: String },
  // Para clientes: referência ao personal trainer atribuído
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Para personal trainers: se está validado pelo admin
  isValidated: { type: Boolean, default: false },
  // Histórico de treinos (para estatísticas)
  trainingHistory: [{
    date: { type: Date },
    completed: { type: Boolean },
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// the schema is useless so far
// we need to create a model using it
let User = mongoose.model("User", UserSchema);

// make this available to our users in our Node applications
module.exports = User;
