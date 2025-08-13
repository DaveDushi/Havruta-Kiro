import { prisma } from '../utils/database'

async function addTestUser() {
  try {
    console.log('Adding test user to database...')
    
    const testUser = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        name: 'Test User',
        oauthProvider: 'google',
        oauthId: 'test-oauth-123',
        profilePicture: 'https://via.placeholder.com/150'
      }
    })

    console.log('✅ Test user created successfully:')
    console.log('ID:', testUser.id)
    console.log('Email:', testUser.email)
    console.log('Name:', testUser.name)
    console.log('Created At:', testUser.createdAt)
    
    return testUser
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log('⚠️  User with this email already exists')
      
      // Try to find the existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: 'testuser@example.com' }
      })
      
      if (existingUser) {
        console.log('📋 Existing user details:')
        console.log('ID:', existingUser.id)
        console.log('Email:', existingUser.email)
        console.log('Name:', existingUser.name)
        console.log('Created At:', existingUser.createdAt)
        return existingUser
      }
    } else {
      console.error('❌ Error creating test user:', error)
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
addTestUser()
  .then(() => {
    console.log('🎉 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })