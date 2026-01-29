function MessagesService(MessageModel) {
  let service = {
    create,
    findConversation,
    findConversations,
    markAsRead,
    deleteMessage,
  };

  function create(messageData) {
    return new Promise(function (resolve, reject) {
      const newMessage = new MessageModel(messageData);
      newMessage.save(function (err, message) {
        if (err) {
          console.error('Erro ao criar mensagem:', err);
          reject("Erro ao enviar mensagem");
        }
        resolve(message);
      });
    });
  }

  function findConversation(userId1, userId2) {
    return new Promise(function (resolve, reject) {
      MessageModel.find({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      })
        .populate("senderId", "name email profileImage")
        .populate("receiverId", "name email profileImage")
        .sort({ createdAt: 1 })
        .exec(function (err, messages) {
          if (err) reject(err);
          resolve(messages);
        });
    });
  }

  function findConversations(userId) {
    return new Promise(function (resolve, reject) {
      MessageModel.find({
        $or: [{ senderId: userId }, { receiverId: userId }],
      })
        .populate("senderId", "name email profileImage")
        .populate("receiverId", "name email profileImage")
        .sort({ createdAt: -1 })
        .exec(function (err, messages) {
          if (err) reject(err);
          resolve(messages);
        });
    });
  }

  function markAsRead(senderId, receiverId) {
    return new Promise(function (resolve, reject) {
      MessageModel.updateMany(
        { senderId: senderId, receiverId: receiverId, isRead: false },
        { isRead: true },
        function (err, result) {
          if (err) reject('Erro ao marcar mensagens como lidas');
          resolve(result);
        }
      );
    });
  }

  function deleteMessage(id) {
    return new Promise(function (resolve, reject) {
      MessageModel.findByIdAndDelete(id, function (err, message) {
        if (err) reject('Erro ao deletar mensagem');
        if (!message) reject('Mensagem não encontrada');
        resolve(message);
      });
    });
  }

  return service;
}

module.exports = MessagesService;
