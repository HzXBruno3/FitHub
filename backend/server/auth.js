const bodyParser = require("body-parser");
const express = require("express");
const Users = require("../data/users");
const cookieParser = require('cookie-parser');
const VerifyToken = require('../middleware/Token');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API de autenticação
 */

function AuthRouter() {
  let router = express.Router();
  router.use(require('cookie-parser')());
  router.use(bodyParser.json({ limit: "100mb" }));
  router.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Registar novo utilizador
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *               - password
   *               - role
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: object
   *                 properties:
   *                   name:
   *                     type: string
   *                   scope:
   *                     type: array
   *                     items:
   *                       type: string
   *     responses:
   *       200:
   *         description: Utilizador registado com sucesso
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro no servidor
   */
  router.route("/register").post(function (req, res, next) {
    const body = req.body;
    const { role } = body;

    if (!role || !Array.isArray(role.scope) || role.scope.length === 0) {
      return res.status(400).send({ auth: false, message: 'Invalid role or scope' });
    }

    //Authorize - Bearer fjbdfbdsjkfndskf
    //credentials: include
    Users.create(body)
      .then((result) => {
        const userObj = result.user.toObject();
        return Users.createToken(userObj);
      })
      .then((response) => {
        res.status(200).send(response);
      })
      .catch((err) => {
        res.status(500).send(err);
        next();
      });
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login de utilizador
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               isQrCode:
   *                 type: boolean
   *               id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login bem-sucedido
   *       401:
   *         description: Credenciais inválidas
   */
  router.route("/login").post(function (req, res, next) {
    let body = req.body;

    return Users.findUser(body)
      .then((user) => {
        // Bloquear login de Personal Trainer não validado
        const scopes = require("../data/users/scopes");
        const isTrainer = Array.isArray(user.role?.scope) && user.role.scope.includes(scopes.PersonalTrainer);
        if (isTrainer && user.isValidated !== true) {
          const err = new Error("Personal Trainer não validado. Aguarde aprovação do administrador.");
          err.status = 401;
          throw err;
        }
        return Users.createToken(user);
      })
      .then((response) => {
        // The httpOnly: true setting means that the cookie can’t be read using JavaScript but can still be sent back to the server in HTTP requests
        res.cookie("token", response.token, {
          httpOnly: false,
          secure: false,              // em dev local HTTP
          sameSite: "lax",            // permite envio cross-origin para localhost:5173
          path: "/",                  // cookie disponível em todas as rotas
        });
        res.status(200).send({
          ...response,
          message: "Login successful"
        });
      })
      .catch((err) => {
        console.log("Login error:", err);
        const errorMessage = err.message || "Login failed. Please check your credentials.";
        res.status(err.status || 401).send({ 
          auth: false, 
          message: errorMessage 
        });
      });
  });

  router.use(cookieParser());
  router.use(VerifyToken);

  router.route("/logout").get(function (req, res, next) {
    /**
     * @swagger
     * /auth/logout:
     *   get:
     *     summary: Terminar sessão
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Logout bem-sucedido
     */
    res.cookie("token", req.cookies.token, { httpOnly: true, maxAge: 0 });
    res.status(200);
    res.send({ logout: true });
    next();
  });

  router.route("/me").get(function (req, res, next) {
    /**
     * @swagger
     * /auth/me:
     *   get:
     *     summary: Obter dados do token
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       202:
     *         description: Token válido
     *       500:
     *         description: Erro no servidor
     */
    try {
      res.status(202).send({ auth: true, decoded: req.roleUser });
    } catch (err) {
      res.status(500).send(err);
      next();
    }
  });

  return router;
}

module.exports = AuthRouter;