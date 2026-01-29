const request = require('supertest');
const express = require('express');
const AuthRouter = require('../server/auth');
const Users = require('../data/users');

// Mock do serviço Users
jest.mock('../data/users');

describe('Auth API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', AuthRouter());
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: {
          name: 'client',
          scope: ['client']
        }
      };

      Users.create.mockResolvedValue({
        message: 'User saved',
        user: { ...mockUser, _id: '123' }
      });

      Users.createToken.mockResolvedValue({
        auth: true,
        token: 'fake-jwt-token'
      });

      const response = await request(app)
        .post('/auth/register')
        .send(mockUser);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('auth', true);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 400 if role is missing', async () => {
      const invalidUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      Users.findUser.mockResolvedValue({
        _id: '123',
        name: 'Test User',
        email: 'test@example.com'
      });

      Users.createToken.mockResolvedValue({
        auth: true,
        token: 'fake-jwt-token'
      });

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('auth', true);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 401 with invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      Users.findUser.mockRejectedValue({
        message: 'Incorrect password'
      });

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('auth', false);
    });

    it('should support QR code login', async () => {
      const qrLogin = {
        id: '123',
        password: 'qr-hash',
        isQrCode: true
      };

      Users.findUser.mockResolvedValue({
        _id: '123',
        name: 'Test User',
        email: 'test@example.com'
      });

      Users.createToken.mockResolvedValue({
        auth: true,
        token: 'fake-jwt-token'
      });

      const response = await request(app)
        .post('/auth/login')
        .send(qrLogin);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });
});
