# TP-Desarrollo-de-Software (Tienda de informática)

INTEGRANTES

      Lautaro Rivarola-50787
      Santino Giordani-54712
      Mauricio Ramírez Llopart-52092
      Santino Zanin-52717

REPOSITORIO: https://github.com/Lautaro-2003/TP-Desarrollo-de-Software

DESCRIPCIÓN:El proyecto consiste en el desarrollo de una aplicación de software orientada a la gestión de pedidos, permitiendo administrar usuarios, productos, categorías, compras y reseñas dentro de un sistema
La aplicación está pensada para simular el funcionamiento de una tienda online, donde los usuarios pueden navegar productos, comprarlos y dejar opiniones, mientras que los administradores pueden gestionar el negocio.



MODELO DE DOMINIO

<img width="918" height="821" alt="Copia de TP Desarrollo software drawio" src="https://github.com/user-attachments/assets/51685177-d624-42cf-9ee9-cd51c3b2a115" />



Requisitos funcionales


  CRUDs Simples (Independientes)

    .CRUD de Usuarios (User): Gestión de perfiles, registro y modificación de datos básicos (nombre, email, dirección)
  
    .CRUD de Categorías (Category): Creación, modificación y baja de categorías (ej: "Electrónica", "Hogar")

CRUDs Dependientes (Relacionados)

      .CRUD de Productos (Product): Depende de Categoría. No puede existir un producto sin una categoría asignada
      .CRUD Descuento: Depende de la categoria
Casos de Uso / Epics (Valor de Negocio)

      .Epic 1: (Checkout)
      Valor: Transforma el interés del usuario en una venta real.
      Lógica: El usuario selecciona productos, el sistema valida que haya stock disponible, calcula el total (sumando precios de cada Producto) y crea un Order con sus respectivos OrderItems.
    Input: Carrito de compras y datos del Usuario.

      .Epic 2: Pedidos (Order)
      Valor: Permite al usuario gestionar y hacer seguimiento de sus compras realizadas.
      Lógica: Una vez creado el pedido, el sistema almacena la información del Order junto con sus OrderItems. El usuario puede consultar el estado del pedido (pendiente, pagado, enviado, entregado) y ver el detalle de los productos comprados, cantidades y precios. Además, el sistema actualiza el stock de los productos luego de confirmarse la compra.

      .Epic 3: Reseñas/Comentarios (Review) 
      Valor: Genera confianza en los productos y ayuda a otros usuarios en la toma de decisiones.
      Lógica: Los usuarios que hayan comprado un producto pueden dejar una reseña con una calificación (por ejemplo, de 1 a 5 estrellas) y un comentario. El sistema asocia la reseña al producto y al usuario, y calcula un promedio de calificaciones para mostrar en la tienda. También se pueden listar todas las reseñas de un producto.




RAMAS: el desarrollo se hace en la rama `Desarrollo`; `main` recibe un único merge al terminar el proyecto.


## Tecnologías

- **Backend**: Node.js 24 + TypeScript 7, **Express 5** (API REST)
- **Base de datos**: **MongoDB Atlas** con el driver oficial `mongodb` 7 (transacciones en el checkout y en el pago)
- **Autenticación**: JWT firmados con `jose` y contraseñas hasheadas con `scrypt` (módulo `node:crypto`)
- **Frontend**: **React 19 + Vite 8 + TypeScript**, con React Router
- **Pruebas**: `node:test`, pruebas de integración sin dependencias extra
- Archivos `.http` (extensión REST Client de VS Code) para probar cada endpoint a mano

## Cómo correr el proyecto

1. `npm install` y `npm install --prefix frontend`
2. Copiar `.env.example` a `.env` y completar `MONGODB_URI` con la cadena de conexión de Atlas y `JWT_SECRET` con un secreto largo y aleatorio. Si aparece `querySrv ECONNREFUSED`, descomentar `DNS_SERVERS`.
3. `npm run seed`: carga los datos de la demo (4 categorías, 8 productos, clientes, pedidos en todos los estados, reseñas y un descuento vigente en Almacenamiento)
4. `npm run start:dev`: levanta la API en `http://localhost:3000/api`
5. En otra terminal, `npm run dev --prefix frontend`: levanta la tienda en `http://localhost:5173` (Vite redirige `/api` al backend)

Usuarios de prueba del seed:

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@tienda.com` | `admin1234` |
| Cliente | `juan.perez@mail.com` | `cliente1234` |
| Cliente (con compras y reseñas) | `maria.gomez@mail.com` | `cliente1234` |
| Cliente (con compras y reseñas) | `lucia.fernandez@mail.com` | `cliente1234` |

## Roles y permisos

- **Sin sesión**: ver el catálogo (categorías, productos, descuentos) y las reseñas; registrarse.
- **Cliente**: comprar con el checkout, ver, pagar y cancelar sus pedidos, reseñar productos que compró y modificar su propio usuario. El `userId` de pedidos y reseñas sale del token: no se puede comprar ni reseñar en nombre de otro.
- **Administrador**: ABM de categorías, productos, descuentos y usuarios; ver todos los pedidos, enviarlos y entregarlos; gestionar ítems de pedido sueltos; borrar reseñas (moderación).

## Pruebas

`npm test` compila y corre las pruebas de integración contra la base `tienda_test` (se borra y se vuelve a cargar en cada corrida; la base `tienda` no se toca).

## Endpoints

Las rutas marcadas con 🔒 requieren el header `Authorization: Bearer <token>`.

| Recurso | Ruta | Notas |
|---|---|---|
| Autenticación | `/api/auth` | `POST /register` (crea un cliente), `POST /login` (devuelve el token), `GET /me` 🔒 |
| Categorías | `/api/categories` | CRUD (escritura 🔒 admin); no se borra una categoría con productos o descuentos |
| Productos | `/api/products` | CRUD (escritura 🔒 admin); filtro `?categoryId=`; requiere categoría existente; `rating` muestra el promedio de reseñas |
| Descuentos | `/api/discounts` | CRUD (escritura 🔒 admin); filtro `?categoryId=`; porcentaje 1–100 vigente entre `startDate` y `endDate`; si hay varios vigentes se aplica el mayor al congelar el precio del ítem |
| Usuarios | `/api/users` | 🔒 CRUD de admin; el cliente solo ve y modifica su propio usuario; email único; rol `cliente` o `admin` |
| Pedidos | `/api/orders` | 🔒 el cliente ve solo los suyos; el admin filtra con `?userId=`; el detalle (`GET /:id`) incluye los ítems; solo se modifica/borra un pedido pendiente |
| Checkout | `POST /api/orders/checkout` | 🔒 Recibe `{ items: [{ productId, quantity }] }`, valida stock, aplica descuentos vigentes y crea el pedido con sus ítems |
| Estado del pedido | `PATCH /api/orders/:id/status` | 🔒 Avanza un paso: pendiente → pagado (dueño o admin) → enviado → entregado (admin); al pagar descuenta el stock en una transacción |
| Reseñas | `/api/reviews` | Leer es público; escribir 🔒; solo reseña quien compró (pedido pagado o posterior); una por usuario y producto; el promedio queda en `rating` del producto |
| Ítems de pedido | `/api/order-items` | 🔒 solo admin; el precio lo pone el servidor; recalculan el total del pedido |
