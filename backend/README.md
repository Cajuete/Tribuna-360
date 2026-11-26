# Configuración del backend

## Solicitud de incorporación de clubes (HU-17)

Antes de desplegar estas funciones, ejecuta en orden `backend/sql/019_hu17_pending_club_requests.sql` y `backend/sql/020_hu18_club_request_review.sql` en el SQL Editor de Supabase. La migración 019 agrega el nombre del representante y la fecha de consentimiento, y crea índices únicos para evitar solicitudes pendientes repetidas por correo o por club/asociación.

El formulario público guarda una solicitud con estado `pending`; no crea un usuario Auth, un club ni un rol `club_admin`. El nombre completo y correo del representante son obligatorios; personería jurídica y código RUN son referencias opcionales y no se adjuntan archivos en esta etapa. El formulario solicita consentimiento para usar esos datos al evaluar y dar seguimiento a la solicitud. La consulta de solicitudes continúa restringida a `superadmin`.

## Revisión de solicitudes de clubes (HU-18)

La pestaña **Clubes** del panel de superadmin lista solicitudes pendientes y permite aprobarlas o rechazarlas. Al rechazar se exige una nota; al aprobar, una función PostgreSQL transaccional crea el tenant o habilita el ya existente con el mismo slug y asociación, sin crear cuentas ni asignar roles. Toda decisión registra estado, nota, fecha y superadmin responsable. La operación solo acepta solicitudes pendientes, por lo que un segundo clic no crea un segundo club.

Al enviar una solicitud, el representante recibe un código aleatorio privado de seguimiento. Debe guardarlo para consultar el estado desde **Únete a Tribuna 360 → Consultar estado de una solicitud**. La base guarda únicamente el hash del código y el endpoint público devuelve el estado y la nota destinada al solicitante; aplica el rate limit existente por IP cuando Redis está disponible. No se envía un correo automático: la configuración actual del proyecto no define un proveedor de correo para estos avisos.

Las solicitudes pendientes creadas antes de desplegar HU-18 pueden resolverse desde el panel, pero no tienen un código de seguimiento y por eso no se pueden consultar desde el formulario público.

## Consulta y administración de membresías (HU-19)

Antes de habilitar HU-19, confirma que `backend/sql/006_membership_details.sql` esté aplicada y ejecuta `backend/sql/021_hu19_membership_management.sql` en Supabase. El endpoint de membresías propias filtra siempre por el usuario autenticado y agrega únicamente las solicitudes vinculadas a esas membresías. Inicio, vencimiento, duración y beneficios se muestran desde los datos del plan; el estado vencido se calcula por fecha y no cambia automáticamente el estado almacenado.

La renovación es manual: el socio inicia una compra y la vigencia se extiende por la duración del plan únicamente después de que el club confirma el pago. Si aún está vigente, el nuevo período comienza al vencer el actual; si venció, comienza al confirmar la renovación. No se pueden reactivar membresías canceladas ni renovar mientras haya una solicitud de cancelación pendiente.

Una cancelación iniciada por el socio queda pendiente de revisión; la membresía se mantiene activa mientras tanto. El superadmin o el administrador del mismo club puede aprobarla o rechazarla desde **Admin → Socios**; la función de base de datos verifica rol, tenant, membresía y estado, y deja fecha/responsable/nota del resultado. Los datos no se exponen mediante acceso directo de anon/authenticated a la nueva tabla.

## Pagos QR manuales (entradas, tienda y membresías)

Antes de habilitar los pagos, confirma que estén aplicadas las migraciones base `006_membership_details.sql`, `018_zone_seating_mode.sql` y `021_hu19_membership_management.sql`; ejecuta también las migraciones pendientes `019_hu17_pending_club_requests.sql` y `020_hu18_club_request_review.sql` si aún no se aplicaron. Finalmente ejecuta `backend/sql/022_manual_qr_payments.sql` y `backend/sql/023_payment_manager_role.sql` en Supabase. La migración 023 agrega `payment_manager` al enum `user_role`, necesario para crear usuarios con ese rol.

Cada administrador de club configura la imagen del QR, titular e instrucciones en **Admin → Pagos**; el superadmin puede elegir un club y configurarlo desde la misma pestaña. El dinero se transfiere directamente a la cuenta del club. El hincha elige QR, paga y adjunta foto o PDF del comprobante; se guarda de forma privada. La compra queda en revisión hasta que el admin del club o el **Encargado de pagos** confirma el abono. Solo al confirmar se habilitan las entradas, se marca como pagado el pedido o se activa/renueva la membresía. Un rechazo requiere motivo y libera la reserva de entradas o stock.

