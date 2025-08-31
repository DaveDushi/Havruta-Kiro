import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.invitation.deleteMany();
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
      lastPlace: 'Genesis 1:4', // Current location where they left off
      ownerId: user1.id, // Alice is the owner with special privileges
      lastStudiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      totalSessions: 5,
    },
  });

  const havruta2 = await prisma.havruta.create({
    data: {
      name: 'Talmud Bavli - Berakhot',
      bookId: 'Berakhot',
      bookTitle: 'Berakhot',
      lastPlace: 'Berakhot 3a', // Current location where they left off
      ownerId: user2.id, // Bob is the owner with special privileges
      lastStudiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      totalSessions: 12,
    },
  });

  const havruta3 = await prisma.havruta.create({
    data: {
      name: 'Mishnah Avot',
      bookId: 'Pirkei Avot',
      bookTitle: 'Pirkei Avot',
      lastPlace: 'Avot 1:1', // Starting from the beginning
      ownerId: user3.id, // Sarah is the owner with special privileges
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
  
  // Completed scheduled session
  const session1 = await prisma.session.create({
    data: {
      type: 'scheduled',
      status: 'completed',
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
      startingSection: 'Genesis 1:1', // Where the session began
      endingSection: 'Genesis 1:4', // Where the session ended
      coverageRange: 'Genesis 1:1 to Genesis 1:4', // Full range covered
      sectionsStudied: ['Genesis 1:1', 'Genesis 1:2', 'Genesis 1:3'], // Deprecated field
      havrutaId: havruta1.id,
      isRecurring: true,
      recurrencePatternId: weeklyPattern.id,
    },
  });

  // Completed instant session
  const session2 = await prisma.session.create({
    data: {
      type: 'instant',
      status: 'completed',
      startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000), // 1.5 hours later
      startingSection: 'Berakhot 2a', // Where the session began
      endingSection: 'Berakhot 3a', // Where the session ended
      coverageRange: 'Berakhot 2a to Berakhot 3a', // Full range covered
      sectionsStudied: ['Berakhot 2a', 'Berakhot 2b'], // Deprecated field
      havrutaId: havruta2.id,
      isRecurring: true,
      recurrencePatternId: biWeeklyPattern.id,
    },
  });

  // Future scheduled session
  const futureSession = await prisma.session.create({
    data: {
      type: 'scheduled',
      status: 'scheduled',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      startingSection: 'Avot 1:1', // Will start from Havruta's lastPlace
      havrutaId: havruta3.id,
      isRecurring: false,
    },
  });

  // Active instant session (for testing)
  const activeSession = await prisma.session.create({
    data: {
      type: 'instant',
      status: 'active',
      startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
      startingSection: 'Genesis 1:4', // Started from Havruta's lastPlace
      havrutaId: havruta1.id,
      isRecurring: false,
    },
  });

  // Add session participants
  console.log('👥 Adding session participants...');
  await prisma.sessionParticipant.createMany({
    data: [
      // Completed scheduled session participants
      { userId: user1.id, sessionId: session1.id },
      { userId: user2.id, sessionId: session1.id },
      
      // Completed instant session participants
      { userId: user1.id, sessionId: session2.id },
      { userId: user2.id, sessionId: session2.id },
      { userId: user3.id, sessionId: session2.id },
      
      // Future scheduled session participants
      { userId: user3.id, sessionId: futureSession.id },
      { userId: user1.id, sessionId: futureSession.id },
      
      // Active instant session participants
      { userId: user1.id, sessionId: activeSession.id },
      { userId: user2.id, sessionId: activeSession.id },
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

  // Create sample invitations
  console.log('📧 Creating sample invitations...');
  await prisma.invitation.createMany({
    data: [
      {
        inviteeEmail: 'david@example.com',
        status: 'pending',
        invitationToken: 'token_david_genesis_123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        inviterUserId: user1.id,
        havrutaId: havruta1.id,
      },
      {
        inviteeEmail: 'rachel@example.com',
        status: 'pending',
        invitationToken: 'token_rachel_berakhot_456',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        inviterUserId: user2.id,
        havrutaId: havruta2.id,
      },
      {
        inviteeEmail: 'expired@example.com',
        status: 'expired',
        invitationToken: 'token_expired_789',
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (expired)
        inviterUserId: user3.id,
        havrutaId: havruta3.id,
      },
    ],
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`Created ${await prisma.user.count()} users`);
  console.log(`Created ${await prisma.havruta.count()} Havrutot`);
  console.log(`Created ${await prisma.session.count()} sessions`);
  console.log(`Created ${await prisma.recurrencePattern.count()} recurrence patterns`);
  console.log(`Created ${await prisma.progress.count()} progress records`);
  console.log(`Created ${await prisma.invitation.count()} invitations`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });