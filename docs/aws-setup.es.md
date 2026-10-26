# Desplegar DocuIA en AWS

> Versión en español de [`aws-setup.md`](aws-setup.md). Si cambias una, actualiza la otra.

Esta guía lleva una cuenta nueva de AWS hasta tener la API de DocuIA funcionando en Lambda. Todo
lo que crea cabe en la capa gratuita de AWS; el único costo real es la API de OpenAI. Léela
completa una vez antes de empezar.

Qué se crea (ver `docs/specs/006-aws-deployment/design.md`):

- Dos funciones Lambda (API y worker), arm64, sin VPC.
- Una Function URL para la API (HTTPS, con respuestas en streaming).
- Un bucket de S3, una cola SQS con su cola de mensajes fallidos (DLQ) y tres tablas de DynamoDB.
- Dos grupos de logs en CloudWatch (se guardan 7 días).

> **La URL de la API es pública hasta que se agregue autenticación (spec 007).** Cualquiera que
> la tenga puede subir documentos y gastar tu saldo de OpenAI. No la compartas, pon un límite de
> gasto en OpenAI (paso 4) y ejecuta `npm run destroy` cuando termine la demo.

## 1. Crear la cuenta

1. Regístrate en <https://aws.amazon.com/free> y elige el **Free plan** (créditos, sin cobros
   mientras duren).
2. Entra como usuario raíz (root) y activa **MFA** para él (IAM → Security credentials →
   Multi-factor authentication). Usa el usuario raíz solo para tareas de la cuenta.
3. **No** actives AWS Organizations ni IAM Identity Center: pueden pasar la cuenta al plan de
   pago.
4. En la consola, elige la región **US East (N. Virginia) `us-east-1`** (arriba a la derecha).
   DocuIA se despliega ahí por defecto.

## 2. Alertas de presupuesto (antes de crear cualquier otra cosa)

1. Billing and Cost Management → **Budgets** → **Create budget** → **Use a template** →
   **Zero spend budget**. Escribe tu correo. Te avisa en cuanto algo cueste dinero.
2. Crea un segundo presupuesto con la plantilla **Monthly cost budget** por **5 USD**, para
   recibir una alerta al llegar al 80 % de un límite pequeño y fijo.

## 3. Un usuario para el trabajo diario

1. IAM → Users → **Create user** `docuia-admin`, con acceso a la consola.
2. Asígnale las políticas **AdministratorAccess** (CDK necesita crear roles y recursos) y
   **SignInLocalDevelopmentAccess** (permite que la CLI use tu inicio de sesión de la consola).
3. Cierra sesión, entra como `docuia-admin` y activa MFA también para él.

## 4. Límite de gasto en OpenAI

En el panel de OpenAI, pon un presupuesto mensual (por ejemplo, 5 USD) al proyecto cuya key usa
DocuIA.

## 5. Herramientas en tu equipo

- **AWS CLI v2.32 o más nueva**: <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>.
  Compruébalo con `aws --version`.
- **Docker Desktop** abierto (el paquete de las Lambdas se comprime dentro de un contenedor
  Linux).
- Node.js 24 (ya lo usa el proyecto).

Inicia sesión desde la CLI con tu usuario de la consola; no se crean ni se guardan access keys:

```powershell
aws login                     # abre el navegador; las credenciales duran hasta 12 horas
aws sts get-caller-identity   # debe mostrar el usuario docuia-admin
```

## 6. Preparar CDK (una vez por cuenta y región)

`cdk bootstrap` crea un stack pequeño llamado `CDKToolkit` (un bucket de S3 y roles de IAM) que
CDK usa para subir el paquete de las Lambdas.

Todos los comandos de `cdk`, incluido `bootstrap`, leen la app de CDK, y la app necesita la key
de OpenAI y el paquete de las Lambdas. La key se lee de tu terminal, nunca del repositorio; esta
línea la toma del `.env` local de la API sin que la escribas (así no queda en el historial de
PowerShell). Solo existe en esa ventana: si la cierras, defínela otra vez.

```powershell
cd infra
npm ci
$env:OPENAI_API_KEY = ((Get-Content ..\.env | Select-String '^OPENAI_API_KEY=').Line -split '=', 2)[1]
npm run package:lambda
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

`<ACCOUNT_ID>` es el valor `Account` que muestra `aws sts get-caller-identity`.

## 7. Desplegar

En la misma terminal del paso 6 (con `OPENAI_API_KEY` definida):

```powershell
# Opcional: el origen del cliente web, si no es http://localhost:4200
# $env:DOCUIA_CORS_ORIGIN = 'https://tu-cliente-web'
npm run deploy
```

`npm run deploy` compila la API, la empaqueta (`scripts/package-lambda.mjs`), compila el stack y
ejecuta `cdk deploy`. CDK muestra los cambios de permisos (IAM) y pide confirmación. Al final
imprime estas salidas:

- `ApiUrl`: la URL pública de la API.
- `ApiLogGroup` y `WorkerLogGroup`: los grupos de logs en CloudWatch.
- `DeadLetterQueueUrl`: los mensajes que fallaron en todos sus intentos.

## 8. Comprobar que funciona

```powershell
$api = '<ApiUrl sin la barra final>'
curl.exe "$api/health"
curl.exe -F "file=@..\..\docs\documentos-prueba\1-factura-electronica.pdf" "$api/documents"
curl.exe "$api/documents?limit=5"
aws logs tail <WorkerLogGroup> --follow
```

Para usar el cliente web contra AWS, pon la `ApiUrl` en `apiBaseUrl` dentro de
`docuia-web/src/environments`. Los eventos en vivo están apagados en AWS
(`GET /documents/events` responde `503`), así que el cliente web consulta el estado con polling.

Para revisar el costo: Billing and Cost Management → **Free tier** muestra el uso de cada
servicio.

## 9. Actualizar o eliminar

- Desplegar de nuevo después de cambios: `npm run deploy`.
- Eliminar todo: `npm run destroy`. El bucket de S3 y las tablas de DynamoDB **se conservan** a
  propósito, para no perder datos por accidente. Bórralos cuando ya no los necesites:

  ```powershell
  aws s3 rm s3://<nombre-del-bucket> --recursive
  aws s3 rb s3://<nombre-del-bucket>
  aws dynamodb delete-table --table-name <nombre-de-la-tabla>   # una vez por tabla
  ```

  Los nombres están en CloudFormation → `DocuiaStack` → Resources (antes de destruir el stack)
  o en las consolas de S3 y DynamoDB.

- El stack `CDKToolkit` puede quedarse; bórralo desde CloudFormation solo si dejas de usar CDK
  en esta cuenta.

## Problemas comunes

| Síntoma                                         | Causa y solución                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Lambda package not found`                      | Ejecuta `npm run package:lambda` (o `npm run deploy`, que lo incluye).                          |
| `OPENAI_API_KEY is not set`                     | Defínela en la misma terminal (paso 7) antes de los comandos de `cdk`.                          |
| `docker: ... cannot connect`                    | Abre Docker Desktop.                                                                            |
| `The Lambda package is ... MB`                  | Creció una dependencia; revisa `npm ls --omit=dev` por paquetes que deberían ser de desarrollo. |
| `ExpiredToken` o `Unable to locate credentials` | Ejecuta `aws login` otra vez (la sesión dura hasta 12 horas).                                   |
| La subida responde `413`                        | En AWS los archivos tienen un límite de 5 MB (límite de petición de la Function URL).           |
