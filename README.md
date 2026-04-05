# TP-Desarrollo-de-Software (App de Gestión de Pedidos)

MODELO DE DOMINIO

<img width="918" height="821" alt="Copia de TP Desarrollo software drawio" src="https://github.com/user-attachments/assets/51685177-d624-42cf-9ee9-cd51c3b2a115" />



Requisitos funcionales

CRUDs Simples (Independientes)

  .CRUD de Usuarios (User): Gestión de perfiles, registro y edición de datos básicos (nombre, email, dirección). Esencial para la autenticación y los niveles de acceso (Admin/Cliente)
  .CRUD de Categorías (Category): Creación, edición y baja de categorías (ej: "Electrónica", "Hogar")

CRUDs Dependientes (Relacionados)

  .CRUD de Productos (Product): Depende de Categoría. No puede existir un producto sin una categoría asignada. Incluye gestión de precios, descripción e imágenes

  .CRUD de Pedidos (Order): Depende de Usuario. Registra  la compra (fecha, estado, total) vinculada a un cliente específico

  .CRUD de Reseñas/Comentarios (Review): Depende de Producto y Usuario. Permite a los usuarios calificar productos

Casos de Uso / Epics (Valor de Negocio)

  .Epic 1: Flujo de Compra (Checkout)
    Valor: Transforma el interés del usuario en una venta real.
    Lógica: El usuario selecciona productos, el sistema valida que haya stock disponible, calcula el total (sumando precios de cada Producto) y crea un Order con sus respectivos OrderItems.
    Input: Carrito de compras y datos del Usuario.

  .Epic 2: Gestión de Inventario Automatizada
    Valor: Evita vender productos que no están físicamente disponibles.
    Lógica: Al confirmarse un Pedido (Epic 1), el sistema debe disparar un proceso que reste automáticamente la cantidad comprada del stock en la entidad Producto. Si el stock llega a cero, el producto debe marcarse como       "Agotado"


  .Epic 3: Panel de Control de Ventas (Admin)
    Valor: Permite al negocio gestionar la logística.
    Lógica: El Administrador accede a un listado filtrado de todos los Orders realizados. Puede cambiar el estado del pedido (ej: de "Pendiente" a "Enviado" o "Cancelado").
    Nivel de acceso: Requiere validación de rol de Administrador.

  .Epic 4: Sistema de Fidelización / Historial Inteligente
    Valor: Mejora la experiencia del usuario y fomenta la recompra.
    Lógica: Un listado de "Mis Compras" donde el usuario no solo vea el detalle, sino que el sistema le sugiera productos basados en las Categorías que más ha comprado anteriormente.
    Relación: Consume datos históricos de la entidad Order y Category.



