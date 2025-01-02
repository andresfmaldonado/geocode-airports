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

## Instalación y despliegue

### Configuración de gcloud

```bash
gcloud auth login
gcloud config set project [ID_DEL_PROYECTO]
```

### Despliegue de la Cloud Function

### Prueba de la Cloud Function

```bash
curl -X GET \ 
  -H "Authorization: Bearer [TOKEN]" \
  "https://us-central1/prueba-domina/geocode?airportId=1"
```
