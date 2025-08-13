import { Progress as PrismaProgress } from '@prisma/client';

export interface Progress extends PrismaProgress {
  id: string;
  sectionsCompleted: string[];
  lastSection: string;
  totalTimeStudied: number;
  updatedAt: Date;
  createdAt: Date;
  userId: string;
  havrutaId: string;
}

export interface CreateProgressData {
  userId: string;
  havrutaId: string;
  lastSection?: string;
  sectionsCompleted?: string[];
  totalTimeStudied?: number;
}

export interface UpdateProgressData {
  sectionsCompleted?: string[];
  lastSection?: string;
  totalTimeStudied?: number;
}

export type ProgressWithRelations = Progress & {
  user?: any;
  havruta?: any;
};