import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getHavrutaUrl() {
  const userId = 'cme9spkrc0000ngbfrkzjemi2'
  
  try {
    // Get the user's havruta
    const havruta = await prisma.havruta.findFirst({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    })
    
    if (havruta) {
      const url = `http://localhost:3000/study/${encodeURIComponent(havruta.bookTitle)}?sessionId=${havruta.id}&collaborative=true&ref=${encodeURIComponent(havruta.currentSection)}`
      
      console.log('=== HAVRUTA SESSION INFO ===')
      console.log('Havruta ID:', havruta.id)
      console.log('Book Title:', havruta.bookTitle)
      console.log('Current Section:', havruta.currentSection)
      console.log('Creator ID:', havruta.creatorId)
      console.log('Participants:', havruta.participants.map(p => ({ id: p.userId, name: p.user.name })))
      console.log('')
      console.log('=== USE THIS URL ===')
      console.log(url)
      console.log('')
    } else {
      console.log('No havruta found for user:', userId)
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getHavrutaUrl()