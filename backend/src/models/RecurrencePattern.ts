import { RecurrencePattern as PrismaRecurrencePattern } from '@prisma/client';

export type RecurrenceFrequency = 'once' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly';

export interface RecurrencePattern extends PrismaRecurrencePattern {
  id: string;
  frequency: string;
  interval: number;
  endDate: Date | null;
  daysOfWeek: number[];
  createdAt: Date;
}

export interface CreateRecurrencePatternData {
  frequency: RecurrenceFrequency;
  interval?: number;
  endDate?: Date;
  daysOfWeek?: number[];
}

export interface UpdateRecurrencePatternData {
  frequency?: RecurrenceFrequency;
  interval?: number;
  endDate?: Date;
  daysOfWeek?: number[];
}

export type RecurrencePatternWithRelations = RecurrencePattern & {
  sessions?: any[];
};