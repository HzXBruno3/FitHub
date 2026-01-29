const bodyParser = require("body-parser");
const express = require("express");
const Messages = require("../data/messages");
const scopes = require("../data/users/scopes");
const Users = require("../data/users");
const VerifyToken = require("../middleware/Token");

const MessagesRouter = (io) => {
  let router = express.Router();

  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
  router.use(VerifyToken);

  /**
   * @swagger
   * tags:
   *   name: Messages
   *   description: Mensagens entre utilizadores
   */

  // Enviar mensagem
  router.route("/").post(function (req, res, next) {
      /**
       * @swagger
       * /messages:
       *   post:
       *     summary: Enviar mensagem
       *     tags: [Messages]
       *     security:
       *       - bearerAuth: []
       *       - cookieAuth: []
       *     requestBody:
       *       required: true
       *       content:
       *         application/json:
       *           schema:
       *             $ref: '#/components/schemas/Message'
       *     responses:
       *       201:
       *         description: Mensagem criada
       *       500:
       *         description: Erro no servidor
       */
    const senderId = req.userId;
    const { receiverId, content } = req.body;

    console.log("📨 Sending message from:", senderId, "to:", receiverId);

    const messageData = {
      senderId: senderId,
      receiverId: receiverId,
      content,
    };

    Messages.create(messageData)
      .then((message) => {
        console.log("✅ Message created:", message._id);
        
        // Buscar dados completos do remetente e receptor para a notificação
        return Promise.all([
          message,
          Users.findUserById(senderId),
          Users.findUserById(receiverId)
        ]);
      })
      .then(([message, sender, receiver]) => {
        
        // Enviar notificação em tempo real para o receptor
        io.to(receiverId).emit("newMessage", {
          ...message.toObject(),
          senderId: sender,
          receiverId: receiver
        });
        
        // Emitir evento de notificação toast apenas para o receptor
        io.to(receiverId).emit("messageNotification", {
          messageId: message._id,
          senderName: sender.name,
          senderId: senderId,
          content: message.content,
          timestamp: message.createdAt,
        });
        
        // Enviar mensagem também para o remetente (atualizar chat)
        io.to(senderId).emit("newMessage", {
          ...message.toObject(),
          senderId: sender,
          receiverId: receiver
        });

        res.status(201).send({ success: true, data: message });
      })
      .catch((err) => {
        console.error("❌ Error creating message:", err);
        res.status(500).send({ error: err.message || err });
      });
  });

  /**
   * @swagger
   * /messages/{userId}:
   *   get:
   *     summary: Obter conversação com utilizador
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Lista de mensagens
   *       500:
   *         description: Erro no servidor
   */
  router.route("/:userId").get(function (req, res, next) {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    console.log("📥 Fetching conversation:", currentUserId, "<->", otherUserId);

    Messages.findConversation(currentUserId, otherUserId)
      .then((messages) => {
        // Já vem ordenado por createdAt ASC a partir do service
        console.log("✅ Found", messages.length, "messages (sorted ASC)");
        res.status(200).send({ success: true, data: messages });
      })
      .catch((err) => {
        console.error("❌ Error fetching conversation:", err);
        res.status(500).send({ error: err.message || err });
      });
  });

  /**
   * @swagger
   * /messages/conversations:
   *   get:
   *     summary: Listar conversas do utilizador autenticado
   *     tags: [Messages]
   *     security:
   *       - bearerAuth: []
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Conversas agregadas
   *       500:
   *         description: Erro no servidor
   */
  router.route("/conversations").get(function (req, res, next) {
    const userId = req.userId;

    console.log("📋 Fetching conversations for:", userId);

    Messages.findConversations(userId)
      .then((messages) => {
        // Agrupar por conversas únicas
        const conversationsMap = new Map();

        messages.forEach((msg) => {
          const otherId =
            msg.senderId._id.toString() === userId
              ? msg.receiverId._id.toString()
              : msg.senderId._id.toString();

          if (!conversationsMap.has(otherId)) {
            const otherUser =
              msg.senderId._id.toString() === userId ? msg.receiverId : msg.senderId;

            conversationsMap.set(otherId, {
              user: otherUser,
              lastMessage: msg,
              unreadCount: 0,
            });
          }

          // Contar mensagens não lidas
          if (
            msg.receiverId._id.toString() === userId &&
            !msg.isRead
          ) {
            conversationsMap.get(otherId).unreadCount++;
          }
        });

        const conversations = Array.from(conversationsMap.values());
        console.log("✅ Found", conversations.length, "conversations");

        res.status(200).send({ success: true, data: conversations });
      })
      .catch((err) => {
        console.error("❌ Error fetching conversations:", err);
        res.status(500).send({ error: err.message || err });
      });
  });

  /**
   * @swagger
   * /messages/read/{userId}:
   *   put:
   *     summary: Marcar mensagens com utilizador como lidas
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Mensagens marcadas como lidas
   *       500:
   *         description: Erro no servidor
   */
  router.route("/read/:userId").put(function (req, res, next) {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    Messages.markAsRead(otherUserId, currentUserId)
      .then(() => {
        res.status(200).send({ success: true, message: "Mensagens marcadas como lidas" });
        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send({ error: err.message || err });
        next();
      });
  });

  /**
   * @swagger
   * /messages/alert:
   *   post:
   *     summary: Enviar alerta de falta de treino
   *     tags: [Messages]
   *     security:
   *       - bearerAuth: []
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               clientId:
   *                 type: string
   *               message:
   *                 type: string
   *             required:
   *               - clientId
   *               - message
   *     responses:
   *       201:
   *         description: Alerta enviado
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro no servidor
   */
  router.route("/alert").post(
    Users.autorize([scopes.PersonalTrainer]),
    function (req, res, next) {
      const trainerId = req.userId;
      const { clientId, message } = req.body;

      if (!clientId || !message) {
        return res.status(400).send({ 
          success: false, 
          error: "clientId e message são obrigatórios" 
        });
      }

      const alertMessage = {
        senderId: trainerId,
        receiverId: clientId,
        content: `⚠️ ALERTA: ${message}`,
        isAlert: true,
      };

      Messages.create(alertMessage)
        .then((msg) => {
          // Buscar dados do trainer e do cliente
          return Promise.all([
            msg,
            Users.findUserById(trainerId),
            Users.findUserById(clientId)
          ]);
        })
        .then(([msg, trainer, client]) => {
          
          // Enviar notificação em tempo real
          io.to(clientId).emit("newMessage", {
            ...msg.toObject(),
            senderId: trainer,
            receiverId: client
          });
          
          // Enviar notificação de alerta especial
          io.to(clientId).emit("alertNotification", {
            messageId: msg._id,
            trainerName: trainer.name,
            trainerId: trainerId,
            content: message,
            timestamp: msg.createdAt,
          });
          
          res.status(201).send({ success: true, data: msg });
        })
        .catch((err) => {
          console.error("❌ Error sending alert:", err);
          res.status(500).send({ 
            success: false, 
            error: err.message || err 
          });
        });
    }
  );

  return router;
};

module.exports = MessagesRouter;