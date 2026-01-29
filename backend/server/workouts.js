const bodyParser = require("body-parser");
const express = require("express");
const Workouts = require("../data/workouts");
const scopes = require("../data/users/scopes");
const Users = require("../data/users");
const VerifyToken = require("../middleware/Token");
const multer = require("multer");
const path = require("path");

// Configuração do multer para upload de imagens de comprovação
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/proofs/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const WorkoutsRouter = (io) => {
  let router = express.Router();

  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
  router.use(VerifyToken);

  /**
   * @swagger
   * tags:
   *   name: Workouts
   *   description: Planos de treino e registos
   */

  // ========== ROTAS PARA PLANOS DE TREINO ==========

  // Obter planos do trainer
  router
    .route("/trainer-plans")
    /**
     * @swagger
     * /workouts/trainer-plans:
     *   get:
     *     summary: Listar planos do personal trainer autenticado
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Lista de planos
     *       500:
     *         description: Erro no servidor
     */
    .get(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      const trainerId = req.userId;
      
      Workouts.findPlans({ trainerId })
        .then((plans) => {
          res.status(200).send({ success: true, data: plans || [] });
          next();
        })
        .catch((err) => {
          console.error("Error fetching trainer plans:", err);
          res.status(500).send({ success: false, error: err.message || "Error fetching plans" });
          next();
        });
    });

  // Obter planos de um cliente específico
  router
    .route("/client/:clientId")
    /**
     * @swagger
     * /workouts/client/{clientId}:
     *   get:
     *     summary: Listar planos de um cliente
     *     tags: [Workouts]
     *     parameters:
     *       - in: path
     *         name: clientId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Lista de planos
     *       500:
     *         description: Erro no servidor
     */
    .get(function (req, res, next) {
      const clientId = req.params.clientId;
      
      Workouts.findPlans({ clientId })
        .then((plans) => {
          res.status(200).send({ success: true, data: plans || [] });
          next();
        })
        .catch((err) => {
          console.error("Error fetching client plans:", err);
          res.status(500).send({ success: false, error: err.message || "Error fetching plans" });
          next();
        });
    });

  // Criar novo plano de treino (Personal Trainer)
  router
    .route("/plans")
    /**
     * @swagger
     * /workouts/plans:
     *   post:
     *     summary: Criar novo plano de treino
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/WorkoutPlan'
     *     responses:
     *       201:
     *         description: Plano criado
     *       500:
     *         description: Erro no servidor
     */
    .post(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      const trainerId = req.userId;
      const planData = { ...req.body, trainerId };
      // Validações de plano: dias conforme frequência e até 10 exercícios por dia
      try {
        const frequency = Number(planData.frequency);
        const schedule = Array.isArray(planData.weeklySchedule) ? planData.weeklySchedule : [];

        const daySet = new Set();
        for (const day of schedule) {
          if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
            return res.status(400).send({ success: false, error: 'dayOfWeek deve estar entre 0 e 6' });
          }
          if (daySet.has(day.dayOfWeek)) {
            return res.status(400).send({ success: false, error: 'weeklySchedule não pode ter dias repetidos' });
          }
          daySet.add(day.dayOfWeek);
          const exercises = Array.isArray(day.exercises) ? day.exercises : [];
          if (exercises.length > 10) {
            return res.status(400).send({ success: false, error: 'Cada dia pode ter no máximo 10 exercícios' });
          }
        }

        if (Number.isInteger(frequency) && daySet.size !== frequency) {
          return res.status(400).send({ success: false, error: `weeklySchedule deve conter exatamente ${frequency} dias distintos.` });
        }

        // Se o cliente indicou dias disponíveis, restringir aos dias informados
        if (Array.isArray(planData.availableDays) && planData.availableDays.length > 0) {
          const allowed = new Set(planData.availableDays.map(Number));
          for (const d of daySet) {
            if (!allowed.has(d)) {
              return res.status(400).send({ success: false, error: 'Dias agendados devem estar dentro dos dias disponíveis do cliente' });
            }
          }
        }
      } catch (e) {
        return res.status(400).send({ success: false, error: 'Dados de plano inválidos' });
      }
      
      Workouts.createPlan(planData)
        .then((workoutPlan) => {
          // Notificar o cliente
          io.to(planData.clientId).emit("new_workout_plan", {
            message: "Novo plano de treino atribuído!",
            planId: workoutPlan._id,
          });

          res.status(201).send({ success: true, data: workoutPlan });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send({ error: err.message || err });
          next();
        });
    })
    /**
     * @swagger
     * /workouts/plans:
     *   get:
     *     summary: Listar planos de treino
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: clientId
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Lista de planos
     *       500:
     *         description: Erro no servidor
     */
    .get(function (req, res, next) {
      const userId = req.userId;
      const userRole = req.roleUser.role[0];
      
      let query = {};
      
      if (userRole === scopes.Client) {
        query.clientId = userId;
      } else if (userRole === scopes.PersonalTrainer) {
        query.trainerId = userId;
        if (req.query.clientId) {
          query.clientId = req.query.clientId;
        }
      }

      Workouts.findPlans(query)
        .then((plans) => {
          res.status(200).send({ success: true, data: plans });
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
   * /workouts/plans/{id}:
   *   get:
   *     summary: Obter plano de treino por ID
   *     tags: [Workouts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Plano encontrado
   *       404:
   *         description: Plano não encontrado
   */
  router.route("/plans/:id").get(function (req, res, next) {
    Workouts.findPlanById(req.params.id)
      .then((plan) => {
        res.status(200).send({ success: true, data: plan });
        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(404).send({ error: err.message || err });
        next();
      });
  });

  // Atualizar plano de treino (Personal Trainer)
  router
    .route("/plans/:id")
    /**
     * @swagger
     * /workouts/plans/{id}:
     *   put:
     *     summary: Atualizar plano de treino
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
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
     *             $ref: '#/components/schemas/WorkoutPlan'
     *     responses:
     *       200:
     *         description: Plano atualizado
     *       404:
     *         description: Plano não encontrado
     */
    .put(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      const body = req.body || {};
      // Validações para atualização
      try {
        const frequency = body.frequency !== undefined ? Number(body.frequency) : undefined;
        const schedule = Array.isArray(body.weeklySchedule) ? body.weeklySchedule : undefined;

        if (schedule) {
          const daySet = new Set();
          for (const day of schedule) {
            if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
              return res.status(400).send({ success: false, error: 'dayOfWeek deve estar entre 0 e 6' });
            }
            if (daySet.has(day.dayOfWeek)) {
              return res.status(400).send({ success: false, error: 'weeklySchedule não pode ter dias repetidos' });
            }
            daySet.add(day.dayOfWeek);
            const exercises = Array.isArray(day.exercises) ? day.exercises : [];
            if (exercises.length > 10) {
              return res.status(400).send({ success: false, error: 'Cada dia pode ter no máximo 10 exercícios' });
            }
          }

          if (typeof frequency === 'number' && Number.isInteger(frequency) && daySet.size !== frequency) {
            return res.status(400).send({ success: false, error: `weeklySchedule deve conter exatamente ${frequency} dias distintos.` });
          }

          // Restringir aos dias disponíveis se informado
          if (Array.isArray(body.availableDays) && body.availableDays.length > 0) {
            const allowed = new Set(body.availableDays.map(Number));
            for (const d of daySet) {
              if (!allowed.has(d)) {
                return res.status(400).send({ success: false, error: 'Dias agendados devem estar dentro dos dias disponíveis do cliente' });
              }
            }
          }
        }
      } catch (e) {
        return res.status(400).send({ success: false, error: 'Dados de plano inválidos' });
      }

      Workouts.updatePlan(req.params.id, body)
        .then((plan) => {
          // Notificar o cliente
          io.to(plan.clientId.toString()).emit("workout_plan_updated", {
            message: "Seu plano de treino foi atualizado!",
            planId: plan._id,
          });

          res.status(200).send({ success: true, data: plan });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(404).send({ error: err.message || err });
          next();
        });
    })
    /**
     * @swagger
     * /workouts/plans/{id}:
     *   delete:
     *     summary: Apagar plano de treino
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Plano apagado com sucesso
     *       404:
     *         description: Plano não encontrado
     */
    .delete(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      Workouts.deletePlan(req.params.id)
        .then(() => {
          res.status(200).send({ success: true, message: "Plano excluído com sucesso" });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(404).send({ success: false, error: err.message || err });
          next();
        });
    });

  // ========== ROTAS PARA REGISTOS DE TREINO (COMPLETIONS) ==========

  // Registar treino (Cliente)
  router
    .route("/completions")
    /**
     * @swagger
     * /workouts/completions:
     *   post:
     *     summary: Registar treino (comprovativo opcional)
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               workoutPlanId:
     *                 type: string
     *               date:
     *                 type: string
     *                 format: date
     *               dayOfWeek:
     *                 type: number
     *                 minimum: 0
     *                 maximum: 6
     *               completed:
     *                 type: boolean
     *               missedReason:
     *                 type: string
     *               proof:
     *                 type: string
     *                 format: binary
     *     responses:
     *       201:
     *         description: Registo criado
     *       500:
     *         description: Erro no servidor
     */
    .post(
      Users.autorize([scopes.Client]),
      upload.single("proof"),
      function (req, res, next) {
        const clientId = req.userId;
        const completionData = {
          ...req.body,
          clientId,
          completed: req.body.completed === "true" || req.body.completed === true,
        };

        if (req.file) {
          completionData.proofImage = req.file.path;
        }

        // Validar que o dia está dentro do plano
        const planId = completionData.workoutPlanId;
        const dayOfWeek = parseInt(completionData.dayOfWeek);
        if (!planId || Number.isNaN(dayOfWeek)) {
          return res.status(400).send({ success: false, error: 'workoutPlanId e dayOfWeek são obrigatórios' });
        }

        Workouts.findPlanById(planId)
          .then((plan) => {
            const allowedDays = new Set((plan.weeklySchedule || []).map(d => d.dayOfWeek));
            if (!allowedDays.has(dayOfWeek)) {
              return res.status(400).send({ success: false, error: 'Registo só permitido nos dias agendados pelo treinador' });
            }

            return Workouts.createCompletion(completionData)
              .then((completion) => {
                // Se não completou, notificar o personal trainer
                if (!completion.completed) {
                  return Promise.all([
                    Workouts.findPlanById(completion.workoutPlanId),
                    Users.findUserById(clientId)
                  ]).then(([plan, client]) => {
                    io.to(plan.trainerId.toString()).emit("workout_missed", {
                      message: `${client.name} faltou ao treino`,
                      reason: completion.missedReason,
                      clientId: clientId,
                      clientName: client.name,
                      clientEmail: client.email,
                      planName: plan.name,
                      date: completion.date,
                      dayOfWeek: completion.dayOfWeek,
                      timestamp: new Date().toISOString(),
                    });
                    return completion;
                  });
                }
                return completion;
              })
              .then((completion) => {
                res.status(201).send({ success: true, data: completion });
                next();
              })
              .catch((err) => {
                console.error(err);
                res.status(500).send({ error: err.message || err });
                next();
              });
          })
          .catch((err) => {
            console.error('Erro ao validar plano para completion:', err);
            res.status(500).send({ error: err.message || err });
            next();
          });
      }
    )
    /**
     * @swagger
     * /workouts/completions:
     *   get:
     *     summary: Listar registos de treino
     *     tags: [Workouts]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: clientId
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Lista de registos
     *       500:
     *         description: Erro no servidor
     */
    .get(function (req, res, next) {
      const userId = req.userId;
      const userRole = req.roleUser.role[0];
      const { clientId, startDate, endDate } = req.query;

      let query = {};

      if (userRole === scopes.Client) {
        query.clientId = userId;
      } else if (userRole === scopes.PersonalTrainer && clientId) {
        query.clientId = clientId;
      }

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      Workouts.findCompletions(query)
        .then((completions) => {
          res.status(200).send({ success: true, data: completions });
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
   * /workouts/stats:
   *   get:
   *     summary: Estatísticas de treino
   *     tags: [Workouts]
   *     security:
   *       - bearerAuth: []
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: clientId
   *         schema:
   *           type: string
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [week, month]
   *     responses:
   *       200:
   *         description: Estatísticas calculadas
   *       400:
   *         description: Parâmetros inválidos
   *       500:
   *         description: Erro no servidor
   */
  router.route("/stats").get(function (req, res, next) {
    const userId = req.userId;
    const userRole = req.roleUser.role[0];
    const { clientId, period } = req.query; // period: 'week' ou 'month'

    let targetClientId = userRole === scopes.Client ? userId : clientId;

    if (!targetClientId) {
      return res.status(400).send({ error: "clientId é necessário" });
    }

    // Calcular data de início baseado no período
    const now = new Date();
    let startDate = new Date();
    
    if (period === "week") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    Workouts.getStats(targetClientId, startDate, now)
      .then((stats) => {
        res.status(200).send({
          success: true,
          data: {
            ...stats,
            period,
          },
        });
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
   * /workouts/detailed-stats:
   *   get:
   *     summary: Estatísticas detalhadas para gráficos
   *     tags: [Workouts]
   *     security:
   *       - bearerAuth: []
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: clientId
   *         schema:
   *           type: string
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [week, month]
   *       - in: query
   *         name: months
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Estatísticas detalhadas
   *       400:
   *         description: Parâmetros inválidos
   *       500:
   *         description: Erro no servidor
   */
  router.route("/detailed-stats").get(function (req, res, next) {
    const userId = req.userId;
    const userRole = req.roleUser.role[0];
    const { clientId, period = 'month', months = 3 } = req.query;

    let targetClientId = userRole === scopes.Client ? userId : clientId;

    if (!targetClientId) {
      return res.status(400).send({ 
        success: false, 
        error: "clientId é necessário para Personal Trainer" 
      });
    }

    // Calcular intervalo de datas baseado no período
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'week') {
      // Últimas X semanas
      const weeks = parseInt(months) || 12;
      startDate.setDate(endDate.getDate() - (weeks * 7));
    } else {
      // Últimos X meses
      const monthsBack = parseInt(months) || 3;
      startDate.setMonth(endDate.getMonth() - monthsBack);
    }

    Workouts.getDetailedStats(targetClientId, period, startDate, endDate)
      .then((stats) => {
        res.status(200).send({
          success: true,
          data: stats,
        });
        next();
      })
      .catch((err) => {
        console.error('Error in detailed-stats route:', err);
        res.status(500).send({ 
          success: false, 
          error: err.message || err 
        });
        next();
      });
  });

  return router;
};

module.exports = WorkoutsRouter;
