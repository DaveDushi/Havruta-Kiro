# Havruta Platform

A collaborative Jewish text study platform that enables synchronized learning sessions with real-time text navigation and video communication.

## Project Structure

This is a monorepo containing:
- `frontend/` - React.js web application
- `backend/` - Node.js API server with Socket.io

## Prerequisites

- Node.js 18+ 
- npm 9+
- PostgreSQL database
- Redis server

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

3. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both applications for production
- `npm run test` - Run tests for both applications
- `npm run lint` - Run linting for both applications

## Individual Application Scripts

### Frontend
- `npm run dev:frontend` - Start frontend development server
- `npm run build:frontend` - Build frontend for production
- `npm run test:frontend` - Run frontend tests

### Backend
- `npm run dev:backend` - Start backend development server
- `npm run build:backend` - Build backend for production
- `npm run test:backend` - Run backend tests

## Technology Stack

### Frontend
- React 18 with TypeScript
- Material-UI for components
- Vite for build tooling
- Socket.io client for real-time features
- React Router for navigation

### Backend
- Node.js with Express
- TypeScript
- Socket.io for real-time communication
- Prisma ORM with PostgreSQL
- Passport.js for OAuth authentication
- Redis for caching and session management

## Development

The project uses TypeScript throughout with strict type checking enabled. ESLint is configured for code quality and consistency.

Path aliases are set up for cleaner imports:
- Frontend: `@/` maps to `src/`
- Backend: `@/` maps to `src/`