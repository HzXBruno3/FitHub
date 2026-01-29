const bodyParser = require("body-parser");
const express = require("express");
const TrainerRequests = require("../data/trainerRequests");
const User = require("../data/users/users");
const scopes = require("../data/users/scopes");
const Users = require("../data/users");
const VerifyToken = require("../middleware/Token");

const TrainerRequestsRouter = (io) => {
  let router = express.Router();

  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
  router.use(VerifyToken);

  /**
   * @swagger
   * tags:
   *   name: TrainerRequests
   *   description: Pedidos de alteração de personal trainer
   */

  // Cliente cria pedido de alteração de trainer
  router
    .route("/")
    /**
     * @swagger
     * /trainer-requests:
     *   post:
     *     summary: Criar pedido de alteração de personal trainer (Cliente)
     *     tags: [TrainerRequests]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/TrainerRequest'
     *     responses:
     *       201:
     *         description: Pedido criado
     *       500:
     *         description: Erro no servidor
     */
    .post(Users.autorize([scopes.Client]), function (req, res, next) {
      const clientId = req.userId;
      const { newTrainerId, reason } = req.body;

      // Obter o trainer atual do cliente
      User.findById(clientId)
        .then((client) => {
          const requestData = {
            clientId,
            currentTrainerId: client.trainerId,
            newTrainerId,
            reason,
          };

          return TrainerRequests.create(requestData);
        })
        .then((request) => {
          // Notificar administradores
          io.emit("new_trainer_request", {
            message: "Novo pedido de alteração de personal trainer",
            requestId: request._id,
          });

          res.status(201).send({ success: true, data: request });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send({ error: err.message || err });
          next();
        });
    });

  // Admin lista todos os pedidos
  /**
   * @swagger
   * /trainer-requests:
   *   get:
   *     summary: Listar pedidos de alteração (Admin)
   *     tags: [TrainerRequests]
   *     security:
   *       - bearerAuth: []
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, rejected]
   *     responses:
   *       200:
   *         description: Lista de pedidos
   *       500:
   *         description: Erro no servidor
   */
  router.route("/").get(Users.autorize([scopes.Admin]), function (req, res, next) {
    const { status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    TrainerRequests.findAll(query)
      .then((requests) => {
        res.status(200).send({ success: true, data: requests });
        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send({ error: err.message || err });
        next();
      });
  });

  // Admin aprova pedido
  router
    .route("/:id/approve")
    /**
     * @swagger
     * /trainer-requests/{id}/approve:
     *   put:
     *     summary: Aprovar pedido (Admin)
     *     tags: [TrainerRequests]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Pedido aprovado
     *       404:
     *         description: Pedido não encontrado
     */
    .put(Users.autorize([scopes.Admin]), function (req, res, next) {
      const adminId = req.userId;

      TrainerRequests.findById(req.params.id)
        .then((request) => {
          if (!request) {
            return res.status(404).send({ success: false, error: "Request not found" });
          }

          return TrainerRequests.updateStatus(req.params.id, "approved", adminId)
            .then((updatedRequest) => {
              // Atualizar o trainer do cliente
              return User.findByIdAndUpdate(request.clientId, {
                trainerId: request.newTrainerId,
              }).then(() => {
                io.emit("trainer_request_approved", {
                  message: "Trainer request approved",
                  clientId: request.clientId,
                });
                res.status(200).send({ success: true, data: updatedRequest });
                next();
              });
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send({ success: false, error: err.message || err });
          next();
        });
    });

  // Admin rejeita pedido
  router
    .route("/:id/reject")
    /**
     * @swagger
     * /trainer-requests/{id}/reject:
     *   put:
     *     summary: Rejeitar pedido (Admin)
     *     tags: [TrainerRequests]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Pedido rejeitado
     *       500:
     *         description: Erro no servidor
     */
    .put(Users.autorize([scopes.Admin]), function (req, res, next) {
      const adminId = req.userId;

      TrainerRequests.updateStatus(req.params.id, "rejected", adminId)
        .then((updatedRequest) => {
          io.emit("trainer_request_rejected", {
            message: "Trainer request rejected",
          });
          res.status(200).send({ success: true, data: updatedRequest });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send({ success: false, error: err.message || err });
          next();
        });
    });

  // Admin aprova ou rejeita pedido (antigo endpoint - mantido para compatibilidade)
  router
    .route("/:id/review")
    /**
     * @swagger
     * /trainer-requests/{id}/review:
     *   put:
     *     summary: Rever pedido (aprovar/rejeitar) (Admin)
     *     tags: [TrainerRequests]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [approved, rejected]
     *     responses:
     *       200:
     *         description: Pedido atualizado
     *       404:
     *         description: Pedido não encontrado
     */
    .put(Users.autorize([scopes.Admin]), function (req, res, next) {
      const adminId = req.userId;
      const { status } = req.body; // 'approved' ou 'rejected'

      TrainerRequests.findById(req.params.id)
        .then((request) => {
          return TrainerRequests.updateStatus(req.params.id, status, adminId)
            .then((updatedRequest) => {
              // Se aprovado, atualizar o trainer do cliente
              if (status === "approved") {
                return User.findByIdAndUpdate(request.clientId, {
                  trainerId: request.newTrainerId,
                }).then(() => {
                  // Notificar o cliente
                  io.to(request.clientId.toString()).emit("trainer_request_approved", {
                    message: "Seu pedido de alteração de personal trainer foi aprovado!",
                  });
                  return updatedRequest;
                });
              } else {
                // Notificar o cliente
                io.to(request.clientId.toString()).emit("trainer_request_rejected", {
                  message: "Seu pedido de alteração de personal trainer foi rejeitado.",
                });
                return updatedRequest;
              }
            });
        })
        .then((request) => {
          res.status(200).send({ success: true, data: request });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(404).send({ error: err.message || err });
          next();
        });
    });

  return router;
};

module.exports = TrainerRequestsRouter;
