# MedicalSys

Plataforma universitaria de gestión médica hospitalaria. El proyecto está organizado como frontend React, API Express y PostgreSQL mediante Prisma.

## Requisitos

- Node.js 18 o superior (se recomienda Node.js 22 LTS).
- npm.
- PostgreSQL 14 o superior y, opcionalmente, pgAdmin 4.
- Git.

Compruebe Node y npm antes de comenzar:

```powershell
node --version
npm --version
```

## Instalación rápida

Desde una terminal de PowerShell:

```powershell
git clone https://github.com/EduardM173/medicalsys.git
cd medicalsys
git switch sprint-2
git pull origin sprint-2
```

Instale las dependencias en ambos proyectos:

```powershell
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

## Base de datos PostgreSQL

La base se llama `medicalsys`. Si todavía no existe, créela una sola vez.

### Opción A: pgAdmin

1. Abra pgAdmin y conéctese a su servidor local PostgreSQL.
2. Cree una base de datos llamada `medicalsys`.
3. Seleccione esa base, abra **Query Tool** y cargue el archivo `database/01_schema_mvp.sql`.
4. Ejecute el script completo.

### Opción B: consola de PostgreSQL

Ejecute desde la raíz del repositorio, reemplazando `postgres` si su usuario de PostgreSQL es otro:

```powershell
createdb -U postgres medicalsys
psql -U postgres -d medicalsys -f database\01_schema_mvp.sql
```

> Si la base ya existe y contiene tablas, no ejecute de nuevo `01_schema_mvp.sql`.

## Variables de entorno

Los archivos `.env` son locales y **no deben subirse a Git**. Cree los archivos a partir de los ejemplos:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edite `backend/.env` y use su propia contraseña de PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:TU_CONTRASENA@localhost:5432/medicalsys?schema=public"
PORT=3000
FRONTEND_URL="http://localhost:5173"
JWT_SECRET="cambia-esta-clave-por-una-frase-larga-local"
JWT_EXPIRES_IN="8h"
```

Si la contraseña contiene caracteres especiales como `@`, `:`, `/` o `#`, debe codificarse para una URL. Por ejemplo, `clave@123` se escribe como `clave%40123`.

El archivo `frontend/.env` puede conservar este valor:

```env
VITE_API_URL=http://localhost:3000/api
```

Use exactamente `localhost` en el navegador, no `127.0.0.1`, porque el backend permite el origen `http://localhost:5173`.

## Prisma y datos de prueba

Con PostgreSQL configurado, ejecute una vez desde `backend`:

```powershell
cd backend
npm run prisma:generate
npm run prisma:baseline
npm run prisma:seed
```

El seed es idempotente: puede ejecutarse varias veces sin duplicar sus escenarios. Crea o actualiza usuarios y roles, dos médicos, horarios semanales, pacientes, historiales, atenciones, documentos clínicos, citas para hoy y mañana, y consentimientos informados.

No ejecute estos comandos sobre la base existente:

```text
prisma migrate reset
prisma db push
```

Si se creó la base con `01_schema_mvp.sql`, tampoco es necesario ejecutar `npm run prisma:pull`; el esquema Prisma ya está incluido en el repositorio.

## Ejecutar el proyecto

Abra dos terminales desde la raíz del repositorio.

Terminal 1 — backend:

```powershell
cd backend
npm run dev
```

