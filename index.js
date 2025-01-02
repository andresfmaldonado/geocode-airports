const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();
const opencage = require('opencage-api-client');
const jwt = require('jsonwebtoken');
const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: process.env.GOOGLE_PROJECT_ID,
});

const checkToken = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      throw `Token not starts with Bearer`;
    }

    const secretName = process.env.SECRET_KEY;
    const [version] = await client.accessSecretVersion({ name: secretName });
    const secretValue = version.payload.data.toString();

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = jwt.verify(token, secretValue);

    if (decodedToken === undefined) {
      throw 'Token is invalid'
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

const saveCoordinate = async (id, coordinate) => {
  const airportRef = await db.collection('airports').doc(id);

  await airportRef.set(coordinate, { merge: true }).then(() => {
    console.log('Coordinate saved');
  }).catch((error) => {
    console.error('Error saving coordinate:', error);
  });
}

const arrayToKeyValueReduce = (keysArray, valuesArray) => {
  return keysArray.reduce((acc, key, index) => {
    acc[key] = valuesArray[index];
    return acc;
  }, {});
}

const transformedData = (coordinate) => {
  const { lat, lng } = coordinate.annotations.DMS;
  const latitudeArray = lat.split(' ');
  const longitudeArray = lng.split(' ');
  const keysForBD = ['grades', 'minutes', 'seconds', 'orientation'];
  return {
    latitude: arrayToKeyValueReduce(keysForBD, latitudeArray),
    longitude: arrayToKeyValueReduce(keysForBD, longitudeArray),
    lat,
    lng,
    coordinate
  };
}

/**
 * @api {get} /:airportId Request Airport Coordinate
 * @apiVersion 1.0.0
 * @apiName GeoCode Airport
 * @apiGroup Airports
 * 
 * @apiHeader {String} Authorization Bearer <token>
 * 
 * @apiParam {Number} airportId Airport's ID
 * 
 * @apiExample {curl} Example usage:
 *  curl -X GET 'http://localhost:3000/geocode?airportId=123' -H 'Authorization: Bearer asd123bcv'
 * 
 * @apiSuccess {String} name Airport's Name
 * @apiSuccess {String} latitude Airport's Latitude
 * @apiSuccess {String} longitude Airport's Longitude
 * 
 * @apiSuccessExample {json} Success-Response:
 *  HTTP/1.1 200 OK
 *  {
 *    "name": "Jose Maria Cordoba",
 *    "latitude": "20° 12' 33.002'' N",
 *    "longitude": "43° 21' 22.123'' W"
 *  }
 * 
 * @apiError (403) Forbidden Invalid Token
 * @apiErrorExample {json} Forbidden-Error:
 *  HTTP/1.1 403 Forbidden
 *  {
 *    "error": "Invalid Token"
 *  }
 * @apiError (400) Bad_Request Missing airportId
 * @apiErrorExample {json} Bad_Request-Error:
 *  HTTP/1.1 400 Bad Request
 *  {
 *    "error": "Missing airportId"
 *  }
 * @apiError (404) Not_Found Airport not found
 * @apiErrorExample {json} Not_Found-Error:
 *  HTTP/1.1 404 Not Found
 *  {
 *    "error": "Aiport not found"
 *  }
 * @apiError (500) Internal_Server_Error Error occurred while processing request
 * @apiErrorExample {json} Internal_Server_Error-Error:
 *  HTTP/1.1 500 Internal Server Error
 *  {
 *    "error": "Error occurred while processing request"
 *  }
 * @apiError (405) Method_not_allowed Method not allowed
 * @apiErrorExample {json} Method_not_allowed-Error:
 *  HTTP/1.1 405 Method Not Allowed
 *  {
 *    "error": "Method not allowed"
 *  }
 */
const geocode = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).send({ error: 'Method not allowed' });
    }

    if (!await checkToken(req)) {
      return res.status(403).send({ error: 'Invalid token' });
    }

    if (req.query.airportId === undefined) {
      return res.status(400).send({ error: 'Missing airportId' });
    }

    const { airportId } = req.query;

    const airportsRef = await db.collection('airports');

    const airports = await airportsRef.where('id', '==', Number(airportId)).limit(1).get();
    
    if (airports.empty) {
      return res.status(404).send({ error: 'Airport not found' });
    }

    let airport, response;
    airports.forEach((doc) => airport = doc);
    if (airport != null) {
      const data = airport.data();
      const {address, coordinate, lat, lng, name} = data;
      if (coordinate === undefined) {
        const secretName = process.env.OPENCAGE_API_KEY;
        const [version] = await client.accessSecretVersion({ name: secretName });
        process.env.OPENCAGE_API_KEY = version.payload.data.toString();
        opencage.geocode({q: address}).then(async (coordinate) => {
          if (coordinate.status.code === 200 && coordinate.results.length > 0) {
            const coordinateTransformed = transformedData(coordinate.results[0]);
            await saveCoordinate(airport.id, coordinateTransformed);
            response = {
              name,
              latitude: coordinateTransformed.lat,
              longitude: coordinateTransformed.lng,
            };
          } else {
            response = { 
              name, 
              error: 'No results found' 
            };
          }
          return res.status(200).send(response);
        }).catch((error) => {
          console.error(error);
          return res.status(500).send({error: 'Error occurred while processing request'});
        });
      } else {
        response = { 
          name, 
          latitude: lat,
          longitude: lng,
        }

        return res.status(200).send(response);
      }
    } else {
      response = { error: 'Airport not found' };
      return res.status(404).send(response);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      error: 'Error occurred while processing request',
    });
  }
};

const auth = async (req, res) => {
  return res.status(200).send({
    token: jwt.sign({}, process.env.SECRET_KEY)
  });
};

module.exports = {
  checkToken,
  saveCoordinate,
  arrayToKeyValueReduce,
  transformedData,
  auth,
  geocode
}