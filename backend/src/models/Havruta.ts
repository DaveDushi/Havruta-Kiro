import { Havruta as PrismaHavruta } from '@prisma/client';

export interface Havruta extends PrismaHavruta {
  id: string;
  name: string;
  bookId: string;
  bookTitle: string;
  currentSection: string;
  isActive: boolean;
  createdAt: Date;
  lastStudiedAt: Date | null;
  totalSessions: number;
  creatorId: string;
}

export interface CreateHavrutaData {
  name: string;
  bookId: string;
  bookTitle: string;
  creatorId: string;
  currentSection?: string;
}

export interface UpdateHavrutaData {
  name?: string;
  currentSection?: string;
  isActive?: boolean;
  lastStudiedAt?: Date;
  totalSessions?: number;
}

export type HavrutaWithRelations = Havruta & {
  creator?: any;
  participants?: any[];
  sessions?: any[];
  progress?: any[];
};