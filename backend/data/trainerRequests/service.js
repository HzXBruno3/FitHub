function TrainerRequestsService(TrainerRequestModel) {
  let service = {
    create,
    findAll,
    findById,
    updateStatus,
    findByClient,
    findPending,
  };

  function create(requestData) {
    return new Promise(function (resolve, reject) {
      const newRequest = new TrainerRequestModel(requestData);
      newRequest.save(function (err, request) {
        if (err) {
          console.error('Erro ao criar pedido:', err);
          reject("Erro ao criar pedido de alteração");
        }
        resolve(request);
      });
    });
  }

  function findAll(query = {}) {
    return new Promise(function (resolve, reject) {
      TrainerRequestModel.find(query)
        .populate("clientId", "name email")
        .populate("currentTrainerId", "name email")
        .populate("newTrainerId", "name email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .exec(function (err, requests) {
          if (err) reject(err);
          resolve(requests);
        });
    });
  }

  function findById(id) {
    return new Promise(function (resolve, reject) {
      TrainerRequestModel.findById(id)
        .populate("clientId", "name email")
        .populate("currentTrainerId", "name email")
        .populate("newTrainerId", "name email")
        .populate("reviewedBy", "name email")
        .exec(function (err, request) {
          if (err) reject(err);
          if (!request) reject('Pedido não encontrado');
          resolve(request);
        });
    });
  }

  function updateStatus(id, status, reviewedBy) {
    return new Promise(function (resolve, reject) {
      TrainerRequestModel.findByIdAndUpdate(
        id,
        {
          status: status,
          reviewedBy: reviewedBy,
          reviewedAt: Date.now(),
        },
        { new: true },
        function (err, request) {
          if (err) reject('Erro ao atualizar pedido');
          if (!request) reject('Pedido não encontrado');
          resolve(request);
        }
      );
    });
  }

  function findByClient(clientId) {
    return new Promise(function (resolve, reject) {
      TrainerRequestModel.find({ clientId: clientId })
        .populate("currentTrainerId", "name email")
        .populate("newTrainerId", "name email")
        .sort({ createdAt: -1 })
        .exec(function (err, requests) {
          if (err) reject(err);
          resolve(requests);
        });
    });
  }

  function findPending() {
    return new Promise(function (resolve, reject) {
      TrainerRequestModel.find({ status: 'pending' })
        .populate("clientId", "name email")
        .populate("currentTrainerId", "name email")
        .populate("newTrainerId", "name email")
        .sort({ createdAt: 1 })
        .exec(function (err, requests) {
          if (err) reject(err);
          resolve(requests);
        });
    });
  }

  return service;
}

module.exports = TrainerRequestsService;
