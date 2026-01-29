const UserService = require('../data/users/service');
const bcrypt = require('bcrypt');

// Mock do modelo User
const mockUserModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  prototype: {
    save: jest.fn()
  }
};

jest.mock('bcrypt');

describe('UserService', () => {
  let userService;

  beforeEach(() => {
    userService = UserService(mockUserModel);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { _id: '1', name: 'User 1', email: 'user1@test.com' },
        { _id: '2', name: 'User 2', email: 'user2@test.com' }
      ];

      mockUserModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers)
        })
      });
      mockUserModel.countDocuments.mockResolvedValue(10);

      const result = await userService.findAll({
        limit: 2,
        skip: 0
      });

      expect(result.data).toEqual(mockUsers);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.pageSize).toBe(2);
    });

    it('should support search query', async () => {
      const searchQuery = 'John';
      
      mockUserModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        })
      });
      mockUserModel.countDocuments.mockResolvedValue(0);

      await userService.findAll({
        limit: 10,
        skip: 0,
        search: searchQuery
      });

      expect(mockUserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
          ])
        }),
        {},
        expect.any(Object)
      );
    });

    it('should support sorting', async () => {
      mockUserModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        })
      });
      mockUserModel.countDocuments.mockResolvedValue(0);

      await userService.findAll({
        limit: 10,
        skip: 0,
        sort: 'name,-createdAt'
      });

      expect(mockUserModel.find).toHaveBeenCalledWith(
        expect.any(Object),
        {},
        expect.objectContaining({
          sort: expect.objectContaining({
            name: 1,
            createdAt: -1
          })
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = '123';
      const oldPassword = 'oldpass123';
      const newPassword = 'newpass456';
      const hashedNewPassword = 'hashed-new-password';

      const mockUser = {
        _id: userId,
        password: 'hashed-old-password',
        save: jest.fn().mockResolvedValue(true)
      };

      mockUserModel.findById.mockImplementation((id, callback) => {
        callback(null, mockUser);
      });

      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(hashedNewPassword);

      await userService.changePassword(userId, oldPassword, newPassword);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.password).toBe(hashedNewPassword);
    });

    it('should reject if old password is incorrect', async () => {
      const userId = '123';
      const mockUser = {
        _id: userId,
        password: 'hashed-old-password'
      };

      mockUserModel.findById.mockImplementation((id, callback) => {
        callback(null, mockUser);
      });

      bcrypt.compare.mockResolvedValue(false);

      await expect(
        userService.changePassword(userId, 'wrongpass', 'newpass')
      ).rejects.toMatch(/incorreta/i);
    });

    it('should reject if user not found', async () => {
      mockUserModel.findById.mockImplementation((id, callback) => {
        callback(null, null);
      });

      await expect(
        userService.changePassword('999', 'old', 'new')
      ).rejects.toMatch(/not found/i);
    });
  });

  describe('findUser', () => {
    it('should find user by email', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        password: 'hashed-password'
      };

      mockUserModel.findOne.mockImplementation((query, callback) => {
        callback(null, mockUser);
      });

      bcrypt.compare.mockResolvedValue(true);

      const result = await userService.findUser({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(result).toEqual(mockUser);
    });

    it('should support QR code login', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        password: 'qr-hash'
      };

      mockUserModel.findById.mockImplementation((id, callback) => {
        callback(null, mockUser);
      });

      const result = await userService.findUser({
        id: '123',
        password: 'qr-hash',
        isQrCode: true
      });

      expect(result).toEqual(mockUser);
    });
  });
});
