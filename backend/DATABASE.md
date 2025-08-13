# Database Setup Guide

This document explains how to set up and manage the PostgreSQL database for the Havruta platform.

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js and npm installed
- Environment variables configured in `.env` file

## Database Schema

The database includes the following main entities:

- **Users**: OAuth-authenticated users with profile information
- **Havrutot**: Study groups with book selection and progress tracking
- **Sessions**: Individual study sessions with timing and content tracking
- **RecurrencePatterns**: Scheduling patterns for recurring sessions
- **Progress**: Individual user progress tracking per Havruta

## Setup Instructions

### 1. Install PostgreSQL

Make sure PostgreSQL is installed and running on your system.

### 2. Create Database

```sql
CREATE DATABASE havruta_db;
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update the `DATABASE_URL`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/havruta_db"
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Apply Database Schema

```bash
npm run db:push
```

Or use migrations:

```bash
npm run db:migrate
```

### 6. Seed Development Data

```bash
npm run db:seed
```

### 7. Verify Setup

```bash
npm run db:setup
```

## Development Workflow

### Making Schema Changes

1. Update `prisma/schema.prisma`
2. Generate new migration: `npm run db:migrate`
3. Apply changes: The migration will be applied automatically
4. Update seed data if needed: `npm run db:seed`

### Resetting Database

```bash
npx prisma migrate reset
npm run db:seed
```

### Viewing Database

```bash
npx prisma studio
```

## Production Deployment

### Environment Variables

Ensure these environment variables are set in production:

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Set to "production"

### Migration Commands

```bash
# Apply pending migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

## Troubleshooting

### Connection Issues

1. Verify PostgreSQL is running
2. Check database credentials in `.env`
3. Ensure database exists
4. Check firewall settings

### Migration Issues

1. Check migration files in `prisma/migrations/`
2. Verify database schema matches Prisma schema
3. Use `npx prisma db push` for development
4. Use `npx prisma migrate reset` to start fresh

### Performance

1. Monitor query performance with Prisma logging
2. Add database indexes for frequently queried fields
3. Use connection pooling in production
4. Monitor database metrics

## Schema Overview

```mermaid
erDiagram
    User ||--o{ Havruta : creates
    User ||--o{ HavrutaParticipant : participates
    User ||--o{ Progress : tracks
    User ||--o{ SessionParticipant : joins
    
    Havruta ||--o{ HavrutaParticipant : has
    Havruta ||--o{ Session : contains
    Havruta ||--o{ Progress : tracked_in
    
    Session ||--o{ SessionParticipant : includes
    Session }o--|| RecurrencePattern : follows
    
    User {
        string id PK
        string email UK
        string name
        string oauthProvider
        string oauthId UK
        datetime createdAt
        datetime lastActiveAt
    }
    
    Havruta {
        string id PK
        string name
        string bookId
        string bookTitle
        string currentSection
        boolean isActive
        datetime createdAt
        datetime lastStudiedAt
        int totalSessions
        string creatorId FK
    }
    
    Session {
        string id PK
        datetime startTime
        datetime endTime
        string[] sectionsStudied
        boolean isRecurring
        string havrutaId FK
        string recurrencePatternId FK
    }
```