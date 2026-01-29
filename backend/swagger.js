const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Personal Trainer API',
      version: '1.0.0',
      description: 'API para plataforma de gestão de personal trainers e clientes',
      contact: {
        name: 'Stadium Team',
        email: 'support@stadium.com'
      }
    },
    servers: [
      {
        url: 'http://127.0.0.1:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID do utilizador'
            },
            name: {
              type: 'string',
              description: 'Nome completo'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email único'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Password (hasheada)'
            },
            role: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                scope: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['admin', 'personaltrainer', 'client']
                  }
                }
              }
            },
            birthDate: {
              type: 'string',
              format: 'date'
            },
            phone: {
              type: 'string'
            },
            country: {
              type: 'string'
            },
            address: {
              type: 'string'
            },
            profileImage: {
              type: 'string'
            },
            trainerId: {
              type: 'string',
              description: 'ID do personal trainer (para clientes)'
            },
            isValidated: {
              type: 'boolean',
              description: 'Se o personal trainer está validado'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Exercise: {
          type: 'object',
          required: ['name', 'createdBy'],
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            videoUrl: { type: 'string' },
            instructions: { type: 'string' },
            muscleGroup: { type: 'string' },
            equipment: { type: 'string' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        WorkoutPlan: {
          type: 'object',
          required: ['name', 'clientId', 'trainerId', 'frequency', 'startDate'],
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            clientId: { type: 'string' },
            trainerId: { type: 'string' },
            frequency: {
              type: 'number',
              enum: [3, 4, 5],
              description: 'Treinos por semana'
            },
            weeklySchedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dayOfWeek: {
                    type: 'number',
                    minimum: 0,
                    maximum: 6
                  },
                  exercises: {
                    type: 'array',
                    maxItems: 10,
                    items: {
                      type: 'object',
                      properties: {
                        exercise: { type: 'string' },
                        sets: { type: 'number' },
                        reps: { type: 'string' },
                        rest: { type: 'string' },
                        notes: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            isActive: { type: 'boolean' }
          }
        },
        Message: {
          type: 'object',
          required: ['senderId', 'receiverId', 'content'],
          properties: {
            _id: { type: 'string' },
            senderId: { type: 'string' },
            receiverId: { type: 'string' },
            content: { type: 'string' },
            isRead: { type: 'boolean' },
            isAlert: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        TrainerRequest: {
          type: 'object',
          required: ['clientId', 'newTrainerId', 'reason'],
          properties: {
            _id: { type: 'string' },
            clientId: { type: 'string' },
            currentTrainerId: { type: 'string' },
            newTrainerId: { type: 'string' },
            reason: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected']
            },
            reviewedBy: { type: 'string' },
            reviewedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ]
  },
  apis: ['./server/*.js', './router.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi
};
