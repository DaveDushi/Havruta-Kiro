import { prisma } from '../utils/database'

async function checkUser(email: string) {
  try {
    console.log(`🔍 Checking for user with email: ${email}`)
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            createdHavrutot: true,
            participantIn: true
          }
        }
      }
    })

    if (user) {
      console.log('✅ User found in database:')
      console.log('━'.repeat(50))
      console.log('ID:', user.id)
      console.log('Email:', user.email)
      console.log('Name:', user.name)
      console.log('Profile Picture:', user.profilePicture || 'None')
      console.log('OAuth Provider:', user.oauthProvider)
      console.log('OAuth ID:', user.oauthId)
      console.log('Created At:', user.createdAt.toISOString())
      console.log('Last Active:', user.lastActiveAt.toISOString())
      console.log('Created Havrutot:', user._count.createdHavrutot)
      console.log('Participating In:', user._count.participantIn)
      console.log('━'.repeat(50))
      return user
    } else {
      console.log('❌ User not found in database')
      return null
    }
  } catch (error) {
    console.error('💥 Error checking user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function listAllUsers() {
  try {
    console.log('📋 Listing all users in database:')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastActiveAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    if (users.length === 0) {
      console.log('📭 No users found in database')
    } else {
      console.log(`📊 Found ${users.length} user(s):`)
      console.log('━'.repeat(80))
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Created: ${user.createdAt.toISOString()}`)
        console.log(`   Last Active: ${user.lastActiveAt.toISOString()}`)
        console.log('   ' + '─'.repeat(70))
      })
    }
    
    return users
  } catch (error) {
    console.error('💥 Error listing users:', error)
    throw error
  }
}

// Get email from command line arguments or use default
const email = process.argv[2] || 'testuser@example.com'

// Run the checks
async function main() {
  console.log('🚀 Starting user database check...\n')
  
  // Check specific user
  await checkUser(email)
  
  console.log('\n')
  
  // List all users
  await listAllUsers()
}

main()
  .then(() => {
    console.log('\n🎉 Database check completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Database check failed:', error)
    process.exit(1)
  })