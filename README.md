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
    
      .Epic 4: Sistema de Fidelización (Recomendacion)
       Valor: Mejora la experiencia del usuario y fomenta la recompra.
      Lógica: Un listado de "Mis Compras" donde el usuario no solo vea el detalle, sino que el sistema le sugiera productos basados en las Categorías que más ha comprado anteriormente.
    