El QR estático no confirma transferencias automáticamente: el encargado debe comprobar el abono en la cuenta del club. La reserva sin comprobante vence a los 30 minutos; después de adjuntar comprobante, la revisión queda disponible durante 7 días. La bandeja aplica la expiración y libera inventario al consultar o iniciar otro pago.

El rol `payment_manager` se asigna desde **Admin → Usuarios** por el administrador del club y solo puede revisar pagos de su propio tenant. `financial_auditor` y `sales_manager` pueden consultar la bandeja, pero no aprobar/rechazar. `club_admin` configura el QR de su club y `superadmin` puede configurar el de cualquier club. Las compras de tienda se limitan a un club por checkout, ya que cada club recibe directamente sus fondos.

La opción de tarjeta se muestra separada del QR, pero permanece deshabilitada hasta contratar y configurar un proveedor compatible con Bolivia. No se guardan datos de tarjeta ni se simula una confirmación. Antes de integrar un proveedor, verifica con este que ofrezca API, webhooks y liquidación directa a cada club. En particular, la información pública disponible de PagosNet no confirma esas capacidades técnicas ni la modalidad multi-comercio.

## Campañas y ofertas automáticas

Después de aplicar las migraciones `018_zone_seating_mode.sql`, `022_manual_qr_payments.sql` y `025_delivery_dispatcher.sql`, ejecuta en orden `backend/sql/028_promotion_campaigns.sql`, `backend/sql/029_campaign_ticket_discounts.sql` y `backend/sql/030_campaign_membership_discounts.sql` en el SQL Editor de Supabase; después reinicia el backend. Las migraciones conservan los códigos promocionales existentes y agregan campañas con banners, fechas, ubicaciones públicas y ofertas dirigidas a productos, zonas de entradas o planes de socio de un solo club.

El gerente de ventas, el administrador del club o el superadmin puede crear campañas desde **Ventas → Campañas**, subir una imagen PNG/JPG/WEBP de hasta 2 MB, elegir en qué páginas aparece el banner y seleccionar productos, partido y zona, o planes de socio. Los descuentos de membresía se aplican al asociarse y renovar. Los banners activos aparecen en un carrusel en las páginas seleccionadas; el diseño agrega automáticamente detalles visuales de temporada cuando el título o descripción menciona Halloween, Navidad, Black Friday, Carnaval, aniversario/cumpleaños o verano. No requiere instalar una biblioteca adicional. El panel usa formularios guiados: no pide JSON ni direcciones web para las imágenes o los artículos de un paquete. El logo de los patrocinadores también se sube como archivo desde el panel. El hincha ve los patrocinadores activos dentro del espacio público del club correspondiente.

Una campaña se publica solo cuando está activa y la fecha/hora actual está entre **Desde** y **Hasta**. En **Campañas del club**, el estado **Programada**, **Finalizada** o **Pausada** indica por qué todavía no se muestra; además, cada banner solo aparece en las ubicaciones seleccionadas.

Los descuentos porcentuales o fijos se vuelven a validar y calcular en PostgreSQL al crear el pago o emitir una entrada; el navegador no determina el monto cobrado. Si varias campañas vigentes ofrecen descuentos en el mismo producto, zona o plan, se usa el descuento mayor y no se acumulan. La oferta deja de aplicarse fuera de las fechas de la campaña. La opción anterior de **Códigos promocionales** permanece separada y sus registros no se modifican. Los paquetes del panel seleccionan productos existentes del club y cantidades, en lugar de guardar artículos como JSON libre.

## Evitar sobreventas de entradas por zona

Las ventas por web y taquilla bloquean la fila de la zona en PostgreSQL, cuentan las entradas activas y emiten todas las entradas de la compra dentro de una sola transacción. Si dos compras concurrentes compiten por las últimas entradas, una se completa y la otra recibe un error de aforo insuficiente. Los boletos cancelados no ocupan aforo.

Para habilitarlo, abre el **SQL Editor de Supabase** de tu proyecto, pega y ejecuta el contenido de `backend/sql/017_atomic_zone_ticket_sales.sql`. Luego reinicia el backend (`npm run dev` desde la carpeta `backend`, o reconstruye su contenedor si usas Docker Compose).

