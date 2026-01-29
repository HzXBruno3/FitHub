let mongoose = require("mongoose");
let Schema = mongoose.Schema;

// Schema para mensagens do chat
let MessageSchema = new Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  isAlert: { type: Boolean, default: false }, // Se é um alerta sobre falta de treino
  createdAt: { type: Date, default: Date.now }
});

let Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
