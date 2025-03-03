#! /bin/bash

gcloud functions deploy geocode \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file=env.yaml \
  --max-instances=2 \
  --timeout=60s \
  --entry-point=geocode \
  --source=. \
  --project=prueba-domina \
  --concurrency=2 \
  --memory=256Mib \
  --cpu=1