La migración también hace atómica la regeneración de un boleto desde soporte. No requiere instalar paquetes ni modificar la configuración de Redis.

## Modalidad de venta de cada zona

Cada zona puede ser `general` (entrada sin asiento asignado) o `numbered` (butacas numeradas). La migración `backend/sql/018_zone_seating_mode.sql` crea el campo con valor `general` para todas las zonas existentes. Ejecútala en el SQL Editor de Supabase después de la migración 017.

La opción numerada permite preparar la configuración del estadio, pero no vende entradas todavía: se bloquea la compra por cantidad hasta implementar el mapa y la selección/reserva de asientos. No cambies a modalidad numerada una zona con entradas activas; la aplicación y la base de datos impiden el cambio.

## Recuperación y restablecimiento de contraseña

El correo se solicita mediante Supabase Auth y la respuesta pública es la misma exista o no una cuenta. El enlace temporal de Supabase abre `/restablecer`; el frontend valida el evento `PASSWORD_RECOVERY` y cambia la contraseña mediante la sesión de recuperación de Supabase. Después cierra las sesiones del usuario. El endpoint de restablecimiento con un token arbitrario del backend fue retirado.

Para desarrollo local:

1. Copia `frontend/.env.example` a `frontend/.env` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos públicos del proyecto en Supabase (Project Settings → API). La clave anon/publishable es pública; nunca pongas la service-role key en el frontend.
2. En un `.env` en la raíz del proyecto (Compose) o en `backend/.env` (Node local), define `PASSWORD_RESET_REDIRECT_URL=http://localhost:5173/restablecer`. En producción, reemplázala por la ruta `/restablecer` del dominio público del frontend.
3. En Supabase → Authentication → URL Configuration, agrega la URL exacta de retorno (`http://localhost:5173/restablecer`) a Redirect URLs y configura `http://localhost:5173` como Site URL. Si esa URL no está permitida, Supabase puede volver a Site URL y no abrir el formulario.
4. En Authentication → Email Templates, verifica que la plantilla de recuperación use el enlace de confirmación de Supabase (`{{ .ConfirmationURL }}`). Ajusta el tiempo de expiración del OTP según la política del proyecto.
5. Si el proyecto sigue usando el SMTP de prueba de Supabase, el envío puede estar limitado a destinatarios autorizados. Para probar con cualquier correo, configura un proveedor SMTP propio en Authentication → SMTP Settings y verifica el dominio/remitente.
6. Inicia frontend y backend y completa el flujo con una cuenta de prueba real: solicitar enlace, abrir el correo, guardar la nueva contraseña e iniciar sesión con ella.

Para Docker Compose, configura `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `PASSWORD_RESET_REDIRECT_URL` en un `.env` en la raíz del proyecto (usa el dominio público en producción), y reconstruye desde la raíz con `docker compose up -d --build backend frontend`. No compartas ni subas archivos `.env`.

## Fila virtual con Redis

La fila virtual usa Sorted Sets (ZSET) de Redis por partido. Al habilitarla, se aplica a todas las compras online; la venta de taquilla (`box_office_cashier`) no pasa por la fila. De forma predeterminada está desactivada, así que las compras existentes siguen funcionando hasta habilitarla.

1. Abre `backend\.env` y agrega:

   ```env
   WAITING_ROOM_ENABLED=true
   QUEUE_TOKEN_SECRET=pega_aqui_una_clave_aleatoria
   WAITING_ROOM_MAX_ACTIVE=50
   WAITING_ROOM_ACCESS_MS=600000
   ```

2. Para generar una clave, en PowerShell ejecuta:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Copia el resultado en `QUEUE_TOKEN_SECRET`; no lo compartas ni lo subas a Git.

3. Confirma que Redis esté activo y reinicia el backend. Si ejecutas Node directamente, desde `backend` usa `npm run dev`. Si usas Docker Compose, desde la raíz del proyecto ejecuta `docker compose up -d --build backend`.

Los valores iniciales admiten hasta 50 compradores a la vez por partido y cada turno dura 10 minutos. Las personas esperan su turno en orden de llegada; el turno se libera al terminar un intento de compra. Desactiva la fila poniendo `WAITING_ROOM_ENABLED=false`.

La fila regula cuántos compradores avanzan al proceso de compra; no reserva entradas ni reemplaza la comprobación de aforo en la base de datos. El backend usa fail-open: si Redis deja de responder, registra el problema y permite acceso temporal para no bloquear ventas.
