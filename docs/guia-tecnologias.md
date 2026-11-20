# Guía de tecnologías del TP: qué usamos, qué no y por qué

Guía para defender el TP ante preguntas del tipo "¿qué ORM usan?", "¿por qué Mongo?" o "¿por qué no usaron X?".
Todo lo que dice acá sale del código del repo, con el archivo donde verlo.

---

## 1. Respuesta corta (para memorizar)

> **No usamos ORM.** Usamos **MongoDB Atlas** con el **driver oficial `mongodb`** (versión 7) y armamos a mano una
> **capa de repositorios** (patrón *Repository*): una clase por entidad (`ProductRepository`, `OrderRepository`, …)
> que implementa la interfaz `Repository<T>` y es la única que habla con la base. Las entidades son clases de
> TypeScript, la validación la hacemos en los controladores y las transacciones (checkout y pago) las abrimos
> nosotros con `withTransaction` del driver.

Si te repreguntan "¿y por qué no un ORM?":

> Porque MongoDB no es relacional: no hay tablas que "mapear" a objetos, los documentos ya son casi objetos JSON.
> El driver alcanza para todo lo que necesita el TP y nos deja ver y controlar cada consulta (índices, `$inc`
> atómico del stock, transacciones). A cambio, hacemos a mano cosas que un ORM/ODM resuelve solo: validar el esquema,
> chequear que existan las referencias y convertir los ids.

---

## 2. ¿Qué es un ORM?

**ORM = Object-Relational Mapping** (mapeo objeto-relacional). Es una biblioteca que hace de traductor entre:

- el mundo de la **programación orientada a objetos** (clases, objetos, atributos, referencias entre objetos), y
- el mundo de una **base de datos relacional** (tablas, filas, columnas, claves foráneas, SQL).

Ese "choque" entre los dos mundos se llama **desajuste de impedancia objeto-relacional** (*object-relational
impedance mismatch*): un objeto `Pedido` con una lista de `Items` adentro no entra directo en una tabla; hay que
partirlo en dos tablas con una clave foránea y volver a armarlo al leer.

### Qué hace un ORM por vos

| Función | Qué significa | Ejemplo |
|---|---|---|
| **Mapeo** | Una clase = una tabla, un atributo = una columna | `@Entity() class Product { @Property() name }` |
| **Generar SQL** | Escribís `repo.find({ price: { $gt: 100 } })` y él arma el `SELECT` | No escribís SQL a mano |
| **Relaciones** | Carga los objetos relacionados (`product.category.name`) | `@ManyToOne`, `populate`, *lazy/eager loading* |
| **Unit of Work** | Junta los cambios y los manda todos juntos con `flush()` | MikroORM, Hibernate |
| **Identity Map** | Si pedís dos veces el mismo registro, te da el mismo objeto | MikroORM |
| **Migraciones** | Versiona los cambios de esquema (agregar columna, etc.) | `migration:create` |
| **Validación / tipos** | Rechaza datos que no cumplen el esquema | Mongoose `required`, `min` |

### ORM vs ODM

- **ORM** → para bases **relacionales** (SQL): MySQL, PostgreSQL, SQLite.
  Ejemplos en Node: **MikroORM**, **TypeORM**, **Prisma**, **Sequelize**, Drizzle.
- **ODM = Object-Document Mapper** → lo mismo pero para bases **de documentos** como MongoDB.
  El ejemplo clásico es **Mongoose**. (MikroORM y Prisma también soportan MongoDB.)

Como nuestra base es MongoDB, lo que "podríamos haber usado" es un **ODM** (Mongoose) o un ORM con soporte de Mongo
(MikroORM, Prisma). No usamos ninguno.

> Ojo: MikroORM es el ORM que suele aparecer en los ejemplos de la materia, así que es probable que la pregunta venga
> por ahí. La respuesta es la de arriba: lo reemplazamos con el driver + repositorios.

---

## 3. Qué usamos en lugar del ORM

### 3.1 La conexión: `src/shared/db/conn.ts`

```ts
export const cli = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } })
await cli.connect()
export const db: Db = cli.db(dbName)   // "tienda" por defecto, "tienda_test" en los tests
```

