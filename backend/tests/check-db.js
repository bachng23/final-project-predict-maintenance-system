const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  console.log('--- Checking Decisions in DB ---');
  const decisions = await prisma.decision.findMany({
    include: {
      snapshot: {
        include: {
          bearing: true
        }
      }
    }
  });

  console.log(`Total decisions found: ${decisions.length}`);
  decisions.forEach(d => {
    console.log(`ID: ${d.id}, Status: ${d.decisionStatus}, Bearing: ${d.snapshot?.bearing?.bearingId || 'N/A'}`);
  });

  console.log('\n--- Checking Pending Decisions via logic ---');
  const pending = decisions.filter(d => d.decisionStatus === 'PENDING');
  console.log(`Logic count: ${pending.length}`);

  await prisma.$disconnect();
}

checkData().catch(console.error);
