import { User as PrismaUser } from '@prisma/client';

export interface User extends PrismaUser {
  id: string;
  email: string;
  name: string;
  profilePicture: string | null;
  oauthProvider: string;
  oauthId: string;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  profilePicture?: string | null;
  oauthProvider: string;
  oauthId: string;
}

export interface UpdateUserData {
  name?: string;
  profilePicture?: string | null;
  lastActiveAt?: Date;
}

export type UserWithRelations = User & {
  createdHavrutot?: any[];
  participantIn?: any[];
  progress?: any[];
  sessions?: any[];
};