- `MongoClient` es la clase del **driver oficial** que abre un *pool* de conexiones a Atlas.
- `MONGODB_URI` y `MONGODB_DB` salen del `.env`.
- Se exporta `cli` (el cliente) porque hace falta para abrir **transacciones**, y `db` para pedir colecciones.
- `DNS_SERVERS` es un parche opcional: las URI `mongodb+srv://` necesitan resolver registros DNS **SRV**, y algunas
  redes no lo hacen (error `querySrv ECONNREFUSED`).

### 3.2 El patrón Repository: `src/shared/repository.ts`

```ts
export interface Repository<T> {
  findAll(): Promise<T[] | undefined>
  findOne(item: { id: string }): Promise<T | undefined>
  add(item: T): Promise<T | undefined>
  update(id: string, item: T): Promise<T | undefined>
  delete(item: { id: string }): Promise<T | undefined>
}
```

Cada entidad tiene su `xxx.Repository.ts` que **implementa** esta interfaz. Ejemplo real
(`src/product/product.Repository.ts`):

```ts
const products = db.collection<Product>('products')
await products.createIndex({ categoryId: 1 })

export class ProductRepository implements Repository<Product> {
  public async findOne(item: { id: string }) {
    return (await products.findOne({ _id: new ObjectId(item.id) })) || undefined
  }
  public async update(id: string, item: Product) {
    return (await products.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: item }, { returnDocument: 'after' })) || undefined
  }
  // ...
}
```

**¿Qué es el patrón Repository?** Una capa que **aísla el acceso a datos**: el resto del sistema le pide
"dame el producto 123" sin saber si atrás hay Mongo, SQL o un archivo. Si mañana cambiamos de base, se reescriben
los repositorios y los controladores no se tocan. Es lo que en un ORM te dan hecho (`em.getRepository(Product)`).

### 3.3 Las entidades: `src/<entidad>/<entidad>.entity.ts`

Son **clases de TypeScript comunes**, sin decoradores de ORM:

```ts
export class Product {
  declare rating?: { average: number; count: number }
  constructor(public name: string, public price: number, public stock: number,
              public categoryId: ObjectId, public slug: string, public _id?: ObjectId /* ... */) {}
}
```

- El tipo sirve para que TypeScript controle el código (`db.collection<Product>`), **pero MongoDB no lo hace cumplir**:
  Mongo es *schemaless* (sin esquema), acepta cualquier documento.
- `declare` evita que el constructor cree el campo vacío (Mongo lo guardaría como `null`).

### 3.4 El recorrido de un pedido HTTP (capas)

```
cliente (React)
  → Express: ruta              src/product/product.routes.ts
  → middleware authenticate    src/auth/auth.ts        (¿token válido?)
  → middleware requireRole     src/auth/auth.ts        (¿es admin?)
  → sanitizeProductInput       product.controller.ts   (se queda solo con los campos permitidos)
  → controlador add/update     product.controller.ts   (valida tipos, rangos, que exista la categoría)
  → ProductRepository          product.Repository.ts   (única capa que toca la base)
  → driver mongodb             → MongoDB Atlas
```

---

## 4. Lo que haría un ORM y cómo lo resolvemos nosotros

