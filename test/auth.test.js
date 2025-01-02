const { auth, checkToken } = require('../src/index');
const jwt = require('jsonwebtoken');
const test = require('firebase-functions-test')();

describe('auth', () => {
  beforeEach(() => {
    process.env.SECRET_KEY = 'VBzoXgjw6gbVXgUlLk8p8P3iTqcQa0PTfKyNFZM2DhXqeAaUmwQh02Wsxf5i2GLz'
  });

  afterAll(() => {
    test.cleanup()
  })

  it('checkToken should return true for a valid token', async () => {
    const token = jwt.sign({}, process.env.SECRET_KEY);
    const req = { headers: { authorization: `Bearer ${token}` } };
    expect(await checkToken(req)).toBe(true);
  });

  it('checkToken should return false for a missing token', async () => {
    const req = { headers: {} };
    expect(await checkToken(req)).toBe(false);
  });

  it('checkToken should return false for an invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    expect(await checkToken(req)).toBe(false);
  });
  it('checkToken should return false for a token with invalid format', async () => {
    const req = { headers: { authorization: 'invalidtoken' } };
    expect(await checkToken(req)).toBe(false);
  });
  it('auth should return a token', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await auth({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });
});