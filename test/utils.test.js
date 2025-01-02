const { saveCoordinate, arrayToKeyValueReduce, transformedData } = require('../src/index');
const admin = require('firebase-admin');
const indexModule = require('../src/index');

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn()
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve())
      }))
    }))
  }))
}));

describe('Utils', () => {
  it('saveCoordinate should save the coordinate to Firestore', async () => {
    const setMock = admin.firestore().collection().doc().set;
    await saveCoordinate('testId', { lat: 10, lng: 20 });
    expect(await setMock).toHaveBeenCalledWith({ lat: 10, lng: 20 }, { merge: true });
  });

  it('saveCoordinate should handle errors when saving coordinate', async () => {
    const setMock = admin.firestore().collection().doc().set;
    setMock.mockRejectedValue(new Error('Test Error'))

    try {
      await saveCoordinate('testId', { lat: 10, lng: 20 });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toEqual("Test Error");
    }
  });

  it('arrayToKeyValueReduce should transform arrays to key-value object', () => {
    const keys = ['a', 'b', 'c'];
    const values = [1, 2, 3];
    const result = arrayToKeyValueReduce(keys, values);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('arrayToKeyValueReduce should return empty object when keys or values are empty', () => {
    const keys = [];
    const values = [];
    const result = arrayToKeyValueReduce(keys, values);
    expect(result).toEqual({});
  });

  it('transformedData should transform coordinate data correctly', () => {
    const arrayToKeyValueReduceSpy = jest.spyOn(indexModule, 'arrayToKeyValueReduce');
    const coordinate = {
      annotations: {
        DMS: {
          lat: '20 12 33.002 N',
          lng: '43 21 22.123 W',
        },
      },
    };
    const result = transformedData(coordinate);
    expect(result).toEqual({
      latitude: {
        grades: '20',
        minutes: '12',
        seconds: '33.002',
        orientation: 'N',
      },
      longitude: {
        grades: '43',
        minutes: '21',
        seconds: '22.123',
        orientation: 'W',
      },
      lat: '20 12 33.002 N',
      lng: '43 21 22.123 W',
      coordinate,
    });
    arrayToKeyValueReduceSpy.mockRestore();
  });
});