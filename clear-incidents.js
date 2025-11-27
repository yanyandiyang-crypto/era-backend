const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllIncidents() {
  try {
    console.log('🗑️ Clearing all incidents...\n');

    // Delete all incident updates first (due to foreign key)
    const deletedUpdates = await prisma.incidentUpdate.deleteMany({});
    console.log(`✅ Deleted ${deletedUpdates.count} incident updates`);

    // Delete all incidents
    const deletedIncidents = await prisma.incident.deleteMany({});
    console.log(`✅ Deleted ${deletedIncidents.count} incidents`);

    console.log('\n🎉 All incidents cleared successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllIncidents();