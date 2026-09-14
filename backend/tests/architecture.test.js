const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..', 'src');
const projectRoot = path.resolve(__dirname, '..', '..');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
}

function relative(file) {
  return path.relative(projectRoot, file).replaceAll('\\', '/');
}

function violations(files, pattern) {
  return files.flatMap((file) => {
    const content = fs.readFileSync(file, 'utf8');
    return pattern.test(content) ? [relative(file)] : [];
  });
}

test('PA-01, PA-06 y PA-08: Prisma solo pertenece a configuración y repositorios', () => {
  const forbiddenDirectories = ['controllers', 'middleware', 'routes', 'services'];
  const files = forbiddenDirectories.flatMap((directory) => javascriptFiles(path.join(backendRoot, directory)));
  const directPersistence = /(?:config\/prisma|@prisma\/client|\bprisma\.|\bPrisma\.|\$queryRaw|\$executeRaw|\$transaction)/;
  assert.deepEqual(violations(files, directPersistence), []);

  const controllerFiles = javascriptFiles(path.join(backendRoot, 'controllers'));
  assert.deepEqual(violations(controllerFiles, /require\(['"]\.\.\/repositories\//), []);
  assert.deepEqual(violations(controllerFiles, /\.status\(4\d\d\)/), []);
});

test('PA-02: los servicios no reciben objetos HTTP de Express', () => {
  const files = javascriptFiles(path.join(backendRoot, 'services'));
  const expressDependency = /require\(['"]express['"]\)|from\s+['"]express['"]/;
  const expressHandlerParameters = /\([^)]*\b(?:req|request)\b[^)]*\b(?:res|response)\b[^)]*\)/;
  assert.deepEqual(violations(files, expressDependency), []);
  assert.deepEqual(violations(files, expressHandlerParameters), []);
});

test('PA-03: SQL y operaciones inseguras permanecen fuera de las capas superiores', () => {
  const upperLayerDirectories = ['controllers', 'middleware', 'routes', 'services'];
  const files = upperLayerDirectories.flatMap(
    (directory) => javascriptFiles(path.join(backendRoot, directory))
  );
  const sqlStatement = /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+[a-z_]+\s+SET|DELETE\s+FROM)\b/;
  assert.deepEqual(violations(files, sqlStatement), []);

  const repositoryFiles = javascriptFiles(path.join(backendRoot, 'repositories'));
  assert.deepEqual(violations(repositoryFiles, /\$(?:queryRawUnsafe|executeRawUnsafe)/), []);
});

test('PA-04 y PA-07: las rutas solo conectan middleware con controladores', () => {
  const routeFiles = javascriptFiles(path.join(backendRoot, 'routes'));
  assert.deepEqual(violations(routeFiles, /require\(['"]\.\.\/services\//), []);
  assert.deepEqual(violations(routeFiles, /router\.(?:get|post|put|patch|delete)\([^;]*async\s*\(/s), []);

  const securityRoute = fs.readFileSync(path.join(backendRoot, 'routes', 'security.routes.js'), 'utf8');
  assert.match(securityRoute, /controllers\/security\.controller/);
  const securityController = fs.readFileSync(path.join(backendRoot, 'controllers', 'security.controller.js'), 'utf8');
  assert.match(securityController, /services\/security\.service/);
  const securityService = fs.readFileSync(path.join(backendRoot, 'services', 'security.service.js'), 'utf8');
  assert.match(securityService, /repositories\/security\.repository/);
});

test('cada dominio funcional cuenta con un repositorio explícito', () => {
  const requiredRepositories = [
    'user', 'patient', 'history', 'appointment', 'room', 'document',
    'consent', 'billing', 'notification', 'campaign', 'loyalty'
  ];
  const repositoryDirectory = path.join(backendRoot, 'repositories');
  const missing = requiredRepositories.filter(
    (name) => !fs.existsSync(path.join(repositoryDirectory, `${name}.repository.js`))
  );
  assert.deepEqual(missing, []);
});

test('PA-05: el frontend no depende de Prisma, SQL ni módulos internos del backend', () => {
  const frontendFiles = javascriptFiles(path.join(projectRoot, 'frontend', 'src'));
  const serverDependency = /(?:@prisma\/client|config\/prisma|backend\/src|\$queryRaw|\$executeRaw)/;
  assert.deepEqual(violations(frontendFiles, serverDependency), []);
});
