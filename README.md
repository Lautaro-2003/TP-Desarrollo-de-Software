# TP-Desarrollo-de-Software (Tienda de informática)

INTEGRANTES

      Lautaro Rivarola-50787
      Santino Giordani-54712
      Mauricio Ramírez Llopart-52092
      Santino Zanin-52717

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

    .CRUD de Pedidos (Order): Depende de Usuario. Registra  la compra (fecha, estado, total) vinculada a un cliente específico

    .CRUD de Reseñas/Comentarios (Review): Depende de Producto y Usuario. Permite a los usuarios calificar productos

Casos de Uso / Epics (Valor de Negocio)

    .Epic 1: (Checkout)
      Valor: Transforma el interés del usuario en una venta real.
      Lógica: El usuario selecciona productos, el sistema valida que haya stock disponible, calcula el total (sumando precios de cada Producto) y crea un Order con sus respectivos OrderItems.
    Input: Carrito de compras y datos del Usuario.

    .Epic 2: Gestión de Inventario Automatizada
      Valor: Evita vender productos que no están físicamente disponibles.
      Lógica: Al confirmarse un Pedido (Epic 1), el sistema debe disparar un proceso que reste automáticamente la cantidad comprada del stock en la entidad Producto. Si el stock llega a cero, el producto debe marcarse como agotado


    .Epic 3: Panel de Control de Ventas (Admin)
      Valor: Permite al negocio gestionar la logística.
      Lógica: El Administrador accede a un listado filtrado de todos los Orders realizados. Puede cambiar el estado del pedido (ej: de "Pendiente" a "Enviado" o "Cancelado").
    Nivel de acceso: Requiere validación de rol de Administrador.

    .Epic 4: Sistema de Fidelización 
      Valor: Mejora la experiencia del usuario y fomenta la recompra.
      Lógica: Un listado de "Mis Compras" donde el usuario no solo vea el detalle, sino que el     sistema le sugiera productos basados en las Categorías que más ha comprado anteriormente.
    



