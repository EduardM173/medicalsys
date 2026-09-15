# HU-37 — Conectividad y disponibilidad

## Comportamiento cuando cae Internet

La aplicación conserva la pantalla y los valores ingresados. Los formularios integrados con borradores seguros (pacientes, médicos, horarios, citas, atenciones, consentimientos y preparación de factura) guardan únicamente un borrador cifrado AES-256-GCM, separado por sesión, clínica, usuario y formulario. Caduca en ocho horas y se elimina al cerrar sesión o guardar correctamente. La clave WebCrypto no es exportable. Contraseñas no se persisten como borrador.

Esto **no es un servidor clínico offline**: no permite consultar nuevos expedientes, autenticar sin servidor, firmar documentos ni registrar operaciones definitivamente sin conexión. Otros formularios conservan sus valores en memoria mientras permanezcan abiertos. No existe cola automática de escrituras ni sincronización silenciosa. Si una escritura pierde la respuesta, se indica comprobar si fue registrada antes de repetirla manualmente.

La PWA solo almacena el shell y archivos estáticos compilados, mediante lista permitida. Excluye API, documentos, uploads, recursos externos y URLs con parámetros. Necesita HTTPS en producción. El cifrado de borradores no protege contra XSS ejecutándose dentro de una sesión: siguen siendo necesarios CSP, dispositivos controlados y cierre de sesión.

## Capas y decisiones

Se mantiene routes → controllers → services → repositories → Prisma. La paginación usa contexto por solicitud GET y una operación explícita `findPage` del repositorio; no limita las consultas internas de autorización, validación o trabajos de fondo. Los listados reciben página 1 y 20 registros por defecto, máximo 50; filtros se aplican antes del LIMIT. Cada lista y selector tiene navegación independiente. Catálogos de permisos/matriz RBAC son estructuras completas de configuración, no expedientes paginados.

Las lecturas GET/HEAD tienen hasta tres intentos ante problemas transitorios, con espera progresiva, cancelación y timeout que también cubre la descarga del cuerpo. 401 no se reintenta. POST, PUT, PATCH y DELETE jamás se repiten automáticamente. Los endpoints GET deben permanecer sin efectos de negocio irreversibles.

Compresión HTTP para respuestas mayores de 1 KiB, excepto autenticación. Páginas React diferidas, chunks separados y carga diferida de imágenes de anuncios. No se transforman imágenes externas; subir imágenes comprimidas y de tamaño acotado sigue siendo responsabilidad de publicación.

## Evidencia local — 15 de septiembre de 2026

| PA | Resultado y alcance de la evidencia |
|---|---|
| 01 | Login frío utilizable en **2.016 s**, objetivo ≤5 s, laboratorio agregado 512 Kbps y latencia 150 ms. Una muestra local, no garantía universal ni medición de todas las rutas. |
| 02 | PostgreSQL real: página 1/2 con tamaño 2, cuatro pacientes totales; respuestas de 829/787 bytes, IDs distintos. Prueba automática de límite/offset con 61 filas y límite máximo 50. Inspección visual de todos los listados pendiente. |
| 03 | Cancelación cubierta por prueba automática; búsqueda de pacientes aborta al cambiar texto. Revisión visual autenticada pendiente. |
| 04 | Conservación y recuperación cifrada implementada; prueba del almacenamiento. Simulación visual de desconexión en formularios autenticados pendiente. |
| 05 | Pruebas de cifrado, alteración, aislamiento y cierre de sesión; prueba del generador PWA verifica exclusiones. Inspección de caché real con sesión autenticada pendiente. |
| 06 | Pruebas verifican cero repeticiones automáticas de cuatro métodos de escritura. No se garantiza idempotencia de un reenvío manual en todos los dominios. |
| 07 | Dos procesos API locales: 30 solicitudes, reinicio de uno en 1.509 s, cero fallos. No se ejecutó aún un despliegue real con HAProxy/NGINX. |
| 08 | Prueba simula fallo de PostgreSQL y verifica disponibilidad falsa, independiente de liveness. Falta ensayo cortando PostgreSQL en despliegue aislado. |
| 09 | Backup cifrado y restauración real a base nueva: **83 tablas, 307 filas**, conteos coincidentes; 324191 bytes, 26.903 s. No demuestra recuperación de archivos externos ni desastre de producción. |
| 10 | Este informe registra método, tiempos, tamaño de respuestas y límites. Falta ampliar muestras/p95 y comprobación autenticada. |

Suite completa: **71 pruebas aprobadas**, incluidas arquitectura y regresiones existentes. Build de producción ejecutado correctamente. No hay cambios de modelos Prisma ni nuevas migraciones en esta historia; las cinco migraciones existentes estaban aplicadas. Regenerar Prisma exige detener previamente el backend si Windows mantiene bloqueada su DLL.

Tras la autorización explícita para el puerto 5187 se verificaron los logins de Médico y Paciente, el directorio, el historial clínico y el portal con atenciones, documentos, citas y notificaciones. La consola consultada no mostró errores. La revisión detectó y corrigió una inicialización del médico que interfería con la recuperación del borrador de atención: el texto se recuperó después de cerrar y recargar, sin registrar atención en PostgreSQL. Sigue pendiente el ensayo visual con desconexión real, la navegación de todas las páginas y el despliegue productivo; no debe presentarse la HU como validada al 100%.

