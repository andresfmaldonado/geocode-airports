const {
  checkToken,
  saveCoordinate,
  arrayToKeyValueReduce,
  transformedData,
  auth,
  geocode
} = require('../index');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const opencage = require('opencage-api-client');
const jwt = require('jsonwebtoken');
const {Firestore} = require('@google-cloud/firestore');

jest.mock('@google-cloud/secret-manager', () => {
  return {
    SecretManagerServiceClient: jest.fn(() => ({
      accessSecretVersion: jest.fn().mockResolvedValue([{
        payload: {
          data: Buffer.from('VBzoXgjw6gbVXgUlLk8p8P3iTqcQa0PTfKyNFZM2DhXqeAaUmwQh02Wsxf5i2GLz')
        }
      }])
    }))
  }
});
jest.mock('@google-cloud/firestore');
jest.mock('opencage-api-client');
jest.mock('jsonwebtoken');

process.env.SECRET_KEY = 'projects/prueba-domina/secrets/SECRET_KEY_JWT/versions/latest';
process.env.OPENCAGE_API_KEY = 'projects/prueba-domina/secrets/OPENCAGE_API_KEY/versions/latest';
process.env.GOOGLE_PROJECT_ID = 'prueba-domina';
describe('checkToken', () => {
  it('checkToken should return true for a valid token', async () => {
    jwt.verify.mockReturnValue({});
    const req = {
      headers: {
        authorization: 'Bearer 123'
      }
    };
    const result = await checkToken(req);
    expect(result).toBe(true);
  });

  it('checkToken should return false for a missing token', async () => {
    const req = {
      headers: {}
    };
    const result = await checkToken(req);
    expect(result).toBe(false);
  });

  it('checkToken should return false for a invalid token', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    const req = {
      headers: {
        authorization: 'Bearer invalid_token'
      }
    };
    const result = await checkToken(req);
    expect(result).toBe(false);
  });
});

describe('saveCoordinate', () => {
  it('saveCoordinate should save coordinate to Firestore', async () => {
    // Solve firestore mock
  });
});

describe('arrayToKeyValueReduce', () => {
  it('arrayToKeyValueReduce should convert arrays to key-value pairs', () => {
    const keys = ['a', 'b', 'c'];
    const values = [ 1, 2, 3 ];
    const result = arrayToKeyValueReduce(keys, values);
    expect(result).toEqual({
      a: 1,
      b: 2,
      c: 3
    });
  })
});

describe('transformedData', () => {
  it('transformedData should transform coordinate data', () => {
    const coordinate = {
      annotations: {
        DMS: {
          lat: '20 12 33.002 N',
          lng: '33 43 32.230 W'
        }
      }
    };
    const result = transformedData(coordinate);
    expect(result).toEqual({
      latitude: {
        grades: '20',
        minutes: '12',
        seconds: '33.002',
        orientation: 'N'
      },
      longitude: {
        grades: '33',
        minutes: '43',
        seconds: '32.230',
        orientation: 'W'
      },
      lat: '20 12 33.002 N',
      lng: '33 43 32.230 W',
      coordinate
    });
  })
});

describe('geocode', () => {
  let res;
  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('geocode should return 405 if method is not GET', async () => {
    const req = {
      method: 'POST'
    };
    await geocode(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Method not allowed',
    });
  });

  it('geocode should return 403 if token is invalid', async () => {
    const req = {
      method: 'GET',
      headers: {
        authorization: 'Bearer invalid_token'
      }
    };
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    })
    await geocode(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Invalid token'
    });
  });

  it('geocode should return 400 if airportId is missing', async () => {
    const req = {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid_token'
      },
      query: {}
    };
    jwt.verify.mockReturnValue({});
    await geocode(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Missing airportId'
    });
  });

  it('geocode should return 404 if airport not found', async () => {
    // Solve firestore mock
  });

  it('geocode should return 200 with coordinate if exists', async () => {
    // Solve firestore mock
  });

  it('geocode should return 200 with new coordinate if not exists', async () => {
    // Solve firestore mock
  });

  it('geocode should return 500 if opencage throws an error', async () => {
    // Solve firestore mock
  });

  it('geocode should return 500 on generic error', async () => {
    const req = {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid_token'
      },
      query: {
        airportId: 123
      }
    };
    jest.spyOn(jest.requireActual('../index'), 'checkToken').mockImplementation(() => {
      throw new Error('Generic error');
    })
    await geocode(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Error occurred while processing request'
    });
  });
});