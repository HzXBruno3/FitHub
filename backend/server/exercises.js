const bodyParser = require("body-parser");
const express = require("express");
const Exercises = require("../data/exercises");
const scopes = require("../data/users/scopes");
const Users = require("../data/users");
const VerifyToken = require("../middleware/Token");

const ExercisesRouter = () => {
  let router = express.Router();

  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
  router.use(VerifyToken);

  /**
   * @swagger
   * tags:
   *   name: Exercises
   *   description: Gestão de exercícios
   */

  router
    .route("/")
    /**
     * @swagger
     * /exercises:
     *   post:
     *     summary: Criar exercício
     *     tags: [Exercises]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/Exercise'
     *     responses:
     *       201:
     *         description: Exercício criado
     *       401:
     *         description: Não autorizado
     *       500:
     *         description: Erro no servidor
     */
    .post(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      const trainerId = req.userId;
      const exerciseData = { ...req.body, createdBy: trainerId };

      Exercises.create(exerciseData)
        .then((exercise) => {
          res.status(201).send({ success: true, data: exercise });
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
     * /exercises:
     *   get:
     *     summary: Listar exercícios
     *     tags: [Exercises]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: muscleGroup
     *         schema:
     *           type: string
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Lista de exercícios
     *       500:
     *         description: Erro no servidor
     */
    .get(Users.autorize([scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      const { muscleGroup, search } = req.query;
      let query = {};

      if (muscleGroup) {
        query.muscleGroup = muscleGroup;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      Exercises.findAll(query)
        .then((exercises) => {
          res.status(200).send({ success: true, data: exercises });
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
   * /exercises/{id}:
   *   get:
   *     summary: Obter exercício por ID
   *     tags: [Exercises]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Exercício encontrado
   *       404:
   *         description: Exercício não encontrado
   */
  router.route("/:id").get(function (req, res, next) {
    Exercises.findById(req.params.id)
      .then((exercise) => {
        res.status(200).send({ success: true, data: exercise });
        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(404).send({ error: err.message || err });
        next();
      });
  });

  /**
   * @swagger
   * /exercises/{id}:
   *   put:
   *     summary: Atualizar exercício
   *     tags: [Exercises]
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
   *             $ref: '#/components/schemas/Exercise'
   *     responses:
   *       200:
   *         description: Exercício atualizado
   *       404:
   *         description: Exercício não encontrado
   */
  router
    .route("/:id")
    .put(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      Exercises.update(req.params.id, req.body)
        .then((exercise) => {
          res.status(200).send({ success: true, data: exercise });
          next();
        })
        .catch((err) => {
          console.error(err);
          res.status(404).send({ error: err.message || err });
          next();
        });
    });

  /**
   * @swagger
   * /exercises/{id}:
   *   delete:
   *     summary: Apagar exercício
   *     tags: [Exercises]
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
   *         description: Exercício apagado
   *       404:
   *         description: Exercício não encontrado
   */
  router
    .route("/:id")
    .delete(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      Exercises.deleteExercise(req.params.id)
        .then((exercise) => {
          res.status(200).send({ success: true, message: "Exercício deletado" });
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

module.exports = ExercisesRouter;
