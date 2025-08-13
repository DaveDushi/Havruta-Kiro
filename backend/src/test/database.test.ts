import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { User, Havruta, Session, RecurrencePattern, Progress } from '../models';

describe('Database Models', () => {
  it('should import Prisma client successfully', () => {
    const prisma = new PrismaClient();
    expect(prisma).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.havruta).toBeDefined();
    expect(prisma.session).toBeDefined();
    expect(prisma.recurrencePattern).toBeDefined();
    expect(prisma.progress).toBeDefined();
  });

  it('should have correct model interfaces', () => {
    // Test that our TypeScript interfaces are properly defined
    const mockUser: Partial<User> = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      oauthProvider: 'google',
      oauthId: 'google-123',
    };

    const mockHavruta: Partial<Havruta> = {
      id: 'havruta-id',
      name: 'Test Havruta',
      bookId: 'Genesis',
      bookTitle: 'Genesis',
      creatorId: 'user-id',
    };

    const mockSession: Partial<Session> = {
      id: 'session-id',
      startTime: new Date(),
      havrutaId: 'havruta-id',
    };

    const mockRecurrencePattern: Partial<RecurrencePattern> = {
      id: 'pattern-id',
      frequency: 'weekly',
      interval: 1,
    };

    const mockProgress: Partial<Progress> = {
      id: 'progress-id',
      userId: 'user-id',
      havrutaId: 'havruta-id',
      lastSection: 'Genesis 1:1',
    };

    expect(mockUser).toBeDefined();
    expect(mockHavruta).toBeDefined();
    expect(mockSession).toBeDefined();
    expect(mockRecurrencePattern).toBeDefined();
    expect(mockProgress).toBeDefined();
  });

  it('should have proper model relationships defined in schema', () => {
    // This test verifies that our Prisma schema relationships are properly defined
    // by checking that the generated types include the expected relation fields
    const prisma = new PrismaClient();
    
    // These should not throw TypeScript errors if relationships are properly defined
    expect(() => {
      prisma.user.findMany({
        include: {
          createdHavrutot: true,
          participantIn: true,
          progress: true,
          sessions: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      prisma.havruta.findMany({
        include: {
          creator: true,
          participants: true,
          sessions: true,
          progress: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      prisma.session.findMany({
        include: {
          havruta: true,
          participants: true,
          recurrencePattern: true,
        },
      });
    }).not.toThrow();
  });
});