La API queda disponible en [http://localhost:3000](http://localhost:3000).

Terminal 2 — frontend:

```powershell
cd frontend
npm run dev
```

Abra [http://localhost:5173/login](http://localhost:5173/login).

## Usuarios de prueba

Después de ejecutar `npm run prisma:seed`, utilice estas credenciales de desarrollo:

| Rol | Correo | Contraseña | Uso |
|---|---|---|---|
| Administrador | `admin@medicalsys.test` | `MedicalSys2026!` | Gestionar usuarios y horarios médicos. |
| Recepcionista | `recepcionista@medicalsys.test` | `MedicalSys2026!` | Registrar, consultar y editar pacientes. |
| Médico principal | `medico@medicalsys.test` | `MedicalSys2026!` | Agenda, historiales, documentos y consentimientos. |
| Segundo médico | `medico.b@medicalsys.test` | `MedicalSys2026!` | Verificar el aislamiento de agenda entre médicos. |
| Paciente | `paciente@medicalsys.test` | `MedicalSys2026!` | Comprobar autenticación con rol paciente. |
| Usuario inactivo | `usuario.inactivo@medicalsys.test` | `MedicalSys2026!` | Verificar que una cuenta inactiva no puede iniciar sesión. |

Estas credenciales son solo para desarrollo local. No deben usarse en un sistema real.

## Seguridad de contraseñas

Al crear usuarios desde **Gestión de Usuarios**, la contraseña debe confirmarse y cumplir estas reglas: al menos 12 caracteres, una letra mayúscula, una minúscula, un número, un símbolo y ningún espacio. El formulario muestra el cumplimiento de cada requisito y una barra de fortaleza; la API aplica la misma política antes de guardar el hash con bcrypt.

## Verificaciones y módulos disponibles

Con el backend iniciado, compruebe primero:

```text
GET http://localhost:3000/api/health
```

Debe responder con el estado de la API y la conexión a la base de datos.

Inicie sesión como administrador y pruebe:

| Módulo | Ruta | Qué probar |
|---|---|---|
| Panel | `/dashboard` | Confirmar que existe una sesión autenticada. |
| Gestión de usuarios | `/admin/usuarios` | Crear, editar o desactivar usuarios. |
| Gestión de médicos | `/admin/medicos` | Registrar, consultar y editar perfiles profesionales. |
| Horarios médicos | `/admin/horarios-medicos` | Seleccionar médico, agregar horarios, editar y habilitar/deshabilitar disponibilidad. |
| Gestión de pacientes | `/pacientes` | Buscar, registrar, consultar y editar pacientes. |
| Agenda de citas | `/citas` | Reservar una cita (paciente, médico, servicio, fecha/hora) y consultar las citas del día. Disponible para Administrador y Recepcionista. |
| HU-21 Preparar factura | `/facturacion/preparar` | Seleccionar paciente y cita opcional, agregar servicios reales, ajustar cantidades y validar la vista previa. No crea ni emite una factura y está disponible para Administrador y Recepcionista. |
| HU-23 Consultar facturas | `/facturacion` | Buscar facturas emitidas por número o receptor y filtrar por paciente o fecha; abra una fila para comprobar sus conceptos, importes y estado SIN. Disponible para Administrador y Recepcionista. |
| HU-26 Historial de notificaciones | `/notificaciones` | Seleccionar el paciente `4892104`, consultar sus cuatro registros y filtrar por una cita. Incluye confirmaciones, recordatorios y un intento fallido. |
| WhatsApp de citas | `/whatsapp` | Enviar confirmaciones y recordatorios. Cuando Green API está configurada, una respuesta `SI` del paciente confirma su cita pendiente. |

Inicie sesión con `medico@medicalsys.test` para probar los módulos clínicos:

| Historia | Ruta | Datos sembrados |
|---|---|---|
| HU-11 Historial clínico | `/pacientes` | Busque el documento `4892104`; contiene antecedentes y dos atenciones. El documento `5938217` prueba un paciente sin historial. |
| HU-13 Documentos clínicos | `/pacientes` | Abra el paciente `4892104`; tiene dos documentos. El paciente `6047331` tiene un documento adicional. |
| HU-16 Agenda médica | `/agenda` | La fecha actual contiene tres citas del médico principal; mañana contiene una. La agenda del segundo médico contiene una cita distinta hoy. |
| HU-19 Consentimiento informado | `/consentimientos/nuevo` | Los pacientes y las citas aparecen como opciones. El seed imprime en la terminal las rutas de dos consentimientos ya creados. |

Los horarios administrativos incluyen lunes a viernes de `08:00` a `12:00` para el médico principal, lunes/miércoles/viernes de `14:00` a `18:00` para el segundo médico y un horario inactivo de demostración. Las citas se recalculan con cada ejecución para que siempre existan datos en la fecha actual y el día siguiente.

El botón **Cerrar sesión** se encuentra en la parte inferior de la barra lateral.

## Endpoints principales

La API usa cookies HttpOnly; desde el frontend ya se envían con `credentials: include`.

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id

GET   /api/doctors
POST  /api/doctors
GET   /api/doctors/:id
PATCH /api/doctors/:id
GET   /api/doctors/:doctorId/schedules
GET   /api/doctors/:doctorId/schedules/active
POST  /api/doctors/:doctorId/schedules
PATCH /api/schedules/:scheduleId

GET   /api/patients?search=texto
POST  /api/patients
GET   /api/patients/:id
PATCH /api/patients/:id

GET  /api/services

POST /api/appointments
GET  /api/appointments?fecha=YYYY-MM-DD&medicoId=&pacienteId=&estado=
GET  /api/appointments/:id

GET  /api/billing/invoices?search=&patientId=&date=YYYY-MM-DD
GET  /api/billing/invoices/:id

GET  /api/notifications?patientId=ID&appointmentId=ID_OPCIONAL
```

Los endpoints de usuarios y horarios requieren sesión con rol `ADMINISTRADOR`. La creación y edición de médicos también requiere `ADMINISTRADOR`, pero la consulta (`GET /api/doctors`) está disponible además para `RECEPCIONISTA`, ya que la necesita para reservar citas. Los endpoints de citas y de servicios (`/api/appointments`, `/api/services`) requieren `RECEPCIONISTA` o `ADMINISTRADOR`. Sin sesión responden `401`; un rol sin permiso recibe `403` en esas operaciones.

### HU-14: Registrar una cita (Reglas de negocio)

- **PA-01**: una cita está asociada a un paciente, médico y servicio existentes y activos.
- **PA-02**: la cita almacena fecha y hora de inicio, fecha y hora de fin, motivo y estado.
- **PA-03**: la fecha y hora de fin debe ser posterior a la fecha y hora de inicio (se calcula a partir de la duración del servicio).
- **PA-04**: no se permite crear una cita fuera de los horarios activos configurados para el médico (`horario_medico`).
- **PA-05**: no se permite registrar una cita que se solape con otra cita activa (`PROGRAMADA`, `CONFIRMADA`, `EN_CONSULTA`) del mismo médico.
- **PA-06**: una cita nueva se registra con el estado inicial `PROGRAMADA`.
- **PA-07**: una consulta posterior de la cita (`GET /api/appointments/:id`) recupera los datos almacenados en PostgreSQL.

## Solución de problemas

**`EADDRINUSE: address already in use :::3000`**

Otro proceso ocupa el puerto 3000. Cierre cualquier terminal anterior que ejecute el backend. Para identificar y cerrar el proceso en Windows:

```powershell
netstat -ano | findstr :3000
taskkill /PID NUMERO_DEL_PID /F
```

Después ejecute de nuevo `npm run dev` dentro de `backend`.

**`No fue posible conectar con el servidor` en el frontend**

Compruebe que el backend siga ejecutándose en el puerto 3000, que `backend/.env` tenga una `DATABASE_URL` válida y abra el frontend mediante `http://localhost:5173`.

**Error de conexión de Prisma/PostgreSQL**

Revise que el servicio PostgreSQL esté iniciado, que exista la base `medicalsys` y que el usuario, contraseña y puerto de `DATABASE_URL` sean correctos.

### HU-23: Consultar una factura emitida

Ejecute `npm run prisma:seed` desde `backend`. El seed crea de forma idempotente las facturas simuladas `TEST-FACT-HU23-001` y `TEST-FACT-HU23-002`, con pacientes y conceptos diferentes. Inicie sesión como Administrador o Recepcionista y abra `/facturacion`.

La consulta muestra únicamente facturas con estado `EMITIDA`. Permite buscar por número o razón social y filtrar por paciente o fecha exacta. El detalle presenta los datos históricos persistidos del receptor, conceptos, cantidades, precios, subtotal, total, forma de pago y estado de integración SIN. La etiqueta `SIMULACIÓN` indica expresamente que los comprobantes de prueba no fueron aceptados por el SIN. El acceso de solo consulta usa el permiso independiente `billing.read`, configurable desde la matriz de Roles y Seguridad; preparar o emitir continúa requiriendo `billing.prepare`.

Para ejecutar las pruebas específicas:

```powershell
cd backend
npm run test:billing
```

### HU-26: Historial de notificaciones

Ejecute `npm run prisma:seed` desde `backend` e inicie sesión con `recepcionista@medicalsys.test`. En `/notificaciones`, el paciente con CI `4892104` tiene cuatro registros distribuidos en dos citas; una de ellas incluye una confirmación entregada, un recordatorio leído y un recordatorio fallido. El paciente `6047331` permite comprobar el aislamiento y `5938217` el estado sin notificaciones. Los cinco fixtures usan referencias `SEED-HU26-*` y no se duplican al repetir la semilla.

La consulta reutiliza `notifications.manage`, filtra en PostgreSQL por paciente y cita, devuelve solo `CONFIRMACION_CITA` y `RECORDATORIO_CITA`, y ordena por `fecha_creacion` descendente. No envía, reenvía, edita ni elimina notificaciones.

```powershell
cd backend
npm run test:notifications
```

### Respuestas automáticas por WhatsApp (Green API)

Para pruebas locales, configure las credenciales de su instancia autorizada solo en `backend/.env`:

```env
WHATSAPP_PROVIDER=GREEN_API
GREENAPI_API_URL=https://xxxx.api.greenapi.com
GREENAPI_ID_INSTANCE=su_id_de_instancia
GREENAPI_API_TOKEN_INSTANCE=su_token_secreto
```

En la consola de Green API deje `webhookUrl` vacío y active **incomingWebhook**. Al iniciar el backend, MedicalSys consulta la cola HTTP de Green API cada pocos segundos; por tanto no necesita exponer el computador con ngrok durante el desarrollo. Green API entrega los eventos de la cola en orden y exige eliminarlos después de procesarlos.

Cuando un paciente con número registrado responda exactamente `SI` o `SÍ` a una confirmación o recordatorio, MedicalSys registra el mensaje entrante y cambia a `CONFIRMADA` únicamente la cita futura pendiente más reciente. Una respuesta en un grupo, de un número no asociado a un único paciente, repetida o diferente de `SI` no modifica ninguna cita. Si se responde citando el mensaje original, se prioriza esa notificación concreta.

```powershell
cd backend
npm run test:whatsapp-incoming
```

## Arquitectura

```text
React → Routes → Controllers → Services → Prisma → PostgreSQL
```

Las rutas definen endpoints y middlewares, los controladores construyen respuestas HTTP y los servicios contienen validaciones y reglas de negocio. React solo consume la API; no consulta PostgreSQL directamente.

## Hotfix: OSI, roles y mínimo privilegio

Al instalar esta rama o actualizar desde una versión anterior, ejecute desde `backend`:

```powershell
npm run security:setup
npm run security:seed
```

`security:setup` agrega de forma idempotente el rol OSI y las tablas `security_role_policy`, `security_user_grant` y `security_audit`. No borra datos ni cambia permisos guardados. Es obligatorio antes de iniciar esta versión del backend. Estas tablas se administran con el script SQL de seguridad; no requieren regenerar el cliente Prisma. No utilice `db push` para instalar este cambio.

`security:seed` es opcional y exclusivo de desarrollo: crea `osi@medicalsys.test` con contraseña `MedicalSys2026!` únicamente si no existe. No restablece contraseñas, roles ni estados de cuentas existentes. El seed general también incluye este paso.

Entre como OSI y abra **Roles y Seguridad** (`/admin/seguridad`):

- Matriz dinámica de roles y permisos por función; todas las casillas son configurables.
- Creación de roles personalizados, disponibles de inmediato al crear o editar usuarios.
- Permisos temporales por usuario con vencimiento obligatorio, revocación y auditoría.
- Dependencias verificadas: por ejemplo, reservar requiere consultar salas.
- Auditoría de los últimos 100 cambios de usuarios y permisos realizados mediante la API, sin contraseñas.
- OSI y Administrador pueden gestionar seguridad inicialmente; cualquier ampliación posterior queda registrada en auditoría.

En **Gestión de Usuarios** hay búsqueda por nombre/correo y filtros por rol y estado. El rol de una cuenta nueva debe seleccionarse explícitamente. Se valida la confirmación de contraseña en la API. No se puede modificar el propio rol/estado; tampoco reasignar el rol de usuarios que ya tienen un perfil médico o de paciente vinculado. Un gestor sin permiso de seguridad no puede asignar ni modificar accesos superiores a los propios.

La API consulta el rol, estado y permisos vigentes en cada petición; un JWT antiguo no conserva privilegios revocados. La interfaz actualiza la sesión al recuperar el foco, cada 30 segundos y al recibir un rechazo de acceso. Los módulos, rutas y acciones se ocultan según los permisos efectivos.

Para salas/quirófanos, Médico conserva consulta pero no ve Nueva Reserva, Reservar, Cancelar ni el modal. Administrador y Recepcionista disponen de esas acciones mientras tengan `rooms.write`. OSI y Paciente no acceden a salas.

El catálogo central está en `backend/src/security/permissions.js`. Los permisos iniciales conservan las responsabilidades funcionales existentes, pero OSI puede ampliar o revocar permisos desde la matriz. Para incorporar una nueva función, defina su permiso y su ruta en ese catálogo; las rutas protegidas sin permiso reconocido se rechazan.

Comprobaciones reproducibles:

```powershell
# En backend
npm run test:security
# En frontend
npm run build
```

La suite de seguridad prueba 33 rutas con los cinco roles usando una base simulada, además de revocación, suspensión, rol desactivado, dependencias, autoedición y escalamiento. La verificación local también incluyó login OSI contra PostgreSQL y revisión de la interfaz con OSI, Médico y Recepcionista.
