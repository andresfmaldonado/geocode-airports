const { OAuth2Client } = require('google-auth-library');
const functions = require('firebase-functions');
const opencage = require('opencage-api-client');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CLIENT_ID = process.env.CLIENT_ID;
const oauthClient = new OAuth2Client(CLIENT_ID);

initializeApp();
const db = getFirestore();

async function checkToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return false; 
  }

  const token = authHeader.split('Bearer')[1];
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (payload === undefined) {
    return false; 
  }

  return true;
}

async function saveCoordinate(id, coordinate) {
  const airportRef = await db.collection('airports').doc(id);
  await airportRef.set(coordinate, { merge: true }).then(() => {
    console.log('Coordinate saved');
  }).catch((error) => {
    console.error('Error saving coordinate:', error);
  });
}

function arrayToKeyValueReduce(keysArray, valuesArray) {
  return keysArray.reduce((acc, key, index) => {
    acc[key] = valuesArray[index];
    return acc;
  }, {});
}

function transformedData(coordinate) {
  const {lat, lng} = coordinate.annotations.DMS;
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
 * @apiName GeoCode Airport
 * @apiGroup Airports
 * 
 * @apiHeader {String} Authorization Bearer <token>
 * 
 * @apiQuery {Number} airportId Airport's ID
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
 */
exports.geocode = functions.https.onRequest(async (req, res) => {
  try {
    if (!await checkToken(req)) {
      return res.status(403).send({ error: 'Invalid token' });
    } 

    if (req.body.airportId === undefined) {
      return res.status(400).send({ error: 'Missing airportId' });
    }

    const { airportId } = req.body;
    
    const airportsRef = await db.collection('airports');
    const airports = await airportsRef.where('id', '==', airportId).limit(1).get();
    if (airports.empty) {
      return res.status(404).send({ error: 'Airport not found' });
    }
    
    let airport, response;
    airports.forEach((doc) => airport = doc);
    if (airport != null) {
      const data = airport.data();
      const {address, coordinate, lat, lng} = data;
      if (coordinate === undefined) {
        opencage.geocode({q: address}).then(async (coordinate) => {
          if (coordinate.status.code === 200 && coordinate.results.length > 0) {
            const coordinateTransformed = transformedData(coordinate.results[0]);
            await saveCoordinate(airport.id, coordinateTransformed);
            response = {
              name: airport.address,
              latitude: coordinateTransformed.lat,
              longitude: coordinateTransformed.lng,
            };
          } else {
            response = { name: airport.address, error: 'No results found' };
          }
          return res.status(200).send(response);
        }).catch((error) => {
          console.error(error);
          return res.status(500).send({error: 'Error occurred while processing request'});
        })
      } else {
        console.log('Coordinate already saved');
        response = { 
          name: address, 
          latitude: lat,
          longitude: lng,
        }
        console.log(response);
        
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
})