import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { prisma } from '../utils/database'
import { havrutaService } from '../services/havrutaService'
import type { User } from '@prisma/client'

describe('HavrutaService', () => {
  let testUsers: User[] = []
  let testHavrutaId: string

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.havrutaParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-havruta-'
          }
        }
      }
    })
    await prisma.havruta.deleteMany({
      where: {
        owner: {
          email: {
            startsWith: 'test-havruta-'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-havruta-'
        }
      }
    })
  })

  beforeEach(async () => {
    // Create test users
    const userData = [
      {
        email: 'test-havruta-creator@example.com',
        name: 'Test Creator',
        oauthProvider: 'google',
        oauthId: 'test-creator-oauth-id'
      },
      {
        email: 'test-havruta-participant1@example.com',
        name: 'Test Participant 1',
        oauthProvider: 'google',
        oauthId: 'test-participant1-oauth-id'
      },
      {
        email: 'test-havruta-participant2@example.com',
        name: 'Test Participant 2',
        oauthProvider: 'google',
        oauthId: 'test-participant2-oauth-id'
      }
    ]

    for (const user of userData) {
      const createdUser = await prisma.user.create({ data: user })
      testUsers.push(createdUser)
    }
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.havrutaParticipant.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'test-havruta-'
          }
        }
      }
    })
    await prisma.havruta.deleteMany({
      where: {
        owner: {
          email: {
            startsWith: 'test-havruta-'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-havruta-'
        }
      }
    })
    testUsers = []
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('createHavruta', () => {
    it('should create a new Havruta with valid data', async () => {
      const creator = testUsers[0]
      const participant = testUsers[1]
      
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [participant.id]
      }

      const havruta = await havrutaService.createHavruta(havrutaData)

      expect(havruta).toBeDefined()
      expect(havruta.name).toBe('Test Havruta')
      expect(havruta.bookId).toBe('genesis')
      expect(havruta.bookTitle).toBe('Genesis')
      expect(havruta.creatorId).toBe(creator.id)
      expect(havruta.isActive).toBe(true)
      expect(havruta.participants).toHaveLength(2) // Creator + 1 participant
      
      testHavrutaId = havruta.id
    })

    it('should create a Havruta with only creator as participant', async () => {
      const creator = testUsers[0]
      
      const havrutaData = {
        name: 'Solo Havruta',
        bookId: 'exodus',
        bookTitle: 'Exodus',
        creatorId: creator.id,
        participantIds: []
      }

      const havruta = await havrutaService.createHavruta(havrutaData)

      expect(havruta.participants).toHaveLength(1) // Only creator
      expect(havruta.participants[0].user.id).toBe(creator.id)
    })

    it('should throw error if creator does not exist', async () => {
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: 'non-existent-id',
        participantIds: []
      }

      await expect(havrutaService.createHavruta(havrutaData)).rejects.toThrow('Creator not found')
    })

    it('should throw error if participant does not exist', async () => {
      const creator = testUsers[0]
      
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: ['non-existent-id']
      }

      await expect(havrutaService.createHavruta(havrutaData)).rejects.toThrow('One or more participants not found')
    })

    it('should throw error if too many participants', async () => {
      const creator = testUsers[0]
      
      // Create 8 additional test users (10 total with existing 2 + creator = 11 total)
      const additionalUsers = []
      for (let i = 0; i < 8; i++) {
        const user = await prisma.user.create({
          data: {
            email: `test-havruta-extra${i}@example.com`,
            name: `Extra User ${i}`,
            oauthProvider: 'google',
            oauthId: `test-extra${i}-oauth-id`
          }
        })
        additionalUsers.push(user)
      }
      
      // Create array of 10 participant IDs (would be 11 total with creator)
      const participantIds = [
        testUsers[1].id,
        testUsers[2].id,
        ...additionalUsers.map(u => u.id)
      ]
      
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds
      }

      await expect(havrutaService.createHavruta(havrutaData)).rejects.toThrow('Maximum 10 participants allowed')
      
      // Clean up additional users
      for (const user of additionalUsers) {
        await prisma.user.delete({ where: { id: user.id } })
      }
    })

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: testUsers[0].id,
        participantIds: []
      }

      await expect(havrutaService.createHavruta(invalidData)).rejects.toThrow('Validation error')
    })
  })

  describe('getHavrutaById', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [testUsers[1].id]
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should return Havruta with relations', async () => {
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)

      expect(havruta).toBeDefined()
      expect(havruta!.creator).toBeDefined()
      expect(havruta!.participants).toBeDefined()
      expect(havruta!._count).toBeDefined()
      expect(havruta!.participants).toHaveLength(2)
    })

    it('should return null for non-existent Havruta', async () => {
      const havruta = await havrutaService.getHavrutaById('non-existent-id')
      expect(havruta).toBeNull()
    })
  })

  describe('joinHavruta', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: []
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should allow user to join Havruta', async () => {
      const participant = testUsers[1]
      
      const result = await havrutaService.joinHavruta({
        userId: participant.id,
        havrutaId: testHavrutaId
      })

      expect(result).toBeDefined()
      expect(result.userId).toBe(participant.id)
      expect(result.havrutaId).toBe(testHavrutaId)

      // Verify participant was added
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta!.participants).toHaveLength(2) // Creator + new participant
    })

    it('should throw error if user does not exist', async () => {
      await expect(havrutaService.joinHavruta({
        userId: 'non-existent-id',
        havrutaId: testHavrutaId
      })).rejects.toThrow('User not found')
    })

    it('should throw error if Havruta does not exist', async () => {
      const participant = testUsers[1]
      
      await expect(havrutaService.joinHavruta({
        userId: participant.id,
        havrutaId: 'non-existent-id'
      })).rejects.toThrow('Havruta not found')
    })

    it('should throw error if user is already a participant', async () => {
      const creator = testUsers[0] // Creator is already a participant
      
      await expect(havrutaService.joinHavruta({
        userId: creator.id,
        havrutaId: testHavrutaId
      })).rejects.toThrow('User is already a participant')
    })

    it('should throw error if Havruta is inactive', async () => {
      // Deactivate the Havruta
      await prisma.havruta.update({
        where: { id: testHavrutaId },
        data: { isActive: false }
      })

      const participant = testUsers[1]
      
      await expect(havrutaService.joinHavruta({
        userId: participant.id,
        havrutaId: testHavrutaId
      })).rejects.toThrow('Cannot join inactive Havruta')
    })
  })

  describe('leaveHavruta', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [testUsers[1].id, testUsers[2].id]
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should allow participant to leave Havruta', async () => {
      const participant = testUsers[1]
      
      await havrutaService.leaveHavruta(participant.id, testHavrutaId)

      // Verify participant was removed
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta!.participants).toHaveLength(2) // Creator + 1 remaining participant
      
      const participantIds = havruta!.participants.map(p => p.user.id)
      expect(participantIds).not.toContain(participant.id)
    })

    it('should transfer ownership when creator leaves', async () => {
      const creator = testUsers[0]
      const newOwner = testUsers[1]
      
      await havrutaService.leaveHavruta(creator.id, testHavrutaId)

      // Verify ownership was transferred
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta!.creatorId).toBe(newOwner.id)
      
      // Verify creator was removed from participants
      const participantIds = havruta!.participants.map(p => p.user.id)
      expect(participantIds).not.toContain(creator.id)
    })

    it('should deactivate Havruta when last participant (creator) leaves', async () => {
      // First remove other participants
      await havrutaService.leaveHavruta(testUsers[1].id, testHavrutaId)
      await havrutaService.leaveHavruta(testUsers[2].id, testHavrutaId)
      
      // Now creator leaves (last participant)
      const creator = testUsers[0]
      await havrutaService.leaveHavruta(creator.id, testHavrutaId)

      // Verify Havruta was deactivated
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta!.isActive).toBe(false)
    })

    it('should throw error if user is not a participant', async () => {
      // Create a user that's not a participant
      const nonParticipant = await prisma.user.create({
        data: {
          email: 'test-havruta-nonparticipant@example.com',
          name: 'Non Participant',
          oauthProvider: 'google',
          oauthId: 'test-nonparticipant-oauth-id'
        }
      })

      await expect(havrutaService.leaveHavruta(nonParticipant.id, testHavrutaId))
        .rejects.toThrow('User is not a participant')

      // Clean up
      await prisma.user.delete({ where: { id: nonParticipant.id } })
    })
  })

  describe('updateHavruta', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: []
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should allow creator to update Havruta', async () => {
      const creator = testUsers[0]
      const updateData = {
        name: 'Updated Havruta Name',
        currentSection: 'Genesis 2:1'
      }

      const updatedHavruta = await havrutaService.updateHavruta(testHavrutaId, updateData, creator.id)

      expect(updatedHavruta.name).toBe('Updated Havruta Name')
      expect(updatedHavruta.currentSection).toBe('Genesis 2:1')
    })

    it('should throw error if non-creator tries to update', async () => {
      const nonCreator = testUsers[1]
      const updateData = { name: 'Unauthorized Update' }

      await expect(havrutaService.updateHavruta(testHavrutaId, updateData, nonCreator.id))
        .rejects.toThrow('Only the creator can update this Havruta')
    })

    it('should throw error if Havruta does not exist', async () => {
      const creator = testUsers[0]
      const updateData = { name: 'Update Non-existent' }

      await expect(havrutaService.updateHavruta('non-existent-id', updateData, creator.id))
        .rejects.toThrow('Havruta not found')
    })
  })

  describe('deleteHavruta', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: []
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should allow creator to delete Havruta', async () => {
      const creator = testUsers[0]

      await havrutaService.deleteHavruta(testHavrutaId, creator.id)

      // Verify Havruta was deleted
      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta).toBeNull()
    })

    it('should throw error if non-creator tries to delete', async () => {
      const nonCreator = testUsers[1]

      await expect(havrutaService.deleteHavruta(testHavrutaId, nonCreator.id))
        .rejects.toThrow('Only the creator can delete this Havruta')
    })
  })

  describe('getUserHavrutot', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const participant = testUsers[1]

      // Create multiple Havrutot for testing
      const havrutaData1 = {
        name: 'Active Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [participant.id]
      }
      
      const havrutaData2 = {
        name: 'Inactive Havruta',
        bookId: 'exodus',
        bookTitle: 'Exodus',
        creatorId: creator.id,
        participantIds: []
      }

      const havruta1 = await havrutaService.createHavruta(havrutaData1)
      const havruta2 = await havrutaService.createHavruta(havrutaData2)

      // Make second Havruta inactive
      await prisma.havruta.update({
        where: { id: havruta2.id },
        data: { isActive: false }
      })
    })

    it('should return user\'s Havrutot with pagination', async () => {
      const creator = testUsers[0]

      const result = await havrutaService.getUserHavrutot(creator.id, { page: '1', limit: '10' })

      expect(result.havrutot).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
    })

    it('should filter by active status', async () => {
      const creator = testUsers[0]

      const result = await havrutaService.getUserHavrutot(creator.id, { isActive: 'true' })

      expect(result.havrutot).toHaveLength(1)
      expect(result.havrutot[0].isActive).toBe(true)
    })

    it('should search by name and book title', async () => {
      const creator = testUsers[0]

      const result = await havrutaService.getUserHavrutot(creator.id, { search: 'genesis' })

      expect(result.havrutot).toHaveLength(1)
      expect(result.havrutot[0].bookTitle).toBe('Genesis')
    })
  })

  describe('getHavrutaState', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [testUsers[1].id]
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should return Havruta state', async () => {
      const state = await havrutaService.getHavrutaState(testHavrutaId)

      expect(state).toBeDefined()
      expect(state!.id).toBe(testHavrutaId)
      expect(state!.participantCount).toBe(2)
      expect(state!.activeParticipants).toHaveLength(2)
      expect(state!.isActive).toBe(true)
    })

    it('should return null for non-existent Havruta', async () => {
      const state = await havrutaService.getHavrutaState('non-existent-id')
      expect(state).toBeNull()
    })
  })

  describe('updateProgress', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: []
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should update Havruta progress', async () => {
      const creator = testUsers[0]
      const newSection = 'Genesis 2:1'

      await havrutaService.updateProgress(testHavrutaId, newSection, creator.id)

      const havruta = await havrutaService.getHavrutaById(testHavrutaId)
      expect(havruta!.currentSection).toBe(newSection)
      expect(havruta!.lastStudiedAt).toBeDefined()
    })

    it('should throw error if user is not a participant', async () => {
      const nonParticipant = testUsers[1] // Not added as participant
      const newSection = 'Genesis 2:1'

      await expect(havrutaService.updateProgress(testHavrutaId, newSection, nonParticipant.id))
        .rejects.toThrow('User is not a participant')
    })
  })

  describe('hasAccess', () => {
    beforeEach(async () => {
      const creator = testUsers[0]
      const havrutaData = {
        name: 'Test Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: [testUsers[1].id]
      }
      const havruta = await havrutaService.createHavruta(havrutaData)
      testHavrutaId = havruta.id
    })

    it('should return true for participants', async () => {
      const creator = testUsers[0]
      const participant = testUsers[1]

      const creatorAccess = await havrutaService.hasAccess(testHavrutaId, creator.id)
      const participantAccess = await havrutaService.hasAccess(testHavrutaId, participant.id)

      expect(creatorAccess).toBe(true)
      expect(participantAccess).toBe(true)
    })

    it('should return false for non-participants', async () => {
      const nonParticipant = testUsers[2]

      const access = await havrutaService.hasAccess(testHavrutaId, nonParticipant.id)

      expect(access).toBe(false)
    })
  })

  describe('getActiveHavrutot', () => {
    beforeEach(async () => {
      const creator = testUsers[0]

      // Create active and inactive Havrutot
      const activeHavrutaData = {
        name: 'Active Havruta',
        bookId: 'genesis',
        bookTitle: 'Genesis',
        creatorId: creator.id,
        participantIds: []
      }

      const inactiveHavrutaData = {
        name: 'Inactive Havruta',
        bookId: 'exodus',
        bookTitle: 'Exodus',
        creatorId: creator.id,
        participantIds: []
      }

      const activeHavruta = await havrutaService.createHavruta(activeHavrutaData)
      const inactiveHavruta = await havrutaService.createHavruta(inactiveHavrutaData)

      // Deactivate one Havruta
      await prisma.havruta.update({
        where: { id: inactiveHavruta.id },
        data: { isActive: false }
      })
    })

    it('should return only active Havrutot', async () => {
      const creator = testUsers[0]

      const activeHavrutot = await havrutaService.getActiveHavrutot(creator.id)

      expect(activeHavrutot).toHaveLength(1)
      expect(activeHavrutot[0].isActive).toBe(true)
      expect(activeHavrutot[0].name).toBe('Active Havruta')
    })

    it('should limit results to 5 Havrutot', async () => {
      const creator = testUsers[0]

      // Create 6 more active Havrutot (7 total)
      for (let i = 0; i < 6; i++) {
        await havrutaService.createHavruta({
          name: `Extra Havruta ${i}`,
          bookId: 'leviticus',
          bookTitle: 'Leviticus',
          creatorId: creator.id,
          participantIds: []
        })
      }

      const activeHavrutot = await havrutaService.getActiveHavrutot(creator.id)

      expect(activeHavrutot).toHaveLength(5) // Limited to 5
    })
  })
})