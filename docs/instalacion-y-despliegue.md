# Guía de instalación y despliegue de la Cloud Function Gecode Airport

## Introducción

Esta guía mostrará los pasos necesarios para hacer la instalación y despliegue de la Cloud Function "Geocode Airport", la cual obtiene las coordenadas de un aeropuerto (previamente creado en la base de datos)

## Prerequisitos

* Tener activa la cuenta de GCP donde se subirá la Cloud Function
* Crear previamente el proyecto en GCP
* Instalar y configurar Google Cloud SDK - gcloud
* Tener instalado Node.js (Versión 20 o superior)
* Configurar debidamente los permisos de IAM para crear y desplegar Cloud Functions, administrar base de datos firestore y acceso a los secretos

## Creación y configuración de base de datos en FireStore

**1:** Crear la base de datos en Firestore
```bash
gcloud firestore databases create --location=[REGION] --project=[ID_DEL_PROYECTO]
```
Este comando creará la base de datos "(default)"

**2:** Registro de aeropuerto:
 - crea la collecion "airports"
 - Posterior crea un nuevo documento con los campos "id", "name" y "address", por ejemplo: 
  ```json
  {
    "id": 2, // Debe ser numerico
    "address": "Calle 100",
    "name": "Aeropuerto 100"
  }
  ```

## Instalación y despliegue

### env.yaml
```yaml
  SECRET_KEY: projects/[ID_DEL_PROYECTO]/secrets/SECRET_KEY_JWT/versions/latest
  OPENCAGE_API_KEY: projects/[ID_DEL_PROYECTO]/secrets/OPENCAGE_API_KEY/versions/latest
  GOOGLE_PROJECT_ID: prueba-domina
```

### Creacion de secretos
Ejecutar los siguientes comandos para crear los secretos necesarios para la cloud function
```bash
EXPORT SECRET_JWT=$(openssl rand -hex 64 )
gcloud secrets create SECRET_KEY_JWT --replication-policy="automatic"
printf $SECRET_JWT | gcloud secrets versions add SECRET_KEY_JWT --data-file=- --project=[ID_DEL_PROYECTO]

gcloud secrets create OPENCAGE_API_KEY --replication-policy="automatic"
printf [LICENCE-KEY-OPENCAGE] | gcloud secrets versions add OPENCAGE_API_KEY --data-file=- --project=[ID_DEL_PROYECTO]
```

### Configuración de gcloud

```bash
gcloud auth login
gcloud config set project [ID_DEL_PROYECTO]
```

### Despliegue de la Cloud Function

Para realizar el despliegue de la Cloud Function, despues de configurar gcloud se debe ejecutar el comando 

```bash
gcloud functions deploy geocode \
  --gen2 \
  --runtime=nodejs20 \
  --region=[REGION] \
  --trigger-http \
  --allow-unaunthenticated \
  --env-vars-file=env.yaml \
  --max-instances=2 \
  --timeout=60s \
  --entry-point=geocode \
  --source=. \
  --project=[ID_DEL_PROYECTO] \
  --concurrency=2 \
  --memory=256Mib \
  --cpu=1
```

### Prueba de la Cloud Function

```bash
curl -X GET \ 
  -H "Authorization: Bearer [TOKEN]" \
  "https://us-central1/prueba-domina/geocode?airportId=1"
```

## CI/CD
Para implementar CI/CD en este proyecto, se utilizó Google Cloud Build, creando el archivo `cloudbuild.yaml` sobre la raiz del proyecto, en el que se detallan los pasos para realizar las pruebas unitarias y el despliegue de la funcion en Cloud Functions.

Previo a esto se deben realizar las siguientes configuraciones en Google Cloud Platform:

1. Vincular el repositorio del codigo fuente en el apartado "Repositorios" de Cloud Build
2. Crear un "Activador" en el apartado "Activadores" de Cloud Build y relacionarlo al repositorio anteriormente vinculado. Establecer tambien la rama que será vinculada al activador
3. Habilitar los permisos necesarios a la cuenta de servicio que corresponda en el apartado "Configuracion" de Cloud Build
4. Subir un cambio a la rama vinculada para que Cloud Build ejecute los pasos definidos para las pruebas unitarias y despliegue de la Cloud Function.

## Dependencias

- [OpenCage API](https://github.com/tsamaya/opencage-api-client): Api de georeferenciacion con licencia de prueba. 
- [Google Cloud Functions Framework](https://www.npmjs.com/package/@google-cloud/functions-framework): Libreria usada para probar las funciones de manera local
- [Google Cloud Firestore](https://www.npmjs.com/package/@google-cloud/firestore): Libreria usada para consumo de base de datos Firestore alojada en GCP
- [Google Cloud Secret Manage](https://www.npmjs.com/package/@google-cloud/secret-manager): Libreria usada para gestion de secretos configurados paras cloud functions
- [Json Web Token](https://www.npmjs.com/package/jsonwebtoken): Libreria usada para gestión de token de autenticación jwt

### Dependencias de desarrollo
- [Jest](https://www.npmjs.com/package/jest): Ejecución de pruebas unitarias