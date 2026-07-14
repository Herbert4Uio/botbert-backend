require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const tenant = await db.collection('tenants').findOne({ name: 'Chocolates Taboada' });
  if (!tenant) {
    console.error('Tenant no encontrado. Ejecuta npm run seed primero.');
    process.exit(1);
  }

  const existingUser = await db.collection('users').findOne({ username: 'admin@empresa.com' });
  if (existingUser) {
    console.log('El usuario admin@empresa.com ya existe.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);

  await db.collection('users').insertOne({
    tenantId: tenant._id,
    username: 'admin@empresa.com',
    hashedPassword: hashedPassword,
    fullName: 'Administrador Principal',
    role: 'OWNER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('Usuario admin@empresa.com creado con contraseña: admin123');
  process.exit(0);
}

main().catch(console.error);
