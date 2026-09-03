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

## Arquitectura

```text
React → Routes → Controllers → Services → Prisma → PostgreSQL
```

Las rutas definen endpoints y middlewares, los controladores construyen respuestas HTTP y los servicios contienen validaciones y reglas de negocio. React solo consume la API; no consulta PostgreSQL directamente.
