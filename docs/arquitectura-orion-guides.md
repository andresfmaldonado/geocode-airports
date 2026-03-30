# Documento de Arquitectura: Transmisión de Estados de Guías de Paqueteo – ORION

## 1. Introducción

Este documento describe la arquitectura de la funcionalidad implementada en la aplicación **ORION** para la transmisión de movimientos de estado de guías de paqueteo hacia sistemas externos de clientes. En la fase inicial, esta funcionalidad aplica para el cliente **Helpharma** con el producto **Farmacia Simple**.

---

## 2. Contexto y Alcance

ORION es la plataforma principal de gestión logística. En ella se crean guías de envío y se registran todos los movimientos de estado asociados a cada guía. Esta funcionalidad extiende ORION para:

1. **Detectar** movimientos de estado de guías de paqueteo pertenecientes a clientes y productos específicos.
2. **Procesar** la información y publicarla de forma asíncrona en Google Cloud Pub/Sub.
3. **Transmitir** los estados al sistema externo del cliente, usando una parametrización dinámica almacenada en MongoDB.
4. **Registrar** el resultado de cada transmisión y gestionar reintentos automáticos ante fallos.

---

## 3. Arquitectura General

### 3.1 Diagrama de flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BASE DE DATOS ORION                         │
│  (PostgreSQL – Tablas: guías, estados, envios_comp, ...)            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  Consulta periódica de movimientos
                               │  (cliente: helpharma, producto: farmacia simple)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SERVICIO NODE.JS (Pre-existente, modificado)           │
│                                                                     │
│  1. Consulta guías de paqueteo según cliente y producto             │
│  2. Procesa campo de órdenes (envios_comp):                         │
│     ├─ Si el campo contiene un solo valor → 1 registro              │
│     └─ Si contiene valores concatenados con "-" → N registros       │
│  3. Publica cada registro en Pub/Sub de forma asíncrona             │
│  4. Ante error: escribe en GCP Cloud Logging                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  Publicación de mensaje
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       GOOGLE CLOUD PUB/SUB                          │
│         (Cola asíncrona de mensajes – un mensaje por orden)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  Trigger (suscripción Push / Pull)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GCP WORKFLOWS (Orquestador)                     │
│                                                                     │
│  Paso 1 ──► delivery-strategy-service  (Cloud Run)                  │
│  Paso 2 ──► authenticate-service       (Cloud Run)                  │
│  Paso 3 ──► transform-data             (Cloud Run)                  │
│  Paso 4 ──► [Llamada HTTP al endpoint del cliente]                  │
│  Paso 5 ──► mark-tracking              (Cloud Run)                  │
│                                                                     │
│  ↳ Si falla cualquier paso → mark-tracking actualiza reintentos     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐   ┌──────────────────┐  ┌───────────────────┐
    │  MongoDB    │   │ Sistema externo  │  │  PostgreSQL       │
    │ (Parámetros)│   │ del cliente      │  │ (marca resultado) │
    └─────────────┘   └──────────────────┘  └───────────────────┘
```

---

## 4. Descripción de Componentes

### 4.1 Base de Datos ORION (PostgreSQL)

- **Función:** Almacena las guías de envío y todos sus movimientos de estado.
- **Tablas relevantes:**
  - `guias`: Información principal de cada guía.
  - `estados`: Historial de movimientos de estado.
  - `envios_comp`: Detalle de órdenes asociadas a cada envío. Contiene el campo `ordenes` que puede tener uno o varios valores concatenados con guión (`-`).
- **Campos de control de transmisión:**
  - `estado_transmision`: Indica el estado actual del proceso de envío al cliente externo.
  - `reintentos`: Contador de intentos fallidos. Cuando alcanza el valor **4**, el registro deja de ser tomado por la consulta inicial.

---

### 4.2 Servicio NodeJS

- **Tipo:** Cloud Function / Servicio Node.js pre-existente, modificado para soportar paqueteo.
- **Responsabilidades:**
  1. Consultar la base de datos ORION para obtener los movimientos de estado de guías de paqueteo del cliente **Helpharma** con el producto **Farmacia Simple**.
  2. Filtrar los registros aptos para transmisión (excluyendo registros con `reintentos >= 4`).
  3. Ejecutar el procesamiento del campo de órdenes de `envios_comp` (ver sección 5).
  4. Publicar cada registro resultante en **Google Cloud Pub/Sub** de forma asíncrona.
  5. Registrar cualquier error en **GCP Cloud Logging**.

---

### 4.3 Google Cloud Pub/Sub

- **Función:** Canal de mensajería asíncrona entre el servicio NodeJS y el orquestador GCP Workflows.
- **Garantías:** Entrega al menos una vez; permite desacoplar la velocidad de producción de la de consumo.
- **Trigger:** Cada mensaje publicado desencadena la ejecución de un **GCP Workflow**.

---

### 4.4 GCP Workflows (Orquestador)

GCP Workflows coordina de forma ordenada los 5 servicios de Cloud Run. Si un paso falla, el flujo salta directamente al paso 5 (`mark-tracking`) para registrar el error y gestionar el reintento.

---

### 4.5 Cloud Run – `delivery-strategy-service`

- **Función:** Obtener desde **MongoDB** la parametrización necesaria para construir y enviar la petición al sistema externo del cliente.
- **Información que recupera:**
  - **Método de autenticación** requerido por el cliente.
  - **Mapeo de campos:** relación entre los campos propios de ORION y los campos esperados por el cliente en el `body` de la petición.
  - **Configuración del endpoint:** URL, método HTTP (`GET`, `POST`, etc.), cabeceras (`headers`) y tipo de contenido del cuerpo (`application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, etc.).