| Lo que haría un ORM/ODM | Cómo lo hacemos sin él | Dónde |
|---|---|---|
| Validar el esquema (`required`, `min`, tipos) | Funciones `validateForCreate` / `validateForUpdate` en cada controlador | `src/*/*.controller.ts` |
| Proteger de *mass assignment* | Middleware `sanitizeXxxInput`: copia solo los campos permitidos a `req.body.sanitizedInput` | controladores |
| Relaciones (`@ManyToOne`, `populate`) | Guardamos el `ObjectId` de la otra entidad (`categoryId`, `userId`, `orderId`) y lo buscamos a mano | entidades y controladores |
| Integridad referencial (FK) | Chequeo en el controlador: no se crea un producto con categoría inexistente, no se borra una categoría con productos o descuentos | `category.controller.ts`, `product.controller.ts` |
| Conversión de ids | `parseObjectId`: valida que sea un hex de 24 caracteres y devuelve `ObjectId` o `null` (evita el error 500 con ids basura) | `src/shared/objectId.ts` |
| Índices / restricciones `unique` | `createIndex` al cargar cada repositorio: email único, una reseña por usuario y producto | `user.Repository.ts`, `review.Repository.ts` |
| Transacciones / Unit of Work | `cli.withSession(s => s.withTransaction(...))`: el checkout crea pedido + ítems "todo o nada"; al pagar se descuenta el stock de todos los ítems o de ninguno | `src/order/order.Repository.ts` |
| Campos calculados | Pipelines de **agregación** (`$match` + `$group`) para el total del pedido y el promedio de reseñas, guardados en el documento | `order.Repository.ts`, `review.Repository.ts` |
| Migraciones | No hay. Como Mongo no tiene esquema, los campos nuevos se agregan sin migrar; el `seed` completa lo que falta (ej. `slug`) | `src/shared/db/seed.ts` |
| Concurrencia (*optimistic locking*) | Actualizaciones **condicionales y atómicas**: `updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })` y `findOneAndUpdate({ _id, status: from }, ...)`. Si dos pagos llegan juntos, gana uno solo | `order.Repository.ts` |

### Ventajas de no usar ORM (en este TP)

- **Menos dependencias** y menos "magia": cada consulta se ve tal cual llega a la base.
- **Control fino**: `$inc` atómico, filtros condicionales, índices y transacciones explícitas.
- Nada que aprender aparte del propio Mongo; el driver oficial siempre está al día con las funciones de la base.
- Rendimiento: no hay capa de traducción ni *identity map* en el medio.

### Desventajas (reconocelas si te las marcan)

- **Más código repetido** (*boilerplate*): cada repositorio repite el mismo CRUD.
- **Validación a mano** en cada controlador; un ODM como Mongoose la declara en el esquema.
- **Relaciones a mano**: no hay `populate`; si querés el nombre de la categoría de un producto, hacés otra consulta.
- **La base no impone esquema**: si un bug guarda un campo mal, Mongo lo acepta. (Se podría agregar validación
  `$jsonSchema` en la colección; no la usamos.)
- Sin migraciones versionadas.

---

## 5. La base de datos: MongoDB Atlas

### Conceptos que te pueden pedir

| Concepto | Qué es | Equivalente SQL |
|---|---|---|
| **Base NoSQL documental** | Guarda **documentos** tipo JSON en vez de filas | — |
| **Documento** | Un registro, en formato **BSON** (JSON binario con más tipos: `ObjectId`, `Date`) | fila |
| **Colección** | Conjunto de documentos | tabla |
| **`_id` / `ObjectId`** | Clave primaria; 12 bytes (24 caracteres hex) que incluyen la fecha de creación | `PRIMARY KEY` |
| **Referencia** | Guardar el `_id` de otro documento (`categoryId`) | clave foránea (pero sin `FOREIGN KEY` que la controle) |
| **Embeber** | Meter un documento dentro de otro (`rating: { average, count }` dentro del producto) | — |
| **Índice** | Estructura para buscar rápido por un campo | índice |
| **Agregación** | Pipeline de etapas (`$match`, `$group`, `$sum`) | `WHERE` + `GROUP BY` |
| **Replica set** | Varios servidores con copias de los datos; **necesario para las transacciones** (Atlas ya viene así) | — |
| **Atlas** | MongoDB "como servicio" en la nube (*DBaaS*): no instalamos ni mantenemos el servidor | — |

### Colecciones del TP

`users`, `categories`, `products`, `discounts`, `orders`, `orderItems`, `reviews`.

### Decisiones de modelado

- **Ítems del pedido en colección propia** (`orderItems`) y no embebidos en el pedido. En Mongo lo idiomático sería
  embeberlos, pero el modelo de dominio del TP los presenta como entidad propia. Para no sumar los ítems en cada
  lectura, el pedido guarda su `total` (patrón *computed*). Está documentado en
  `docs/adr/0001-items-de-pedido-en-coleccion-propia.md`.
- **Precio congelado** en el ítem (`unitPrice`, `subtotal`): si mañana cambia el precio del producto, el pedido viejo
  no cambia. Se aplica el mayor descuento vigente al momento de comprar.
