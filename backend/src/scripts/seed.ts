import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.progress.deleteMany();
    await prisma.sessionParticipant.deleteMany();
    await prisma.session.deleteMany();
    await prisma.recurrencePattern.deleteMany();
    await prisma.havrutaParticipant.deleteMany();
    await prisma.havruta.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create test users
  console.log('👥 Creating test users...');
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice Cohen',
      oauthProvider: 'google',
      oauthId: 'google_alice_123',
      profilePicture: 'https://example.com/alice.jpg',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob Goldstein',
      oauthProvider: 'google',
      oauthId: 'google_bob_456',
      profilePicture: 'https://example.com/bob.jpg',
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: 'sarah@example.com',
      name: 'Sarah Levy',
      oauthProvider: 'google',
      oauthId: 'google_sarah_789',
    },
  });

  // Create recurrence patterns
  console.log('🔄 Creating recurrence patterns...');
  const weeklyPattern = await prisma.recurrencePattern.create({
    data: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3], // Monday and Wednesday
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    },
  });

  const biWeeklyPattern = await prisma.recurrencePattern.create({
    data: {
      frequency: 'bi-weekly',
      interval: 2,
      daysOfWeek: [0], // Sunday
    },
  });

  // Create test Havrutot
  console.log('📚 Creating test Havrutot...');
  const havruta1 = await prisma.havruta.create({
    data: {
      name: 'Genesis Study Group',
      bookId: 'Genesis',
      bookTitle: 'Genesis',
      currentSection: 'Genesis 1:1',
      creatorId: user1.id,
      lastStudiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      totalSessions: 5,
    },
  });

  const havruta2 = await prisma.havruta.create({
    data: {
      name: 'Talmud Bavli - Berakhot',
      bookId: 'Berakhot',
      bookTitle: 'Berakhot',
      currentSection: 'Berakhot 2a',
      creatorId: user2.id,
      lastStudiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      totalSessions: 12,
    },
  });

  const havruta3 = await prisma.havruta.create({
    data: {
      name: 'Mishnah Avot',
      bookId: 'Pirkei Avot',
      bookTitle: 'Pirkei Avot',
      currentSection: 'Avot 1:1',
      creatorId: user3.id,
      totalSessions: 0,
    },
  });

  // Add participants to Havrutot
  console.log('👥 Adding participants to Havrutot...');
  await prisma.havrutaParticipant.createMany({
    data: [
      { userId: user1.id, havrutaId: havruta1.id },
      { userId: user2.id, havrutaId: havruta1.id },
      { userId: user1.id, havrutaId: havruta2.id },
      { userId: user2.id, havrutaId: havruta2.id },
      { userId: user3.id, havrutaId: havruta2.id },
      { userId: user3.id, havrutaId: havruta3.id },
      { userId: user1.id, havrutaId: havruta3.id },
    ],
  });

  // Create test sessions
  console.log('📅 Creating test sessions...');
  const session1 = await prisma.session.create({
    data: {
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
      sectionsStudied: ['Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3'],
      havrutaId: havruta1.id,
      isRecurring: true,
      recurrencePatternId: weeklyPattern.id,
    },
  });

  const session2 = await prisma.session.create({
    data: {
      startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), // 1.5 hours later
      sectionsStudied: ['Berakhot 2a', 'Berakhot 2b'],
      havrutaId: havruta2.id,
      isRecurring: true,
      recurrencePatternId: biWeeklyPattern.id,
    },
  });

  // Future scheduled session
  const futureSession = await prisma.session.create({
    data: {
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      havrutaId: havruta3.id,
      isRecurring: false,
    },
  });

  // Add session participants
  console.log('👥 Adding session participants...');
  await prisma.sessionParticipant.createMany({
    data: [
      { userId: user1.id, sessionId: session1.id },
      { userId: user2.id, sessionId: session1.id },
      { userId: user1.id, sessionId: session2.id },
      { userId: user2.id, sessionId: session2.id },
      { userId: user3.id, sessionId: session2.id },
      { userId: user3.id, sessionId: futureSession.id },
      { userId: user1.id, sessionId: futureSession.id },
    ],
  });

  // Create progress records
  console.log('📈 Creating progress records...');
  await prisma.progress.createMany({
    data: [
      {
        userId: user1.id,
        havrutaId: havruta1.id,
        sectionsCompleted: ['Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3'],
        lastSection: 'Genesis 1:3',
        totalTimeStudied: 180, // 3 hours
      },
      {
        userId: user2.id,
        havrutaId: havruta1.id,
        sectionsCompleted: ['Genesis 1:1', 'Genesis 1:2'],
        lastSection: 'Genesis 1:2',
        totalTimeStudied: 120, // 2 hours
      },
      {
        userId: user1.id,
        havrutaId: havruta2.id,
        sectionsCompleted: ['Berakhot 2a'],
        lastSection: 'Berakhot 2a',
        totalTimeStudied: 90, // 1.5 hours
      },
      {
        userId: user2.id,
        havrutaId: havruta2.id,
        sectionsCompleted: ['Berakhot 2a', 'Berakhot 2b'],
        lastSection: 'Berakhot 2b',
        totalTimeStudied: 210, // 3.5 hours
      },
      {
        userId: user3.id,
        havrutaId: havruta2.id,
        sectionsCompleted: ['Berakhot 2a'],
        lastSection: 'Berakhot 2a',
        totalTimeStudied: 90, // 1.5 hours
      },
    ],
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`Created ${await prisma.user.count()} users`);
  console.log(`Created ${await prisma.havruta.count()} Havrutot`);
  console.log(`Created ${await prisma.session.count()} sessions`);
  console.log(`Created ${await prisma.recurrencePattern.count()} recurrence patterns`);
  console.log(`Created ${await prisma.progress.count()} progress records`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });