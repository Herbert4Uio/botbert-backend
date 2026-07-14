const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/whatbot');
  const db = mongoose.connection.db;

  const products = await db.collection('products').find().toArray();
  console.log('\n--- PRODUCTOS EN BD ---');
  products.forEach(p => console.log(`[${p.codeProduct}] ${p.name} - $${p.price}`));

  const tenants = await db.collection('tenants').find().toArray();
  console.log('\n--- TENANTS EN BD ---');
  tenants.forEach(t => console.log(`${t._id}: ${t.name}`));

  const branches = await db.collection('branches').find().toArray();
  console.log('\n--- BRANCHES EN BD ---');
  branches.forEach(b => console.log(`${b._id} (Tenant: ${b.tenantId}): ${b.name}`));

  process.exit(0);
}

main().catch(console.error);
