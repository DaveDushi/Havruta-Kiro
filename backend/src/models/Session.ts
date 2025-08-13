import { Session as PrismaSession } from '@prisma/client';

export interface Session extends PrismaSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  sectionsStudied: string[];
  isRecurring: boolean;
  createdAt: Date;
  havrutaId: string;
  recurrencePatternId: string | null;
}

export interface CreateSessionData {
  startTime: Date;
  havrutaId: string;
  isRecurring?: boolean;
  recurrencePatternId?: string;
}

export interface UpdateSessionData {
  endTime?: Date;
  sectionsStudied?: string[];
}

export type SessionWithRelations = Session & {
  havruta?: any;
  participants?: any[];
  recurrencePattern?: any;
};