const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function setupMultitenantUsers() {
  console.log('--- Setting up Multi-Tenant Users and Roles ---');

  // 1. Fix UTF-8 encoding in organizacion table
  await prisma.$executeRawUnsafe(`UPDATE public.organizacion SET nombre = 'Clínica Cumed' WHERE codigo = 'cumed'`);
  await prisma.$executeRawUnsafe(`UPDATE public.organizacion SET nombre = 'Centro Médico San Rafael' WHERE codigo = 'sanrafael'`);

  // 2. Ensure SUPERADMIN role exists
  const existingSuperRole = await prisma.rol.findFirst({ where: { codigo: 'SUPERADMIN' } });
  let superRoleId = existingSuperRole?.id_rol;
  if (!existingSuperRole) {
    const createdRole = await prisma.rol.create({
      data: {
        codigo: 'SUPERADMIN',
        nombre: 'Superadministrador SaaS',
        descripcion: 'Administración global de la plataforma MedicalSys SaaS, gestión de tenants y planes',
        activo: true
      }
    });
    superRoleId = createdRole.id_rol;
  }

  // Get ADMINISTRADOR role
  const adminRole = await prisma.rol.findFirst({ where: { codigo: 'ADMINISTRADOR' } });
  const adminRoleId = adminRole.id_rol;

  // 3. Password hash
  const passwordHash = await bcrypt.hash('MedicalSys2026!', 12);

  // 4. Create/update SuperAdmin user
  const superadmin = await prisma.usuario.upsert({
    where: { email: 'superadmin@medicalsys.test' },
    update: {
      nombres: 'SuperAdmin',
      apellidos: 'SaaS Platform',
      id_rol: superRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    },
    create: {
      email: 'superadmin@medicalsys.test',
      nombres: 'SuperAdmin',
      apellidos: 'SaaS Platform',
      id_rol: superRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    }
  });
  console.log('Superadmin user ready:', superadmin.email, '(ID:', superadmin.id_usuario.toString(), ')');

  // 5. Update admin@medicalsys.test
  const admin1 = await prisma.usuario.findUnique({ where: { email: 'admin@medicalsys.test' } });
  console.log('Admin1 user ready:', admin1?.email, '(ID:', admin1?.id_usuario.toString(), ')');

  // 6. Create/update admin2@medicalsys.test (Admin of San Rafael)
  const admin2 = await prisma.usuario.upsert({
    where: { email: 'admin2@medicalsys.test' },
    update: {
      nombres: 'Administrador',
      apellidos: 'San Rafael',
      id_rol: adminRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    },
    create: {
      email: 'admin2@medicalsys.test',
      nombres: 'Administrador',
      apellidos: 'San Rafael',
      id_rol: adminRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    }
  });
  console.log('Admin2 user ready:', admin2.email, '(ID:', admin2.id_usuario.toString(), ')');

  // Alias admin.sanrafael@medicalsys.test
  const adminSanRafaelAlias = await prisma.usuario.upsert({
    where: { email: 'admin.sanrafael@medicalsys.test' },
    update: {
      nombres: 'Administrador',
      apellidos: 'San Rafael',
      id_rol: adminRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    },
    create: {
      email: 'admin.sanrafael@medicalsys.test',
      nombres: 'Administrador',
      apellidos: 'San Rafael',
      id_rol: adminRoleId,
      password_hash: passwordHash,
      estado: 'ACTIVO'
    }
  });
  console.log('Admin San Rafael alias ready:', adminSanRafaelAlias.email);

  // 7. Get organization IDs
  const orgs = await prisma.$queryRawUnsafe('SELECT id_organizacion, codigo, nombre FROM public.organizacion');
  const cumedOrg = orgs.find(o => o.codigo === 'cumed');
  const sanrafaelOrg = orgs.find(o => o.codigo === 'sanrafael');

  console.log('Organizations:', orgs);

  // 8. Clean up and set strict usuario_organizacion
  await prisma.$executeRawUnsafe(`
    DELETE FROM public.usuario_organizacion
    WHERE id_usuario IN (${admin1.id_usuario}, ${admin2.id_usuario}, ${adminSanRafaelAlias.id_usuario}, ${superadmin.id_usuario})
  `);

  // Link admin1 ONLY to cumed
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.usuario_organizacion (id_usuario, id_organizacion, rol_en_organizacion, activo)
    VALUES (${admin1.id_usuario}, ${cumedOrg.id_organizacion}, 'ADMINISTRADOR', true)
  `);

  // Link admin2 and alias ONLY to sanrafael
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.usuario_organizacion (id_usuario, id_organizacion, rol_en_organizacion, activo)
    VALUES (${admin2.id_usuario}, ${sanrafaelOrg.id_organizacion}, 'ADMINISTRADOR', true),
           (${adminSanRafaelAlias.id_usuario}, ${sanrafaelOrg.id_organizacion}, 'ADMINISTRADOR', true)
  `);

  // SuperAdmin gets access to all organizations
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.usuario_organizacion (id_usuario, id_organizacion, rol_en_organizacion, activo)
    VALUES (${superadmin.id_usuario}, ${cumedOrg.id_organizacion}, 'SUPERADMIN', true),
           (${superadmin.id_usuario}, ${sanrafaelOrg.id_organizacion}, 'SUPERADMIN', true)
  `);

  // Link clinical staff (medico, recepcionista, paciente, osi) to cumed
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.usuario_organizacion (id_usuario, id_organizacion, rol_en_organizacion, activo)
    SELECT u.id_usuario, ${cumedOrg.id_organizacion}, r.codigo, true
    FROM public.usuario u
    JOIN public.rol r ON r.id_rol = u.id_rol
    WHERE u.id_usuario NOT IN (${admin2.id_usuario}, ${adminSanRafaelAlias.id_usuario}, ${superadmin.id_usuario})
    ON CONFLICT (id_usuario, id_organizacion) DO NOTHING
  `);

  console.log('Done: Strict multi-tenant user and organization bindings established.');
  await prisma.$disconnect();
}

if (require.main === module) {
  setupMultitenantUsers().catch(err => {
    console.error('Error configuring multi-tenant users:', err);
    process.exit(1);
  });
}

module.exports = setupMultitenantUsers;