- **Promedio de reseñas embebido** en el producto (`rating`), recalculado con una agregación al crear/borrar reseñas.

### ¿Por qué Mongo y no una base relacional (MySQL/PostgreSQL)?

Respuesta honesta: Atlas tiene plan gratis, no hay que instalar nada y los documentos JSON encajan directo con una
API REST en JavaScript. **Costo**: las relaciones y la integridad referencial las controlamos nosotros en el código
(una base relacional las impone con claves foráneas). Para un modelo como el nuestro, con muchas relaciones
(pedido–ítem–producto–categoría), SQL también hubiera sido una buena opción.

---

## 6. El stack completo

### Backend (`/src`)

| Tecnología | Versión | Para qué | Alternativa que NO usamos |
|---|---|---|---|
| **Node.js** | 24 (`.nvmrc`) | Ejecuta JavaScript del lado del servidor | Deno, Bun |
| **TypeScript** | 7 | Tipos estáticos; se compila a JS con `tsc` a `/dist` | JavaScript puro |
| **ES Modules** | `"type": "module"` | `import`/`export` nativos; por eso los imports terminan en `.js` | CommonJS (`require`) |
| **Express** | 5 | Framework HTTP: rutas, middlewares, API REST | NestJS, Fastify, Koa |
| **mongodb** (driver) | 7 | Acceso a la base | Mongoose, MikroORM, Prisma, TypeORM |
| **jose** | 6 | Firmar y verificar **JWT** (HS256) | `jsonwebtoken` |
| **node:crypto** `scrypt` | nativo | Hashear contraseñas con sal | `bcrypt`, `argon2` |
| **nodemailer** | 10 | Mandar el mail de confirmación por SMTP | SendGrid, Resend |
| **tsc-watch** | 7 | Recompila y reinicia el server al guardar (`npm run start:dev`) | nodemon, ts-node, tsx |
| **`node --env-file=.env`** | nativo | Carga variables de entorno | `dotenv` |
| **node:test** + `node:assert` | nativo | Pruebas de integración (`npm test`) | Jest, Mocha, Vitest, Supertest |
| Archivos **`.http`** | — | Probar cada endpoint a mano con la extensión REST Client de VS Code | Postman, Insomnia |

### Frontend (`/frontend`)

| Tecnología | Versión | Para qué | Alternativa que NO usamos |
|---|---|---|---|
| **React** | 19 | Librería de interfaces por componentes | Angular, Vue, Svelte |
| **Vite** | 8 | Servidor de desarrollo y empaquetador (*bundler*) | Create React App, Webpack |
| **React Router** | 7 | Rutas del lado del cliente (`/productos/:slug`, `/admin`) — es una **SPA** | Next.js (SSR) |
| **TypeScript** | 7 | Tipos de la API compartidos en `frontend/src/api.ts` | — |
| **`fetch`** nativo | — | Llamadas a la API (función `api()` en `api.ts`) | axios |
| **Context API** de React | — | Sesión del usuario y carrito (`session.tsx`) | Redux, Zustand |
| **`localStorage`** | — | Guarda el token y el carrito entre recargas | cookies, `sessionStorage` |
| **CSS plano** con variables (`:root`) | — | Estilos propios en `styles.css` | Tailwind, Bootstrap, Material UI |
| **@fontsource** (Barlow) | 5 | Tipografías empaquetadas, sin pedir a Google Fonts | Google Fonts CDN |
| **Proxy de Vite** | — | `/api` se redirige a `localhost:3000`: mismo origen, **no hace falta CORS** | paquete `cors` |

### Infraestructura

| Qué | Cómo |
|---|---|
| Base de datos | MongoDB Atlas (nube) |
| Control de versiones | Git + GitHub (ramas `Desarrollo` y `main`) |
| Variables de entorno | `.env` (no se sube; hay un `.env.example`) |
| Imágenes de productos | URLs de Unsplash cargadas por el seed |
| Deploy | No está desplegado; corre local (`npm run start:dev` + `npm run dev --prefix frontend`) |

---

## 7. Arquitectura (preguntas de "¿qué tipo de sistema es?")