## Reproducir

Referencia de ancho de banda: [SIN — Esquemas de conexión](https://siatanexo.impuestos.gob.bo/index.php/requerimientos/esquemas-de-conexion). Es una recomendación para facturación digital, utilizada aquí como escenario de laboratorio, no una certificación de rendimiento de MedicalSys. La política de caché está basada en [Service Workers de MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Desde backend:

```powershell
npm ci
npm test
npm run test:hu37
npx prisma migrate status
node scripts/hu37-lab.js smoke
npm run backup:verify
```

Desde frontend: `npm ci`, `npm run build`. Para medir el build frío, desde backend:

```powershell
$env:LAB_KBPS='512'
$env:LAB_LATENCY_MS='150'
node scripts/hu37-lab.js serve
```

Abrir http://127.0.0.1:5187/login en perfil limpio. La etiqueta del formulario expone `data-shell-ready-ms`; registrar tiempo hasta controles utilizables, errores de consola, bytes transferidos y repeticiones. El laboratorio usa puertos 3011/3012/5187, desactiva envíos WhatsApp y detiene solo sus propios procesos. No es un proxy de producción.

En DevTools, repetir con red lenta y Offline: escribir formulario, desconectar, comprobar valores, reconectar, guardar una vez y revisar el registro. Revisar Cache Storage (solo estáticos), sessionStorage (solo ciphertext de borradores) e IndexedDB (claves no exportables). Cerrar sesión y comprobar limpieza. Probar también distintos usuarios y tenants sin reutilización de borradores.

## Operación y despliegue

- `GET /api/live`: proceso vivo, sin depender de PostgreSQL.
- `GET /api/ready`: 200 disponible; 503 si falla PostgreSQL, vence el timeout o se está drenando.
- `GET /api/metrics`: contadores agregados de solicitudes, fallos, duración e inflight; sin expedientes. Restringir su exposición en el proxy de producción.
- SIGINT/SIGTERM detienen trabajos propios, rechazan nuevas solicitudes, drenan conexiones y desconectan clientes Prisma. Límite de cierre: 20 s.
- Pool: DB_POOL_SIZE=3, DB_POOL_TIMEOUT=10, DB_CONNECT_TIMEOUT=5 por cliente, configurable. Presupuestar conexiones como instancias × clientes tenant activos × pool, más workers y administración; no es un límite global. Para muchos tenants usar pool externo y monitorizar conexiones.
- `deploy/haproxy.cfg` configura dos APIs en 3001/3002, readiness y cero reenvíos automáticos. `deploy/nginx.conf.example` sirve el build y termina TLS; completar certificados, dominios y rutas reales.
- Iniciar dos instancias con PORT diferentes y mismo JWT_SECRET, claves de cifrado, políticas, PostgreSQL y almacenamiento compartido/R2. No usar uploads independientes por instancia.
- Ejecutar migraciones una sola vez antes de desplegar. Reiniciar una instancia por vez y esperar readiness. Workers promocionales/WhatsApp deben ejecutarse en un proceso dedicado o única instancia para no duplicar tareas.
- Logs JSON omiten cuerpos y consultas sensibles, sanitizan secretos. Enviar a agregador con retención y control de acceso. Alertar readiness, 5xx, latencia y saturación.
- Dos APIs no resuelven la caída de Internet de la clínica, del balanceador o del único PostgreSQL. HA de base, balanceador redundante y conexión secundaria son tareas de infraestructura; no están desplegadas aquí.

## Respaldo y restauración

Configurar PG_BIN y BACKUP_ENCRYPTION_KEY (32 bytes hexadecimales) mediante gestor de secretos; nunca Git. El script recibe credenciales por entorno, no argumentos, y escribe un archivo cifrado sin sobrescribirlo.

```powershell
node scripts/backup.js backup C:/Backups/medicalsys-20260915.enc
node scripts/backup.js restore C:/Backups/medicalsys-20260915.enc medicalsys_hu37_restore_20260915180000
```

Restore solo crea bases de prueba con ese patrón; no utiliza --clean ni modifica la original. La prueba creó `medicalsys_hu37_restore_20260915135432` y la conserva para inspección. Los respaldos temporales de verify usan clave efímera y no sustituyen respaldos de operación.

Política propuesta (requiere programación operativa): copia diaria cifrada, siete diarias/cuatro semanales/tres mensuales, copia fuera del servidor, claves guardadas separadamente; RPO objetivo 24 h y RTO objetivo 1 h, todavía no acreditados. Incluir uploads/R2 y configuración cifrada en el plan, verificar hashes y apertura/descifrado de documentos tras restaurar. Para RPO menor usar WAL/PITR. Ensayo mensual sobre base nueva, verificar conteos e integridad y documentar resultados antes de cambiar conexiones de producción.

El utilitario actual procesa el archivo en memoria, máximo 256 MiB de salida pg_dump y timeout acotado; bases mayores necesitan respaldo por streaming e infraestructura dedicada. La restauración observada valida esquema y conteos, no equivalencia completa de cada byte ni continuidad clínica.
