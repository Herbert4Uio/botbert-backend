require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const tenants = await db.collection('tenants').find().toArray();
  console.log('Tenants:', tenants);
  process.exit(0);
}
main().catch(console.error);
