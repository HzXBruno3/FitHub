let mongoose = require("mongoose");
let Schema = mongoose.Schema;

// Schema para pedidos de alteração de personal trainer
let TrainerRequestSchema = new Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  currentTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  newTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin que revisou
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

let TrainerRequest = mongoose.model("TrainerRequest", TrainerRequestSchema);

module.exports = TrainerRequest;
