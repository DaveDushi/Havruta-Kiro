import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🔍 Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful!');

    console.log('🔍 Checking database schema...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database schema is ready. Found ${userCount} users.`);

    console.log('🎯 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.log('\n📋 To set up the database:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Create a database named "havruta_db"');
    console.log('3. Update DATABASE_URL in .env file');
    console.log('4. Run: npm run db:push');
    console.log('5. Run: npm run db:seed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup function
setupDatabase();

export { setupDatabase };