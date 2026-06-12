import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Demo User ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@aiappgen.dev' },
    update: {},
    create: {
      email: 'demo@aiappgen.dev',
      name: 'Demo User',
      passwordHash,
    },
  });
  console.log('✅ Demo user created:', user.email);

  // ─── Demo App ──────────────────────────────────────────────────────────────
  const app = await prisma.app.upsert({
    where: { ownerId_slug: { ownerId: user.id, slug: 'hr-management' } },
    update: {},
    create: {
      name: 'HR Management',
      slug: 'hr-management',
      description: 'A sample HR management application built with the AI App Generator',
      ownerId: user.id,
    },
  });
  console.log('✅ Demo app created:', app.name);

  // ─── Metadata Version ──────────────────────────────────────────────────────
  const metadataDefinition = {
    name: 'HR Management',
    description: 'A sample HR management application',
    version: '1.0.0',
    entities: [
      {
        name: 'Employee',
        slug: 'employee',
        icon: 'Users',
        description: 'Company employees',
        fields: [
          { name: 'Full Name', slug: 'full_name', type: 'text', required: true, order: 0, displayIn: ['table', 'form', 'detail'] },
          { name: 'Email', slug: 'email', type: 'email', required: true, order: 1, displayIn: ['table', 'form', 'detail'] },
          { name: 'Department', slug: 'department', type: 'select', required: true, order: 2,
            options: [
              { label: 'Engineering', value: 'engineering' },
              { label: 'Marketing', value: 'marketing' },
              { label: 'Sales', value: 'sales' },
              { label: 'HR', value: 'hr' },
              { label: 'Finance', value: 'finance' },
            ],
            displayIn: ['table', 'form', 'detail'],
          },
          { name: 'Start Date', slug: 'start_date', type: 'date', required: true, order: 3, displayIn: ['table', 'form', 'detail'] },
          { name: 'Salary', slug: 'salary', type: 'number', required: false, order: 4, displayIn: ['form', 'detail'] },
          { name: 'Is Active', slug: 'is_active', type: 'boolean', required: false, defaultValue: true, order: 5, displayIn: ['table', 'form', 'detail'] },
        ],
        display: { labelField: 'full_name', defaultSort: 'full_name', searchableFields: ['full_name', 'email'] },
      },
      {
        name: 'Department',
        slug: 'department',
        icon: 'Building2',
        description: 'Company departments',
        fields: [
          { name: 'Name', slug: 'name', type: 'text', required: true, order: 0, displayIn: ['table', 'form', 'detail'] },
          { name: 'Budget', slug: 'budget', type: 'number', required: false, order: 1, displayIn: ['form', 'detail'] },
          { name: 'Manager Email', slug: 'manager_email', type: 'email', required: false, order: 2, displayIn: ['table', 'form', 'detail'] },
        ],
        display: { labelField: 'name', defaultSort: 'name', searchableFields: ['name'] },
      },
    ],
    navigation: [
      { label: 'Employees', entitySlug: 'employee', icon: 'Users', order: 0 },
      { label: 'Departments', entitySlug: 'department', icon: 'Building2', order: 1 },
    ],
  };

  await prisma.metadataVersion.upsert({
    where: { appId_version: { appId: app.id, version: 1 } },
    update: {},
    create: {
      appId: app.id,
      version: 1,
      definition: metadataDefinition,
      changelog: 'Initial version',
      isActive: true,
    },
  });
  console.log('✅ Metadata version created');

  // ─── Entities from metadata ────────────────────────────────────────────────
  const employeeEntity = await prisma.entity.upsert({
    where: { appId_slug: { appId: app.id, slug: 'employee' } },
    update: {},
    create: {
      appId: app.id,
      name: 'Employee',
      slug: 'employee',
      icon: 'Users',
      description: 'Company employees',
      displayConfig: { labelField: 'full_name', defaultSort: 'full_name', searchableFields: ['full_name', 'email'] },
    },
  });

  // Fields for Employee
  const employeeFields = [
    { name: 'Full Name', slug: 'full_name', type: 'text' as const, required: true, order: 0, displayIn: ['table', 'form', 'detail'] },
    { name: 'Email', slug: 'email', type: 'email' as const, required: true, order: 1, displayIn: ['table', 'form', 'detail'] },
    { name: 'Department', slug: 'department', type: 'select' as const, required: true, order: 2,
      options: [
        { label: 'Engineering', value: 'engineering' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Sales', value: 'sales' },
      ],
      displayIn: ['table', 'form', 'detail'],
    },
    { name: 'Start Date', slug: 'start_date', type: 'date' as const, required: true, order: 3, displayIn: ['table', 'form', 'detail'] },
    { name: 'Salary', slug: 'salary', type: 'number' as const, required: false, order: 4, displayIn: ['form', 'detail'] },
    { name: 'Is Active', slug: 'is_active', type: 'boolean' as const, required: false, order: 5, displayIn: ['table', 'form', 'detail'] },
  ];

  for (const field of employeeFields) {
    await prisma.entityField.upsert({
      where: { entityId_slug: { entityId: employeeEntity.id, slug: field.slug } },
      update: {},
      create: { entityId: employeeEntity.id, ...field, options: field.options || undefined },
    });
  }

  // Department Entity
  const deptEntity = await prisma.entity.upsert({
    where: { appId_slug: { appId: app.id, slug: 'department' } },
    update: {},
    create: {
      appId: app.id,
      name: 'Department',
      slug: 'department',
      icon: 'Building2',
      description: 'Company departments',
      displayConfig: { labelField: 'name', defaultSort: 'name', searchableFields: ['name'] },
    },
  });

  const deptFields = [
    { name: 'Name', slug: 'name', type: 'text' as const, required: true, order: 0, displayIn: ['table', 'form', 'detail'] },
    { name: 'Budget', slug: 'budget', type: 'number' as const, required: false, order: 1, displayIn: ['form', 'detail'] },
    { name: 'Manager Email', slug: 'manager_email', type: 'email' as const, required: false, order: 2, displayIn: ['table', 'form', 'detail'] },
  ];

  for (const field of deptFields) {
    await prisma.entityField.upsert({
      where: { entityId_slug: { entityId: deptEntity.id, slug: field.slug } },
      update: {},
      create: { entityId: deptEntity.id, ...field },
    });
  }

  // ─── Sample Records ────────────────────────────────────────────────────────
  const sampleEmployees = [
    { full_name: 'Alice Johnson', email: 'alice@company.com', department: 'engineering', start_date: '2022-03-01', salary: 95000, is_active: true },
    { full_name: 'Bob Smith', email: 'bob@company.com', department: 'marketing', start_date: '2021-07-15', salary: 78000, is_active: true },
    { full_name: 'Carol Williams', email: 'carol@company.com', department: 'sales', start_date: '2023-01-10', salary: 65000, is_active: true },
    { full_name: 'David Lee', email: 'david@company.com', department: 'engineering', start_date: '2020-11-20', salary: 110000, is_active: false },
    { full_name: 'Emma Davis', email: 'emma@company.com', department: 'hr', start_date: '2023-06-01', salary: 72000, is_active: true },
  ];

  for (const emp of sampleEmployees) {
    await prisma.entityRecord.create({
      data: { entityId: employeeEntity.id, data: emp },
    });
  }

  const sampleDepts = [
    { name: 'Engineering', budget: 500000, manager_email: 'alice@company.com' },
    { name: 'Marketing', budget: 200000, manager_email: 'bob@company.com' },
    { name: 'Sales', budget: 350000, manager_email: 'carol@company.com' },
  ];

  for (const dept of sampleDepts) {
    await prisma.entityRecord.create({
      data: { entityId: deptEntity.id, data: dept },
    });
  }
  console.log('✅ Sample records created');

  // ─── Demo Workflow ─────────────────────────────────────────────────────────
  await prisma.workflow.create({
    data: {
      appId: app.id,
      name: 'Notify on Employee Create',
      entityId: employeeEntity.id,
      trigger: 'record_created',
      isActive: true,
      actions: [
        {
          type: 'create_notification',
          config: {
            title: 'New Employee Added',
            message: 'Employee {{record.full_name}} was added to the system',
          },
        },
        {
          type: 'log_event',
          config: { level: 'info', message: 'Employee record created: {{record.full_name}}' },
        },
      ],
    },
  });
  console.log('✅ Demo workflow created');

  // ─── Demo Notification ─────────────────────────────────────────────────────
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'record_created',
      title: 'Welcome to AI App Generator!',
      message: 'Your demo HR Management app is ready to explore. Try creating entities, running workflows, and importing CSV data.',
      metadata: { appId: app.id },
    },
  });
  console.log('✅ Welcome notification created');

  // ─── Audit Log ─────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'app_created',
      resource: 'apps',
      resourceId: app.id,
      after: { name: app.name, slug: app.slug },
    },
  });
  console.log('✅ Audit log created');

  console.log('\n🎉 Seed complete!');
  console.log('📧 Login: demo@aiappgen.dev');
  console.log('🔑 Password: Demo1234!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
