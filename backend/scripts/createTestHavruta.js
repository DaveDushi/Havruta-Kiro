import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestHavruta() {
  const userId = 'cme9spkrc0000ngbfrkzjemi2'
  
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!user) {
      console.log('User not found, creating user...')
      await prisma.user.create({
        data: {
          id: userId,
          name: 'Test User',
          email: 'test@example.com'
        }
      })
      console.log('User created')
    } else {
      console.log('User found:', user.name)
    }
    
    // Check existing havrutas for this user
    const existingHavrutas = await prisma.havruta.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: {
        participants: true
      }
    })
    
    console.log('Existing havrutas:', existingHavrutas.length)
    
    if (existingHavrutas.length === 0) {
      // Create a test havruta
      console.log('Creating test havruta...')
      const havruta = await prisma.havruta.create({
        data: {
          name: 'Test Havruta Session',
          bookId: 'berakhot',
          bookTitle: 'Berakhot',
          creatorId: userId,
          currentSection: 'Berakhot 2a',
          isActive: true
        }
      })
      
      // Add user as participant
      await prisma.havrutaParticipant.create({
        data: {
          userId: userId,
          havrutaId: havruta.id
        }
      })
      
      console.log('Test havruta created:', havruta.id)
      return havruta.id
    } else {
      console.log('Using existing havruta:', existingHavrutas[0].id)
      return existingHavrutas[0].id
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestHavruta()