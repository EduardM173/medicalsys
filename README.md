# MedicalSys

Plataforma de gestión médica. Este repositorio contiene la base técnica del MVP del Sprint 2.

## Stack

- Frontend: React + Vite (JavaScript)
- Backend: Node.js + Express (JavaScript)
- ORM: Prisma
- Base de datos: PostgreSQL

## Arquitectura

El backend aplica la separación Route → Controller → Service → Prisma → PostgreSQL. React consume la API HTTP y no accede directamente a la base de datos.

## Requisitos

- Node.js 18 o superior
- npm
- PostgreSQL con la base de datos `medicalsys` existente

## Variables de entorno

No subas archivos `.env` al repositorio. Copia los archivos de ejemplo y completa únicamente las credenciales locales.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

`backend/.env` requiere `DATABASE_URL`, `PORT`, `FRONTEND_URL`, `JWT_SECRET` y `JWT_EXPIRES_IN`; `frontend/.env` permite configurar `VITE_API_URL`.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Backend

```powershell
cd backend
npm install
npm run dev
```

## Prisma y PostgreSQL

Con la base existente configurada en `backend/.env`, los comandos son:

```powershell
cd backend
npm run prisma:pull
npm run prisma:generate
npm run prisma:baseline
npm run prisma:seed
```

No ejecutes `prisma migrate reset` ni `prisma db push` sobre la base existente. La migración `20260824_init_medicalsys` se registra como baseline sin volver a crear las tablas.

## Endpoint de verificación

Con el backend en ejecución:

```text
GET http://localhost:3000/api/health
```

La respuesta correcta confirma que la API y PostgreSQL están disponibles.

## Autenticación

El inicio de sesión utiliza JWT almacenado en una cookie HttpOnly. El navegador debe incluir credenciales en las solicitudes a la API.

```text
POST http://localhost:3000/api/auth/login
GET  http://localhost:3000/api/auth/me
```

La pantalla de acceso está disponible en `http://localhost:5173/login` y la ruta protegida mínima en `http://localhost:5173/dashboard`.

## Gestión de usuarios

Los endpoints administrativos requieren una sesión con rol `ADMINISTRADOR`. La eliminación es lógica y cambia el estado del usuario a `INACTIVO`.

```text
POST   http://localhost:3000/api/users
GET    http://localhost:3000/api/users
GET    http://localhost:3000/api/users/:id
PATCH  http://localhost:3000/api/users/:id
DELETE http://localhost:3000/api/users/:id
```

La pantalla administrativa está disponible en `http://localhost:5173/admin/usuarios`.
