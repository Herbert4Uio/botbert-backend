import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('No MONGODB_URI found in .env');
  process.exit(1);
}

async function run() {
  console.log('Connecting to database...');
  const conn = await mongoose.createConnection(MONGODB_URI as string).asPromise();
  console.log('Connected!');

  console.log('Dropping database...');
  await conn.dropDatabase();
  console.log('Database dropped.');

  console.log('Creating initial data...');

  const tenantSchema = new mongoose.Schema({ 
    name: String, 
    plan: String,
    whatsappNumber: String,
    systemPrompt: String,
    aiMemoryLimit: Number,
    qrImageBase64: String,
    isActive: Boolean 
  }, { timestamps: true });
  
  const branchSchema = new mongoose.Schema({ 
    tenantId: mongoose.Schema.Types.ObjectId, 
    name: String, 
    cityId: mongoose.Schema.Types.ObjectId, 
    address: String, 
    isActive: Boolean,
    isBusinessHoursEnabled: Boolean,
    businessHoursStart: String,
    businessHoursEnd: String,
    outOfHoursMessage: String
  }, { timestamps: true });

  const userSchema = new mongoose.Schema({ 
    tenantId: mongoose.Schema.Types.ObjectId,
    sucursalId: mongoose.Schema.Types.ObjectId,
    username: String,
    hashedPassword: String,
    fullName: String,
    role: String,
    isActive: Boolean
  }, { timestamps: true });

  const citySchema = new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String,
    isActive: Boolean
  }, { timestamps: true });

  const Tenant = conn.model('Tenant', tenantSchema);
  const Branch = conn.model('Branch', branchSchema);
  const User = conn.model('User', userSchema);
  const City = conn.model('City', citySchema);

  // 1. Create Tenant
  const tenant = await Tenant.create({
    name: 'Empresa Principal',
    plan: 'PREMIUM',
    systemPrompt: 'Eres el asistente virtual de la Empresa Principal...',
    aiMemoryLimit: 10,
    isActive: true
  });
  console.log('Created Tenant:', tenant.name);

  // 1.5 Create City
  const city = await City.create({
    tenantId: tenant._id,
    name: 'La Paz',
    isActive: true
  });
  console.log('Created City:', city.name);

  // 2. Create Branch
  const branch = await Branch.create({
    tenantId: tenant._id,
    name: 'Sucursal Central',
    cityId: city._id,
    address: 'Av. Siempre Viva 123',
    isActive: true
  });
  console.log('Created Branch:', branch.name);

  // 3. Create Users
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const superadmin = await User.create({
    tenantId: null,
    username: 'superadmin@whatbot.com',
    hashedPassword,
    fullName: 'Master Superadmin',
    role: 'SUPERADMIN',
    isActive: true
  });

  const owner = await User.create({
    tenantId: tenant._id,
    username: 'admin@empresa.com',
    hashedPassword,
    fullName: 'Dueño de Empresa',
    role: 'OWNER',
    isActive: true
  });

  const admin = await User.create({
    tenantId: tenant._id,
    sucursalId: branch._id,
    username: 'gerente@empresa.com',
    hashedPassword,
    fullName: 'Gerente Sucursal',
    role: 'ADMIN',
    isActive: true
  });

  const viewer = await User.create({
    tenantId: tenant._id,
    sucursalId: branch._id,
    username: 'vendedor@empresa.com',
    hashedPassword,
    fullName: 'Vendedor Visualizador',
    role: 'VIEWER',
    isActive: true
  });

  console.log('Users created successfully!');
  console.log('--------------------------------');
  console.log('CREDENTIALS:');
  console.log('--------------------------------');
  console.log(`SUPERADMIN (Master) -> Email: superadmin@whatbot.com | Password: ${password}`);
  console.log(`OWNER (Dueño)      -> Email: admin@empresa.com | Password: ${password}`);
  console.log(`ADMIN (Gerente)    -> Email: gerente@empresa.com | Password: ${password}`);
  console.log(`VIEWER (Vendedor)  -> Email: vendedor@empresa.com | Password: ${password}`);
  console.log('--------------------------------');

  await conn.close();
  console.log('Disconnected!');
  process.exit(0);
}

run().catch(console.error);
