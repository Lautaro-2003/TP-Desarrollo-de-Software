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

- **Node.js 24** + **TypeScript 7**
- **Express 5**: API REST
- **MongoDB Atlas** con el driver oficial `mongodb` 7 (transacciones para el checkout)
- **node:test**: pruebas de integración (sin dependencias extra)
- Archivos `.http` (extensión REST Client de VS Code) para probar cada endpoint a mano

## Cómo correr el proyecto

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `MONGODB_URI` con la cadena de conexión de Atlas. Si aparece `querySrv ECONNREFUSED`, descomentar `DNS_SERVERS`.
3. `npm run seed`: carga datos de ejemplo (categorías, productos, usuarios y un pedido)
4. `npm run start:dev`: levanta la API en `http://localhost:3000/api`

## Pruebas

`npm test` compila y corre las pruebas de integración contra la base `tienda_test` (se borra y se vuelve a cargar en cada corrida; la base `tienda` no se toca).

## Endpoints

| Recurso | Ruta | Notas |
|---|---|---|
| Categorías | `/api/categories` | CRUD; no se borra una categoría con productos |
| Productos | `/api/products` | CRUD; filtro `?categoryId=`; requiere categoría existente |
| Usuarios | `/api/users` | CRUD; email único; rol `cliente` (por defecto) o `admin` |
| Pedidos | `/api/orders` | CRUD; filtro `?userId=`; solo se modifica/borra un pedido pendiente |
| Checkout | `POST /api/orders/checkout` | Recibe `{ userId, items: [{ productId, quantity }] }`, valida stock y crea el pedido con sus ítems |
| Ítems de pedido | `/api/order-items` | El precio lo pone el servidor; recalculan el total del pedido |
