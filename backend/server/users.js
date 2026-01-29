const bodyParser = require("body-parser");
const express = require("express");
const Users = require("../data/users");
const scopes = require("../data/users/scopes");
const VerifyToken = require("../middleware/Token");
const cookieParser = require("cookie-parser");
const User = require("../data/users/users");
const multer = require("multer");

// Configuração do multer para upload de fotos de perfil
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/profiles/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const UsersRouter = (io) => {
  let router = express.Router();

  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
  router.use(cookieParser());
  router.use(VerifyToken);

  /**
   * @swagger
   * tags:
   *   name: Users
   *   description: Gestão de utilizadores
   */

  router
    .route("/me")
    /**
     * @swagger
     * /users/me:
     *   get:
     *     summary: Obter o utilizador autenticado
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Utilizador encontrado
     *       500:
     *         description: Erro no servidor
     */
    .get(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      const userId = req.userId;
      Users.findUserById(userId)
        .then((user) => {
          res.status(200).send({ success: true, data: user });
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
        });
    });

  router
    .route("/me/change-password")
    /**
     * @swagger
     * /users/me/change-password:
     *   post:
     *     summary: Alterar password do utilizador autenticado
     *     tags: [Users]
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
     *               oldPassword:
     *                 type: string
     *               newPassword:
     *                 type: string
     *             required:
     *               - oldPassword
     *               - newPassword
     *     responses:
     *       200:
     *         description: Password alterada
     *       400:
     *         description: Dados inválidos
     */
    .post(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      const userId = req.userId;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).send({ success: false, error: "oldPassword e newPassword são obrigatórios" });
      }

      Users.changePassword(userId, oldPassword, newPassword)
        .then(() => {
          res.status(200).send({ success: true, message: "Password alterada com sucesso" });
        })
        .catch((err) => {
          res.status(400).send({ success: false, error: err.message || err });
        });
    });

  router
    .route("/trainer/clients")
    /**
     * @swagger
     * /users/trainer/clients:
     *   get:
     *     summary: Listar clientes do personal trainer autenticado
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Lista de clientes
     *       500:
     *         description: Erro no servidor
     */
    .get(Users.autorize([scopes.PersonalTrainer]), function (req, res, next) {
      const trainerId = req.userId;
      
      User.find({ trainerId: trainerId })
        .then((clients) => {
          res.status(200).send({ success: true, data: clients });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  router
    .route("/")
    /**
     * @swagger
     * /users:
     *   get:
     *     summary: Listar utilizadores com paginação
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *       - in: query
     *         name: skip
     *         schema:
     *           type: integer
     *       - in: query
     *         name: sort
     *         schema:
     *           type: string
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: role
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Lista de utilizadores
     *       500:
     *         description: Erro no servidor
     */
    .get(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      const pageLimit = req.query.limit ? parseInt(req.query.limit) : 10;
      const pageSkip = req.query.skip ? pageLimit * parseInt(req.query.skip) : 0;
      const sort = req.query.sort; // ex: name,-createdAt
      const search = req.query.search;
      const role = req.query.role;

      const pagination = {
        limit: pageLimit,
        skip: pageSkip,
        sort,
        search,
        role
      };

      Users.findAll(pagination)
        .then((users) => {
          res.status(200).send({ success: true, ...users });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  router
    .route("/all-users")
    /**
     * @swagger
     * /users/all-users:
     *   get:
     *     summary: Listar todos os utilizadores (simplificado)
     *     tags: [Users]
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *       - in: query
     *         name: skip
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Lista de utilizadores
     */
    .get(function (req, res, next) {
      const pageLimit = req.query.limit ? parseInt(req.query.limit) : 5;
      const pageSkip = req.query.skip ? pageLimit * parseInt(req.query.skip) : 0;
      req.pagination = {
        limit: pageLimit,
        skip: pageSkip,
      };

      Users.findAll(req.pagination)
        .then((users) => {
          const response = {
            auth: true,
            users: users.data,
            pagination: {
              pageSize: pageLimit,
              total: users.length,
            },
          };
          res.send(response);
          next();
        })
        .catch((err) => {
          console.log(err.message);
          next();
        });
    })

  router
    .route("/create-user")
    /**
     * @swagger
     * /users/create-user:
     *   post:
     *     summary: Criar utilizador (Admin cria PT, PT cria Cliente)
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/User'
     *     responses:
     *       200:
     *         description: Utilizador criado
     *       401:
     *         description: Não autorizado
     *       400:
     *         description: Dados inválidos
     */
    .post(Users.autorize([scopes.Admin, scopes.PersonalTrainer]), function (req, res, next) {
      console.log("Create user");
      let body = req.body;
      let { role } = body;
      const userRole = req.roleUser.role[0];

      if (!role || !role.scope) {
        return res.status(400).send({ error: "Missing 'role' or 'role.scope' in request body" });
      }

      // Admin pode criar Personal Trainers
      // Personal Trainer pode criar Clientes
      if (userRole === scopes.Admin) {
        if (!role.scope.includes(scopes.PersonalTrainer)) {
          return res.status(401).send({ auth: false, message: 'Admin só pode criar Personal Trainers' });
        }
        body.isValidated = false;
      } else if (userRole === scopes.PersonalTrainer) {
        if (!role.scope.includes(scopes.Client)) {
          return res.status(401).send({ auth: false, message: 'Personal Trainer só pode criar Clientes' });
        }
        body.trainerId = req.userId; // Cliente automaticamente associado ao trainer que criou
        body.isValidated = true;
      }

      Users.create(body)
        .then((user) => {
          io.sockets.emit('admin_notifications', {
            message: 'add new user',
            key: 'User'
          });
          console.log("Created!");
          res.status(200);
          res.send(user);
          next();
        })
        .catch((err) => {
          res.status(404);
          next();
        });
    });


  router
    .route("/:userId")
    /**
     * @swagger
     * /users/{userId}:
     *   get:
     *     summary: Obter utilizador por ID
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Utilizador encontrado
     *       404:
     *         description: Não encontrado
     */
    .get(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), async function (req, res, next) {
      const userId = req.params.userId;
      try {
        const user = await Users.findUserById(userId);
        // Populate trainerId para retornar nome e email
        if (user && user.trainerId) {
          await user.populate('trainerId', 'name email');
        }
        res.status(200).send({ success: true, data: user });
        next();
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
        next();
      }
    })
    .put(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      /**
       * @swagger
       * /users/{userId}:
       *   put:
       *     summary: Atualizar utilizador por ID
       *     tags: [Users]
       *     parameters:
       *       - in: path
       *         name: userId
       *         required: true
       *         schema:
       *           type: string
       *     requestBody:
       *       required: true
       *       content:
       *         application/json:
       *           schema:
       *             $ref: '#/components/schemas/User'
       *     responses:
       *       200:
       *         description: Utilizador atualizado
       *       403:
       *         description: Proibido
       *       500:
       *         description: Erro
       */
      console.log("update a user by id");
      let userId = req.params.userId;
      let body = req.body;
      
      // Usuário só pode editar seu próprio perfil, exceto Admin
      const userRole = req.roleUser.role[0];
      if (userRole !== scopes.Admin && req.userId !== userId) {
        return res.status(403).send({ success: false, error: "Você só pode editar seu próprio perfil" });
      }

      Users.update(userId, body)
        .then((user) => {
          res.status(200).send({ success: true, data: user });
          next();
        })
        .catch((err) => {
          console.log('Update user error', err);
          res.status(500).send({ success: false, error: err.toString() });
        });
    })
    .delete(Users.autorize([scopes.Admin]), function (req, res, next) {
      /**
       * @swagger
       * /users/{userId}:
       *   delete:
       *     summary: Apagar utilizador por ID (apenas Admin)
       *     tags: [Users]
       *     parameters:
       *       - in: path
       *         name: userId
       *         required: true
       *         schema:
       *           type: string
       *     responses:
       *       200:
       *         description: Utilizador apagado
       *       500:
       *         description: Erro no servidor
       */
      const userId = req.params.userId;
      User.findByIdAndDelete(userId)
        .then(() => {
          res.status(200).send({ success: true, message: "User deleted" });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  // Rota para alteração de password
  router
    .route("/:userId/change-password")
    /**
     * @swagger
     * /users/{userId}/change-password:
     *   post:
     *     summary: Alterar password de um utilizador (self ou Admin)
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
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
     *               oldPassword:
     *                 type: string
     *               newPassword:
     *                 type: string
     *             required:
     *               - oldPassword
     *               - newPassword
     *     responses:
     *       200:
     *         description: Password alterada
     *       400:
     *         description: Dados inválidos
     *       403:
     *         description: Proibido
     */
    .post(Users.autorize([scopes.Admin, scopes.PersonalTrainer, scopes.Client]), function (req, res, next) {
      const userId = req.params.userId;
      const { oldPassword, newPassword } = req.body;
      const userRole = req.roleUser.role[0];

      // Usuário só pode alterar sua própria password, exceto Admin
      if (userRole !== scopes.Admin && req.userId !== userId) {
        return res.status(403).send({ success: false, error: "Você só pode alterar sua própria password" });
      }

      if (!oldPassword || !newPassword) {
        return res.status(400).send({ success: false, error: "oldPassword e newPassword são obrigatórios" });
      }

      Users.changePassword(userId, oldPassword, newPassword)
        .then(() => {
          res.status(200).send({ success: true, message: "Password alterada com sucesso" });
          next();
        })
        .catch((err) => {
          res.status(400).send({ success: false, error: err.message || err });
          next();
        });
    });

  // Admin valida Personal Trainer
  router
    .route("/:userId/validate")
    /**
     * @swagger
     * /users/{userId}/validate:
     *   put:
     *     summary: Validar/invalidar Personal Trainer (Admin)
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
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
     *               isValidated:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Estado atualizado
     *       404:
     *         description: Utilizador não encontrado
     */
    .put(Users.autorize([scopes.Admin]), function (req, res, next) {
      const userId = req.params.userId;
      const { isValidated } = req.body;

      User.findByIdAndUpdate(userId, { isValidated }, { new: true })
        .then((user) => {
          if (!user) {
            return res.status(404).send({ success: false, error: "User not found" });
          }

          io.emit('trainer_validated', {
            message: `Personal Trainer ${isValidated ? 'validado' : 'invalidado'}`,
            trainerId: userId
          });

          res.status(200).send({ success: true, data: user });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  // Listar personal trainers (para clientes escolherem)
  router
    .route("/trainers")
    /**
     * @swagger
     * /users/trainers:
     *   get:
     *     summary: Listar personal trainers validados
     *     tags: [Users]
     *     responses:
     *       200:
     *         description: Lista de trainers
     */
    .get(Users.autorize([scopes.Admin, scopes.Client]), function (req, res, next) {
      User.find({ 
        'role.scope': scopes.PersonalTrainer,
        isValidated: true 
      })
        .select('name email profileImage')
        .then((trainers) => {
          res.status(200).send({ success: true, data: trainers });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  // Administração: listar todos os personal trainers (validado e pendente)
  router
    .route("/admin/trainers")
    /**
     * @swagger
     * /users/admin/trainers:
     *   get:
     *     summary: Administração - listar personal trainers
     *     tags: [Users]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: isValidated
     *         schema:
     *           type: boolean
     *     responses:
     *       200:
     *         description: Lista de trainers
     *       500:
     *         description: Erro
     */
    .get(Users.autorize([scopes.Admin]), function (req, res, next) {
      const search = req.query.search || '';
      const isValidated = req.query.isValidated; // opcional: true/false

      const query = {
        'role.scope': scopes.PersonalTrainer,
      };

      if (typeof isValidated !== 'undefined') {
        query.isValidated = isValidated === 'true';
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      User.find(query)
        .select('name email phone country address profileImage isValidated createdAt role')
        .sort({ createdAt: -1 })
        .then((trainers) => {
          res.status(200).send({ success: true, data: trainers });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message });
          next();
        });
    });

  // Administração: atualizar dados de um personal trainer (apenas Admin)
  router
    .route("/admin/trainers/:userId")
    /**
     * @swagger
     * /users/admin/trainers/{userId}:
     *   put:
     *     summary: Administração - atualizar dados de personal trainer
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: Trainer atualizado
     *       500:
     *         description: Erro no servidor
     */
    .put(Users.autorize([scopes.Admin]), function (req, res, next) {
      const userId = req.params.userId;
      const body = req.body || {};

      // Campos permitidos via administração
      const allowed = ['name', 'email', 'phone', 'country', 'address', 'isValidated', 'profileImage'];
      const updateData = {};
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          updateData[key] = body[key];
        }
      });

      // Garantir que o utilizador é um Personal Trainer
      User.findById(userId)
        .then((user) => {
          if (!user) {
            return res.status(404).send({ success: false, error: 'User not found' });
          }

          const isTrainer = Array.isArray(user.role?.scope) && user.role.scope.includes(scopes.PersonalTrainer);
          if (!isTrainer) {
            return res.status(400).send({ success: false, error: 'User is not a Personal Trainer' });
          }

          return User.findByIdAndUpdate(userId, updateData, { new: true });
        })
        .then((updated) => {
          if (!updated) return; // já tratado acima

          if (Object.prototype.hasOwnProperty.call(updateData, 'isValidated')) {
            io.emit('trainer_validated', {
              message: `Personal Trainer ${updateData.isValidated ? 'validado' : 'invalidado'}`,
              trainerId: userId,
            });
          }

          res.status(200).send({ success: true, data: updated });
          next();
        })
        .catch((err) => {
          res.status(500).send({ success: false, error: err.message || err });
          next();
        });
    });

  return router;
};

module.exports = UsersRouter;
