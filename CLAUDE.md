# DocuIA API — reglas para Claude

API en NestJS que recibe documentos (facturas, contratos, hojas de vida), los procesa en segundo plano y usa un LLM con tool calling para extraer datos y responder preguntas sobre ellos. Es un proyecto de portafolio: el código debe verse como el de un equipo profesional.

## Cómo trabajar conmigo

- Respóndeme siempre en español.
- Estoy aprendiendo IA aplicada, colas y AWS: cuando uses un concepto nuevo, explícalo en una o dos líneas.
- Haz cambios pequeños y enfocados en lo que pedí; no reescribas archivos que no tienen que ver con la tarea.
- Pregúntame antes de agregar una dependencia nueva y dime para qué sirve.
- Antes de dar una tarea por terminada, corre el lint, los tests y el build, y dime si algo falla.

## Idioma del código

- Código, nombres de variables, funciones, clases y archivos: en inglés.
- Comentarios, README y mensajes de commit: en inglés (el proyecto es para portafolio internacional).
- Commits con Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Stack y versiones

- Node.js 24 LTS (ver `.nvmrc`), npm.
- NestJS 12 con ES Modules (ESM) y TypeScript 6.0 en modo estricto. No actualizar a TypeScript 7.
- Tests con Vitest.
- Colas: BullMQ sobre Redis en local; Amazon SQS en AWS.
- Datos: MongoDB en local (Docker); DynamoDB en AWS.
- IA: SDK de OpenAI y de Anthropic, Zod para validar respuestas, LangGraph.js para el agente. Ollama para desarrollo local sin costo.
- AWS (solo capa gratuita): Lambda + API Gateway, S3, SQS, DynamoDB, CloudWatch.

## Comandos

Revisa `package.json` si alguno cambia.

- `npm run start:dev` — servidor en modo desarrollo.
- `npm run lint` — ESLint.
- `npm run test` — tests unitarios con Vitest.
- `npm run test:e2e` — tests end-to-end.
- `npm run build` — compilación.
- `docker compose up -d` — levanta MongoDB y Redis en local.

## Arquitectura

- Un módulo por funcionalidad en `src/`: `documents`, `processing` (worker y colas), `ai` (LLM, herramientas y agente), `storage`, `auth`, `config`.
- Flujo por capas: controller → service → repository. Los controllers solo validan la entrada y delegan; la lógica va en los services.
- Todo lo que cambia entre local y AWS va detrás de una interfaz inyectable, con una implementación por entorno:
  - `StorageProvider`: disco local / S3.
  - `QueueProvider`: BullMQ / SQS.
  - `DocumentRepository`: MongoDB / DynamoDB.
  - `LlmProvider`: Ollama / OpenAI / Anthropic.
    La implementación se elige por configuración, nunca con `if` repartidos por el código.
- La API nunca procesa documentos dentro de la petición HTTP: guarda el archivo, encola el trabajo y responde. El worker hace lo pesado.
- Estados de un documento: `pending` → `processing` → `ready` | `failed`.

## Calidad de código

- Principio de responsabilidad única: cada clase, función y módulo hace una sola cosa. Si para describir lo que hace necesitas decir "y", divídelo.
- Aplica SOLID, sobre todo inversión de dependencias: los services dependen de interfaces inyectadas, no de implementaciones concretas.
- Nada de código espagueti:
  - Funciones cortas (como guía, menos de 30 líneas); si crecen, extrae funciones con nombres claros.
  - Máximo dos niveles de anidación; usa retornos tempranos (guard clauses) en vez de `if` dentro de `if`.
  - Sin lógica duplicada: si algo se repite, extráelo a una función o un servicio compartido.
  - Sin números ni textos mágicos: van en constantes con nombre o en la configuración.
  - Sin dependencias circulares entre módulos.
- Prefiere código claro antes que código ingenioso. Si algo no se entiende al leerlo, renómbralo o divídelo antes de agregar un comentario.
- No dejes código comentado, `console.log` ni `TODO` sin explicación.

## Nombres

- `camelCase`: variables, funciones, métodos y propiedades (`documentId`, `extractInvoiceData`).
- `PascalCase`: clases, interfaces, tipos, enums y decoradores (`DocumentsService`, `LlmProvider`).
- `UPPER_SNAKE_CASE`: constantes globales y variables de entorno (`MAX_AGENT_ITERATIONS`, `OPENAI_API_KEY`).
- `kebab-case` con el sufijo de NestJS para los archivos (`documents.service.ts`, `create-document.dto.ts`, `llm.provider.ts`).
- Nombres descriptivos: nada de `data`, `temp`, `x` ni abreviaturas raras. Los booleanos empiezan con `is`, `has` o `can` (`isProcessed`).
- Las interfaces no llevan el prefijo `I` (`LlmProvider`, no `ILlmProvider`).
- ESLint y Prettier son la referencia final: el código debe pasar `npm run lint` sin errores ni advertencias.

## Convenciones de código

- TypeScript estricto: nada de `any`; si de verdad hace falta, usa `unknown` y valida.
- ESM: en las importaciones relativas usa la extensión `.js` si el `tsconfig` está en `NodeNext`.
- DTOs con `class-validator` y `class-transformer` para toda entrada de la API.
- Configuración con `@nestjs/config` y variables validadas al arrancar; nunca leer `process.env` directamente en los services.
- Errores con las excepciones de NestJS (`NotFoundException`, `BadRequestException`, etc.) y un filtro global; nunca devolver stack traces al cliente.
- Logs con el `Logger` de NestJS, en formato estructurado, incluyendo el id del documento cuando aplique.
- Documentar cada endpoint con decoradores de Swagger.

## Reglas para la parte de IA

- Toda respuesta del LLM se valida con un esquema de Zod antes de usarla o guardarla. Si no pasa la validación, se reintenta una vez y luego se marca el documento como `failed`.
- Los prompts van en archivos propios dentro de `src/ai/prompts/`, no escritos en medio de la lógica.
- Las herramientas (tools) que puede llamar el modelo viven en `src/ai/tools/`, cada una con su esquema de entrada y tests.
- El agente tiene un límite de iteraciones (por defecto 5) para que un bucle no dispare el costo.
- Usa por defecto el modelo económico (Claude Haiku o GPT-6 Luna); el modelo intermedio solo si se pide de forma explícita.
- En los tests, el LLM siempre va mockeado; ningún test llama a una API de pago.

## Tests

- Cada service y cada tool tiene tests unitarios con Vitest.
- Los endpoints principales tienen tests e2e.
- Cuando arregles un bug, agrega primero un test que lo reproduzca.

## Seguridad y costos

- Nunca escribas API keys, contraseñas ni tokens en el código. Van en `.env`, que no se sube al repositorio; mantén actualizado `.env.example` con las variables (sin valores reales).
- Autenticación con JWT en todos los endpoints excepto el de salud (`/health`).
- Límite de tamaño y de tipo de archivo en la subida (solo PDF e imágenes).
- AWS: usa solo servicios de la capa gratuita. No propongas ECS Fargate, RDS, NAT Gateway ni otros servicios de pago sin avisarme antes del costo.
