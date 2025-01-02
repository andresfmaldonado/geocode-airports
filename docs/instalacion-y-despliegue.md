# Guía de instalación y despliegue de la Cloud Function Gecode Airport

## Introducción

Esta guía mostrará los pasos necesarios para hacer la instalación y despliegue de la Cloud Function "Geocode Airport", la cual obtiene las coordenadas de un aeropuerto (previamente creado en la base de datos)

## Prerequisitos

* Tener activa la cuenta de GCP donde se subirá la Cloud Function
* Crear previamente el proyecto en GCP
* Instalar y configurar Google Cloud SDK - gcloud (Opcional)
* Tener instalado Node.js (Versión 20 o superior)
* Configurar debidamente los permisos de IAM para crear y desplegar Cloud Functions

## Creación y configuración de base de datos en FireStore

- **1:** Crear la base de datos en Firestore
```bash
gcloud firestore databases create --location=[REGION] --project=[ID_DEL_PROYECTO]
```
Este comando creará la base de datos "(default)"

- **2:** Registro de aeropuerto:
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
  SECRET_KEY: [Secrete key jwt]
  OPENCAGE_API_KEY: [Key de la libreria Opencage]
  GOOGLE_PROJECT_ID: [id del proyecto de GCP]

### Configuracion jwt
Ejecutar el comando ```bash openssl rand -hex 64 ```. Pegar el resultado en la variable `SECRET_KEY` dentro del archivo *env.yaml*

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
  --region=us-central1 \
  --trigger-http \
  --allow-unaunthenticated \
  --env-vars-file=env.yaml \
  --max-instances=2 \
  --timeout=60s \
  --entry-point=geocode \
  --source=. \
  --project=prueba-domina \
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