- **Cliente-servidor**, con **frontend y backend separados**: el backend es una **API REST** que responde JSON y el
  frontend es una **SPA** (*Single Page Application*) que la consume.
- **Monolito** en el backend (una sola app Express), organizado **por módulo de entidad**: cada carpeta
  (`product/`, `order/`, …) tiene `routes`, `controller`, `entity`, `Repository` y `.http`.
- **Arquitectura en capas**: rutas → middlewares → controladores → repositorios → base.
- **REST**: recursos con sustantivos (`/api/products`) y verbos HTTP (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`),
  códigos de estado (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `500`).
- **Autenticación sin estado** (*stateless*): el servidor no guarda sesiones; cada pedido trae el JWT en
  `Authorization: Bearer <token>`.
- **Middleware**: función `(req, res, next)` que corre antes del controlador (auth, roles, sanitizado, parseo de JSON,
  404 y manejador de errores en `src/app.ts`).

---

## 8. Seguridad (lo preguntan mucho)

| Tema | Qué hicimos | Dónde |
|---|---|---|
| Contraseñas | **Nunca en texto plano**: `scrypt` con sal aleatoria de 16 bytes, guardada como `sal:hash` | `src/auth/auth.ts` |
| Comparar contraseñas | `timingSafeEqual`: compara en tiempo constante para no filtrar info por el tiempo de respuesta | `auth.ts` |
| Sesión | **JWT** firmado con HS256 (clave secreta `JWT_SECRET`), vence a las 8 h, lleva el `id` y el `rol` | `auth.ts` |
| Autorización | `authenticate` (401 si no hay token válido) y `requireRole("admin")` (403 si no tiene permiso); `canAccess` para que el cliente solo vea lo suyo | `auth.ts`, rutas |
| Suplantación | El `userId` de pedidos y reseñas **sale del token**, no del body | controladores de order y review |
| *Mass assignment* | `sanitizeXxxInput` descarta campos no permitidos (ej. no podés mandarte `role: "admin"`) | controladores |
| Inyección NoSQL | Se valida el **tipo** de cada campo (`typeof === "string"`), así nadie manda `{ "$gt": "" }` como email | controladores |
| HTML en el mail | Se escapa el nombre del usuario antes de meterlo en el HTML del mail | `src/shared/mailer.ts` |
| Secretos | En `.env`, fuera del repo (`.gitignore`) | — |
| Confirmación de email | Token de un solo uso; sin confirmar, el login devuelve 403 | `src/auth/` |

**Limitación conocida (si te la preguntan):** como el rol viaja dentro del token, si a alguien le cambian el rol o lo
dan de baja, el cambio recién aplica cuando vence el token (8 h). Se resolvería con una lista de revocación o tokens
más cortos con *refresh token*.

---

## 9. Cosas que NO usamos (y qué decir)

| No usamos | Qué es | Por qué no / qué usamos |
|---|---|---|
| **ORM / ODM** (MikroORM, Mongoose, Prisma, TypeORM, Sequelize) | Mapeo objetos ↔ base | Driver `mongodb` + repositorios propios (sección 3) |
| **SQL** (MySQL, PostgreSQL) | Base relacional | MongoDB Atlas |
| **NestJS** | Framework con inyección de dependencias y decoradores | Express, más simple |
| **GraphQL** | Alternativa a REST con un solo endpoint | API REST |
| **Sesiones en servidor / cookies** (`express-session`) | Estado de sesión guardado en el servidor | JWT *stateless* |
| **Passport.js** | Librería de estrategias de login | Middleware propio de ~20 líneas |
| **bcrypt** | Hash de contraseñas | `scrypt`, que viene con Node (sin dependencia nativa) |
| **jsonwebtoken** | JWT | `jose` (moderno, sin dependencias, usa Web Crypto) |
| **dotenv** | Cargar `.env` | `node --env-file` (nativo desde Node 20) |
| **cors** | Permitir pedidos de otro origen | El proxy de Vite deja front y API en el mismo origen |
| **helmet / morgan** | Headers de seguridad / log de pedidos | No incluidos; los errores se loguean con `console.error` |
| **Joi / Zod / class-validator** | Librerías de validación | Validación a mano en cada controlador |
| **Swagger / OpenAPI** | Documentación interactiva de la API | Tabla de endpoints en el README + archivos `.http` |
| **Jest / Mocha / Supertest** | Frameworks de test | `node:test` + `fetch` contra el servidor real |
| **Docker** | Contenedores | Atlas en la nube; nada que levantar local |
| **CI/CD** (GitHub Actions) | Tests y deploy automáticos | Tests a mano con `npm test` |
| **Redis / caché** | Caché en memoria | No hizo falta |
| **WebSockets** | Comunicación en tiempo real | No hay funciones en tiempo real |
| **axios** | Cliente HTTP | `fetch` nativo |
| **Redux / Zustand** | Estado global | Context API de React |
| **Next.js / SSR** | Render del lado del servidor | SPA con Vite + React Router |
| **Tailwind / Bootstrap / MUI** | Frameworks de estilos | CSS propio con variables |
| **Pasarela de pago** (Mercado Pago, Stripe) | Cobro real | El "pago" es un cambio de estado `pendiente → pagado`; el admin puede marcar uno que pagaron por afuera |

---

## 10. Rarezas del código que te pueden señalar

- **`experimentalDecorators` y `emitDecoratorMetadata` en `tsconfig.json`**: son opciones que necesitan los ORM con
  decoradores (MikroORM, TypeORM) para leer `@Entity()` / `@Property()`. **No usamos decoradores en ningún lado**;
  quedaron de la plantilla inicial. Se pueden borrar sin romper nada.
- **`main: "app.js"`** en `package.json`: también es de la plantilla; el punto de entrada real es `dist/app.js`
  (compilado de `src/app.ts`).
- **Los imports terminan en `.js` aunque el archivo sea `.ts`**: con ES Modules, Node busca el archivo compilado, y
  TypeScript no reescribe las extensiones.
- **`req.body ??= {}` en `app.ts`**: en Express 5, si el pedido no trae JSON, `req.body` queda `undefined`; lo dejamos
  en `{}` porque los controladores esperan un objeto.
- **Express 5 vs 4**: en la 5, si un controlador `async` lanza un error, Express lo manda solo al manejador de errores
  (en la 4 había que hacer `try/catch` y `next(err)`).
- **`await` al nivel de módulo** (`await cli.connect()`, `await products.createIndex(...)`): se puede gracias a ES
  Modules (*top-level await*).
- **`slug`**: identificador legible para la URL (`/productos/rtx-4070`), derivado del nombre y único.

---

## 11. Banco de preguntas posibles (con respuesta corta)

**Datos y persistencia**

1. **¿Qué ORM usan?** Ninguno. Driver oficial `mongodb` + patrón Repository.
2. **¿Qué es un ORM?** Una librería que traduce entre objetos del programa y tablas de una base relacional: genera el
   SQL, maneja relaciones, migraciones y validación.
3. **¿Y un ODM?** Lo mismo para bases de documentos (Mongoose para MongoDB).
4. **¿Qué usan como alternativa?** Repositorios propios que implementan `Repository<T>` sobre `db.collection()`.
5. **¿Qué es el patrón Repository?** Una capa que encapsula el acceso a datos; el resto del sistema no sabe qué base
   hay atrás.
6. **¿Qué base usan y por qué?** MongoDB Atlas: documental, en la nube, gratis, JSON nativo.
7. **¿Qué diferencia hay entre SQL y NoSQL?** SQL: tablas con esquema fijo, relaciones con claves foráneas, `JOIN`.
   NoSQL documental: documentos flexibles, se embebe o se referencia, sin `JOIN` nativo (hay `$lookup`).
8. **¿Cómo relacionan las entidades?** Por referencia: guardando el `ObjectId` (ej. `product.categoryId`).
9. **¿Cómo garantizan la integridad referencial?** En el código: validamos que exista la categoría al crear un
   producto y no dejamos borrar una categoría con productos o descuentos.
10. **¿Usan transacciones?** Sí: en el checkout (pedido + ítems) y al pagar (descuento de stock de todos los ítems).
    Con `withSession` + `withTransaction`. Requieren *replica set*, que Atlas ya trae.
11. **¿Cómo evitan vender más stock del que hay?** `updateOne` condicional `stock >= cantidad` con `$inc` negativo; si
    no modifica nada, se aborta la transacción y se revierte todo.
12. **¿Por qué los ítems no están embebidos en el pedido?** Decisión documentada en el ADR 0001: el dominio los define
    como entidad propia; el total se guarda en el pedido.
13. **¿Qué índices tienen?** Email único en usuarios; `(userId, productId)` único en reseñas; por `categoryId`, `slug`,
    `userId`, `orderId` y fechas de descuento para las búsquedas.
14. **¿Tienen migraciones?** No; Mongo no tiene esquema y el seed completa campos nuevos.
15. **¿Cómo cargan datos de prueba?** `npm run seed` (`seed.ts` y `seed-demo.ts`).

**Backend**

16. **¿Qué framework de backend?** Express 5 sobre Node 24 con TypeScript.
17. **¿Qué es un middleware?** Una función que procesa el pedido antes del controlador y llama a `next()`.
18. **¿Cómo validan los datos de entrada?** `sanitize` (lista blanca de campos) + validación de tipos y rangos en el
    controlador.
19. **¿Cómo manejan los errores?** Mensajes con código HTTP en cada controlador, un 404 genérico y un manejador de
    errores global que devuelve 400 si el JSON está mal formado y 500 en el resto.
20. **¿Qué es REST?** Estilo de API con recursos identificados por URL, verbos HTTP y respuestas sin estado.
21. **¿PUT o PATCH?** Las rutas aceptan los dos para modificar; PATCH es la forma correcta para una modificación
    parcial.

**Autenticación**

22. **¿Cómo autentican?** JWT firmado con `jose` (HS256), enviado en `Authorization: Bearer`.
23. **¿Qué es un JWT?** Un token con tres partes en base64 (*header*, *payload*, firma); el servidor verifica la firma
    con su secreto, sin guardar nada.
24. **¿Cómo guardan las contraseñas?** Hash con `scrypt` y sal aleatoria.
25. **¿Por qué hash y no encriptación?** El hash no se puede revertir; para verificar se hashea lo que escribe el
    usuario y se compara.
26. **¿Qué es la sal?** Un valor aleatorio por usuario que hace que dos contraseñas iguales den hashes distintos y
    frena las tablas precalculadas.
27. **¿Cómo manejan roles?** `cliente` y `admin`; el middleware `requireRole` corta con 403.
28. **¿Dónde guarda el token el frontend?** En `localStorage` (riesgo: un XSS podría leerlo; la alternativa es una
    cookie `httpOnly`).

**Frontend**

29. **¿Qué usan en el frontend?** React 19 + Vite 8 + React Router 7, TypeScript.
30. **¿Qué es una SPA?** Una sola página HTML; React cambia la vista sin recargar.
31. **¿Cómo maneja el estado global?** Context API (`SessionProvider`): usuario y carrito.
32. **¿Cómo se comunica con el backend?** `fetch` a `/api/...`; en desarrollo Vite lo redirige a `localhost:3000`.
33. **¿Por qué no tuvieron problemas de CORS?** Por el proxy de Vite: el navegador ve un solo origen.
34. **¿Usan librería de componentes?** No, CSS propio.
35. **¿Cómo protegen rutas del front?** Componente `Private` que redirige al login o al catálogo según sesión y rol
    (la seguridad real igual está en el backend).

**Pruebas y herramientas**

36. **¿Cómo testean?** Pruebas de integración con `node:test`: levantan el servidor real contra la base `tienda_test`
    y le pegan con `fetch`.
37. **¿Qué es un test de integración vs unitario?** Unitario: una función aislada. Integración: varias capas juntas
    (acá, HTTP + controladores + base real).
38. **¿Cómo prueban los endpoints a mano?** Archivos `.http` con REST Client de VS Code.
39. **¿Cómo corren el proyecto?** `npm install`, `.env`, `npm run seed`, `npm run start:dev` y
    `npm run dev --prefix frontend`.
40. **¿Qué control de versiones usan?** Git y GitHub, desarrollo en la rama `Desarrollo` y merge a `main`.
