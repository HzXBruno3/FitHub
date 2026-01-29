const config = require("../../config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

function UserService(UserModel) {
  let service = {
    create,
    createToken,
    verifyToken,
    findUser,
    autorize,
    update,
    findAll,
    findUserById,
    changePassword
  };

  function create(user) {
    return createPassword(user).then((hashPassword, err) => {
      if (err) {
        return Promise.reject("Not saved the user");
      }

      let newUserWithPassword = {
        ...user,
        password: hashPassword,
      };

      let newUser = UserModel(newUserWithPassword);
      return save(newUser);
    });
  }

  function createToken(user) {
    let token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        role: user.role && user.role.scope ? user.role.scope : []
      },
      config.secret,
      { expiresIn: config.expiresPassword }
    );
    return { auth: true, token };
  }


  function verifyToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, config.secret, (err, decoded) => {
        if (err) {
          reject();
        }
        return resolve(decoded);
      });
    });
  }

  function save(model) {
    return new Promise(function (resolve, reject) {
      console.log('Tentando salvar o modelo...');

      model.save(function (err) {
        if (err) {
          console.log('Erro ao salvar:', err);
          reject("There is a problema with register");
        }
        console.log('Usuário salvo com sucesso');
        resolve({
          message: 'User saved',
          user: model,
        });
      });
    });
  }


  function update(id, user) {
    console.log('user', user);
    return new Promise(function (resolve, reject) {
      console.log('user', user);
      UserModel.findByIdAndUpdate(id, user, function (err, userUpdated) {
        if (err) reject('Dont updated User');
        resolve(userUpdated);
      });
    });
  }

  function findUser({ name, email, password, isQrCode, id }) {
    // QR code login by user id (no password check)
    if (isQrCode && id) {
      return new Promise((resolve, reject) => {
        UserModel.findById(id, (err, user) => {
          if (err) return reject({ message: "Database error", error: err });
          if (!user) return reject({ message: "User not found" });
          resolve(user);
        });
      });
    }

    // Traditional login by email or name
    const lookupField = email || name;
    if (!lookupField) {
      return Promise.reject({ message: "User not found. Please check your email/name." });
    }

    const query = email ? { email } : { name };

    return new Promise(function (resolve, reject) {
      UserModel.findOne(query, function (err, user) {
        if (err) {
          return reject({ message: "Database error", error: err });
        }
        if (!user) {
          return reject({ message: "User not found. Please check your email/name." });
        }
        resolve(user);
      });
    }).then((user) => {
      if (isQrCode) {
        return user.password === password ? Promise.resolve(user) :
          Promise.reject({ message: "Invalid credentials" });
      }
      return comparePassword(password, user.password).then((match) => {
        if (!match) {
          return Promise.reject({ message: "Incorrect password. Please try again." });
        }
        return Promise.resolve(user);
      });
    });
  }

  function findAll(pagination) {
    const { limit, skip, sort, search, role } = pagination;

    // Construir query de busca
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query['role.scope'] = role;
    }

    // Construir opções de sort
    let sortOptions = {};
    if (sort) {
      const sortFields = sort.split(',');
      sortFields.forEach(field => {
        if (field.startsWith('-')) {
          sortOptions[field.substring(1)] = -1;
        } else {
          sortOptions[field] = 1;
        }
      });
    } else {
      sortOptions = { createdAt: -1 };
    }

    return new Promise(function (resolve, reject) {
      UserModel.find(query, {}, { skip, limit, sort: sortOptions })
        .populate('trainerId', 'name email')
        .exec(function (err, users) {
          if (err) reject(err);
          resolve(users);
        });
    }).then(async (users) => {
      const totalPlayers = await UserModel.countDocuments(query);
      return Promise.resolve({
        data: users,
        pagination: {
          pageSize: limit,
          page: Math.floor(skip / limit),
          hasMore: skip + limit < totalPlayers,
          total: totalPlayers,
        },
      });
    });
  }

  function createPassword(user) {
    return bcrypt.hash(user.password, config.saltRounds);
  }

  //devolver se a password é ou não a mesma
  function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  function autorize(scopes) {
    return (request, response, next) => {
      const { roleUser } = request;
      console.log("roleUser:", roleUser);
      
      // roleUser agora é o decoded completo, então pegamos roleUser.role
      const userRole = roleUser && roleUser.role ? roleUser.role : [];
      const userScopes = Array.isArray(userRole) ? userRole : [userRole];
      const hasAutorization = scopes.some(scope => userScopes.includes(scope));

      if (roleUser && hasAutorization) {
        next();
      } else {
        console.log("Authorization failed. User scopes:", userScopes, "Required scopes:", scopes);
        response.status(403).json({ message: "Forbidden" });
      }
    };
  }

  function findUserById(id) {
    return new Promise((resolve, reject) => {
      UserModel.findById(id, (err, user) => {
        if (err) {
          return reject(err);
        }
        if (!user) {
          return reject("User not found");
        }
        resolve(user);
      });
    });
  }

  function changePassword(userId, oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
      UserModel.findById(userId, (err, user) => {
        if (err) return reject(err);
        if (!user) return reject("User not found");
        
        comparePassword(oldPassword, user.password)
          .then((match) => {
            if (!match) {
              return reject("Password atual incorreta");
            }
            return createPassword({ password: newPassword });
          })
          .then((hashedPassword) => {
            user.password = hashedPassword;
            user.updatedAt = new Date();
            return user.save();
          })
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      });
    });
  }

  return service;
}

module.exports = UserService;