---

### 4.6 Cloud Run – `authenticate-service`

- **Función:** Consumir el servicio de autenticación configurado en la parametrización (paso anterior) y obtener las credenciales necesarias (token, API key, etc.) para invocar el endpoint de transmisión de estados del cliente.

---

### 4.7 Cloud Run – `transform-data`

- **Función:** Transformar la información obtenida de la base de datos ORION, mapeando cada campo de acuerdo con la parametrización recuperada por `delivery-strategy-service`. El resultado es un objeto listo para ser enviado al cliente.

---

### 4.8 Llamada HTTP al endpoint del cliente

- **Función:** Enviar la petición al sistema externo del cliente utilizando:
  - El tipo de petición HTTP configurado (`GET`, `POST`, `PUT`, etc.).
  - El tipo de cuerpo (`application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, parámetros de query, etc.).
  - Los cabeceras (`headers`) configurados.
  - Las credenciales obtenidas por `authenticate-service`.
- **Nota:** Este paso es ejecutado directamente por GCP Workflows como una llamada HTTP nativa, sin necesidad de un servicio Cloud Run dedicado.

---

### 4.9 Cloud Run – `mark-tracking`

- **Función:** Actualizar en la base de datos **PostgreSQL** el resultado del intento de transmisión.
- **Escenarios:**
  - **Éxito:** Marca el registro como transmitido correctamente (`estado_transmision = exitoso`).
  - **Fallo (reintentos < 4):** Incrementa el contador `reintentos` y actualiza `estado_transmision` para que el registro sea tomado nuevamente en la próxima consulta del servicio NodeJS.
  - **Fallo (reintentos = 4):** El registro queda marcado como fallido de forma definitiva y **no es retomado** por la consulta inicial.

---

## 5. Procesamiento Especial del Campo de Órdenes (`envios_comp`)

El campo `ordenes` en la tabla `envios_comp` puede contener uno o múltiples valores concatenados con el carácter guión (`-`). El servicio NodeJS aplica la siguiente lógica:

```
Campo `ordenes` leído desde envios_comp
        │
        ▼
¿Contiene guión "-"?
   ├── NO  → Se genera 1 registro y se publica en Pub/Sub
   └── SÍ  → Se divide por "-" → se genera 1 registro por cada valor
              y se publica 1 mensaje en Pub/Sub por cada registro
```

**Ejemplo:**

| Valor en `envios_comp.ordenes` | Registros publicados en Pub/Sub |
|------------------------|--------------------------------|
| `ORD-001`              | 1 (`ORD-001`)                  |
| `ORD-001-ORD-002`      | 2 (`ORD-001`, `ORD-002`)       |
| `ORD-001-ORD-002-ORD-003` | 3 (`ORD-001`, `ORD-002`, `ORD-003`) |

---

## 6. Manejo de Errores y Reintentos

### 6.1 Errores en el Servicio NodeJS

- Si ocurre un error al consultar la base de datos o al publicar en Pub/Sub, se registra el detalle completo del error en **GCP Cloud Logging**.
- El procesamiento continúa con los demás registros disponibles.

### 6.2 Errores en GCP Workflows

Si cualquiera de los pasos 1 al 4 del Workflow falla, el flujo **siempre ejecuta el paso 5** (`mark-tracking`) para garantizar la actualización del estado del registro:

```
Paso 1 (delivery-strategy-service)
       │
       ▼ (fallo en cualquier paso)
Paso 2 (authenticate-service) ────────────────────────┐
       │                                               │
       ▼                                               │
Paso 3 (transform-data) ──────────────────────────────┤
       │                                               │
       ▼                                               │
Paso 4 (HTTP call) ────────────────────────────────── │
       │                                               │
       └───────────────────────────────────────────────┘
                               │
                               ▼
               Paso 5: mark-tracking
               ├── Éxito previo: estado_transmision = OK
               └── Fallo: estado_transmision = ERROR
                           reintentos += 1
```

### 6.3 Lógica de Reintentos

| `reintentos` | Acción del servicio NodeJS en la próxima consulta |
|:---:|---|
| 0, 1, 2, 3 | El registro **sí** es tomado para transmisión |
| 4 | El registro **NO** es tomado; queda marcado como fallo definitivo |

---

## 7. Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Base de datos principal (ORION) | PostgreSQL |
| Servicio de lectura y publicación | Node.js |
| Cola de mensajes | Google Cloud Pub/Sub |
| Orquestador | Google Cloud Workflows |
| Servicios de procesamiento | Google Cloud Run (x5) |
| Base de datos de parametrización | MongoDB |
| Base de datos de seguimiento | PostgreSQL |
| Logging de errores | Google Cloud Logging |

---

## 8. Consideraciones de Seguridad y Operación

- **Idempotencia:** Cada mensaje en Pub/Sub debe ser procesado una sola vez. El campo `estado_transmision` junto con `reintentos` actúa como mecanismo de control.
- **Desacoplamiento:** El uso de Pub/Sub desacopla el servicio de lectura del orquestador, permitiendo escalar cada componente de forma independiente.
- **Observabilidad:** Los errores en todos los componentes deben quedar registrados en **GCP Cloud Logging** para facilitar el diagnóstico y alertas.
- **Límite de reintentos:** El valor máximo de 4 reintentos evita que registros con errores permanentes (p. ej. datos inválidos rechazados por el cliente) consuman recursos indefinidamente.
- **Parametrización dinámica:** El uso de MongoDB para almacenar la configuración de cada cliente permite onboardear nuevos clientes sin modificar el código fuente de los servicios.
