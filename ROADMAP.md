# Roadmap del proyecto (rama `Desarrollo`)

## Flujo de ramas

- **`Desarrollo`** es la rama de integración. Todo el desarrollo restante del TP se hace acá (o en ramas de feature que salen de `Desarrollo` y vuelven a ella por Pull Request).
- **`main`** queda congelada hasta que el proyecto esté terminado. Cuando se cumplan todos los requisitos del [README](README.md), se hace un único merge `Desarrollo` → `main`.
- Ramas de feature sugeridas: `feature/user`, `feature/order-checkout`, `feature/review`, `feature/discount`, etc. Siempre se crean desde `Desarrollo` actualizada (`git pull origin Desarrollo`).

## Cómo correr el proyecto

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `MONGODB_URI` (MongoDB Atlas) y `MONGODB_DB`.
3. `npm run seed` (opcional, carga datos de prueba)
4. `npm run start:dev`. La API queda en `/api/categories`, `/api/products` y `/api/order-items`.

## Estado actual

| Módulo | Estado | Notas |
|---|---|---|
| Category (CRUD simple) | ✅ Hecho | Persistido en MongoDB |
| Product (CRUD dependiente de Category) | ✅ Hecho | Valida `categoryId`; listado filtrable por categoría |
| OrderItem | 🟡 Parcial | Toma `unitPrice` del producto y calcula `subtotal`; falta la entidad `Order` a la que pertenece |
| User (CRUD simple) | ❌ Pendiente | |
| Discount (CRUD dependiente de Category) | ❌ Pendiente | |
| Epic 1: Checkout | ❌ Pendiente | |
| Epic 2: Pedidos (Order) | ❌ Pendiente | |
| Epic 3: Reseñas (Review) | ❌ Pendiente | |

## Pendientes (en orden sugerido)

### 1. CRUD de Usuarios (`User`)
- [ ] Entidad `User`: `name`, `email` (único), `address`, `role` (`cliente` | `admin`)
- [ ] Repository, controller con `sanitizeUserInput`, rutas `/api/users` y archivo `.http`
- [ ] Validar formato y unicidad del email

### 2. Entidad `Order`
- [ ] Entidad `Order`: `userId`, `date`, `status` (`pendiente` | `pagado` | `enviado` | `entregado`), `total`
- [ ] Repository, controller y rutas `/api/orders`
- [ ] Validar que `OrderItem.orderId` apunte a un `Order` existente

### 3. Epic 1: Checkout
- [ ] Endpoint `POST /api/orders/checkout` que recibe `{ userId, items: [{ productId, quantity }] }`
- [ ] Validar que el usuario exista y que haya stock suficiente para cada producto
- [ ] Calcular el total con el precio actual de cada producto (y los descuentos vigentes, ver punto 6)
- [ ] Crear el `Order` y sus `OrderItem`s en una sola operación (transacción de MongoDB)

### 4. Epic 2: Seguimiento de pedidos
- [ ] `GET /api/users/:id/orders`: pedidos de un usuario
- [ ] `GET /api/orders/:id`: detalle con sus ítems, cantidades y precios
- [ ] `PATCH /api/orders/:id/status`: transiciones válidas pendiente → pagado → enviado → entregado
- [ ] Descontar stock de los productos al confirmar la compra (pasar a `pagado`)

### 5. Epic 3: Reseñas (`Review`)
- [ ] Entidad `Review`: `userId`, `productId`, `rating` (1 a 5), `comment`, `date`
- [ ] Solo pueden reseñar los usuarios que compraron el producto (con un pedido `pagado` o posterior)
- [ ] `GET /api/products/:id/reviews`: listar las reseñas de un producto
- [ ] Mostrar el promedio de calificaciones junto al producto

### 6. CRUD de Descuentos (`Discount`)
- [ ] Entidad `Discount`: `categoryId`, `percentage`, `startDate`, `endDate`
- [ ] Rutas `/api/discounts`; validar que la categoría exista
- [ ] Aplicar el descuento vigente en el cálculo del checkout

### 7. Transversales
- [ ] Validación de entradas homogénea en todos los controllers
- [ ] Autenticación y roles (admin gestiona catálogo y estados; cliente compra y reseña)
- [ ] Tests (el script `npm test` todavía es un placeholder)
- [ ] Frontend de la tienda
- [ ] Limpieza: el import `crypto` sin uso en `category.entity.ts`; unificar nombres de archivo (`controler` → `controller`)
- [ ] Mover el `OrderItem` de suelto a parte del pedido (crearlo solo vía checkout)

### 8. Cierre
- [ ] Revisión final contra los requisitos del README
- [ ] Pull Request `Desarrollo` → `main`
