const { geocode } = require('../src/index');
const test = require('firebase-functions-test')();
const admin = require('firebase-admin');
const opencage = require('opencage-api-client');
const jwt = require('jsonwebtoken');

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn()
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            empty: false,
            forEach: jest.fn((callback) => callback({
              id: 'testId',
              data: () => ({
                address: 'Test Address',
                coordinate: undefined,
                lat: undefined,
                lng: undefined
              })
            }))
          }))
        })),
        doc: jest.fn(() => ({
          set: jest.fn(() => Promise.resolve())
        }))
      }))
    })),
    doc: jest.fn()
  }))
}));


jest.mock('opencage-api-client', () => ({
  geocode: jest.fn(() =>
    Promise.resolve({
      status: { code: 200 },
      results: [{
        annotations: {
          DMS: {
            lat: '20 12 33.002 N',
            lng: '43 21 22.123 W',
          },
        },
      }],
    })
  ),
}));

describe('geocode', () => {
  beforeEach(() => {
    process.env.SECRET_KEY = 'VBzoXgjw6gbVXgUlLk8p8P3iTqcQa0PTfKyNFZM2DhXqeAaUmwQh02Wsxf5i2GLz',
    jest.clearAllMocks()
  });

  afterAll(() => {
    test.cleanup()
  })

  // it('should return 400 for missing airportId', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const req = {
  //     body: {},
  //     headers: {
  //       authorization: `Bearer ${token}`,
  //     }
  //   };

  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn().mockReturnThis()
  //   }

  //   await geocode(req, res);
  //   expect(res.status).toHaveBeenCalledWith(400);
  //   expect(res.status().send).toHaveBeenCalledWith({ error: 'Missing airportId' });
  // });

  // it('should return 404 when airport is not found', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const getMock = admin.firestore().collection().where().limit().get;
  //   getMock.mockResolvedValueOnce({ empty: true });
  //   const req = {
  //     body: { airportId: 123 },
  //     headers: {
  //       authorization: `Bearer ${token}`,
  //     }
  //   };

  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn()
  //   }

  //   await geocode(req, res);
  //   expect(res.status).toHaveBeenCalledWith(404);
  //   expect(res.body).toEqual({ error: 'Airport not found' });
  // });

  // it('should return 200 with the airport coordinates (first time)', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const opencageMock = opencage.geocode;
  //   const req = {
  //     body: {
  //       airportId: 123
  //     },
  //     headers: {
  //       authorization: `Bearer ${token}`
  //     }
  //   };
    
  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn()
  //   };

  //   await geocode(req, res);
  //   expect(res.status).toHaveBeenCalledWith(200);
  //   expect(res.body).toEqual({
  //     name: 'Test Address',
  //     latitude: '20 12 33.002 N',
  //     longitude: '43 21 22.123 W',
  //   });
  //   expect(opencageMock).toHaveBeenCalledTimes(1);

  // });

  // it('should return 200 with the airport coordinates (coordinates already saved)', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const getMock = admin.firestore().collection().where().limit().get;
  //   const getMockCheckToken = checkToken;

  //   getMock.mockResolvedValueOnce({
  //     empty: false,
  //     forEach: jest.fn((callback) => callback({
  //       id: 'testId',
  //       data: () => ({
  //         address: 'Test Address',
  //         coordinate: {
  //           latitude: {
  //             grades: '20',
  //             minutes: '12',
  //             seconds: '33.002',
  //             orientation: 'N',
  //           },
  //           longitude: {
  //             grades: '43',
  //             minutes: '21',
  //             seconds: '22.123',
  //             orientation: 'W',
  //           },
  //           lat: '20 12 33.002 N',
  //           lng: '43 21 22.123 W',
  //         },
  //         lat: '20 12 33.002 N',
  //         lng: '43 21 22.123 W'
  //       })
  //     }))
  //   });

  //   getMockCheckToken.mockResolvedValueOnce(true);

  //   const req = {
  //     body: {
  //       airportId: 123
  //     },
  //     headers: {
  //       authorization: `Bearer ${token}`
  //     }
  //   };

  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn(),
  //   };

  //   await geocode(req, res);

  //   expect(res.status).toHaveBeenCalledWith(200);
  //   expect(res.body).toEqual({
  //     name: 'Test Address',
  //     latitude: '20 12 33.002 N',
  //     longitude: '43 21 22.123 W',
  //   });
  // });

  // it('should return 500 if something goes wrong', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const getMock = admin.firestore()
  //     .collection()
  //     .where()
  //     .limit()
  //     .get;
  //   getMock.mockRejectedValueOnce(new Error('Test error'));
  //   const consoleError = jest.spyOn(console, 'error');
  //   const req = {
  //     headers: {
  //       authorization: `Bearer ${token}`
  //     },
  //     body: {
  //       airportId: 123
  //     }
  //   };
  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn().mockReturnThis()
  //   };

  //   await geocode(req, res);

  //   expect(res.status).toHaveBeenCalledWith(500);
  // });

  // it('should return 500 when opencage fails', async () => {
  //   const token = jwt.sign({}, process.env.SECRET_KEY);
  //   const opencageMock = opencage.geocode;
  //   opencageMock.mockRejectedValueOnce(new Error("Opencage error"));
  //   const req = {
  //     body: {
  //       airportId: 123,
  //     },
  //     headers: {
  //       authorization: `Bearer ${token}`
  //     }
  //   };
  //   const res = {
  //     status: jest.fn().mockReturnThis(),
  //     send: jest.fn().mockReturnThis(),
  //   };

  //   await geocode(req, res);
  //   expect(res.status).toHaveBeenCalledWith(500);
  //   expect(res.status().send).toHaveBeenCalledWith({
  //     error: 'Error occurred while processing request',
  //   });
  // });

});