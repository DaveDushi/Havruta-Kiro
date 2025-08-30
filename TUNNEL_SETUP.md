# Cloudflare Tunnel Setup Guide

This guide explains how to configure the Havruta platform for both local development and Cloudflare tunnel access.

## 🏗️ Architecture

The application is designed to be modular and environment-aware:

- **Code fallbacks**: Always use `localhost` for maximum compatibility
- **Environment variables**: Override fallbacks when using tunnels
- **No hardcoded URLs**: Everything is configurable via `.env` files

## 🔧 Configuration

### Local Development (Default)

The code defaults to localhost, so no configuration is needed for local development:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- API: `http://localhost:3001/api`

### Cloudflare Tunnel

To enable tunnel access, set these environment variables:

**Frontend (.env)**:
```env
VITE_BASE_URL=https://havruta.daviddusi.com
VITE_API_URL=https://havruta.daviddusi.com/api
```

**Backend (.env)**:
```env
FRONTEND_URL=https://havruta.daviddusi.com
```

## 🚀 Setup Steps

### 1. Environment Files

Copy the example files and configure as needed:

```bash
# Frontend
cp frontend/.env.example frontend/.env

# Backend  
cp backend/.env.example backend/.env
```

### 2. Cloudflare Tunnel Configuration

Set up your Cloudflare tunnel to point to `http://localhost:3000`:

```bash
cloudflared tunnel --hostname havruta.daviddusi.com --url http://localhost:3000
```

### 3. Vite Configuration

The Vite config is already set up for tunnel support:

- Allows external hosts
- Proxies `/api/*` to backend
- Supports WebSocket over WSS
- HMR over secure WebSocket

### 4. Google OAuth Setup

Configure your Google OAuth application:

**For Tunnel Access**:
- Authorized JavaScript origins: `https://havruta.daviddusi.com`
- Authorized redirect URIs: `https://havruta.daviddusi.com/api/auth/google/callback`

**For Local Development**:
- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`

## 🔍 Verification

Run the verification script to check your configuration:

```bash
node verify-tunnel-config.js
```

## 🏃‍♂️ Running the Application

1. Start the backend:
   ```bash
   cd backend && npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Access the application:
   - **Local**: `http://localhost:3000`
   - **Tunnel**: `https://havruta.daviddusi.com`

## 💡 Benefits of This Approach

1. **Developer Friendly**: Works out of the box with localhost
2. **Modular**: Easy to switch between local and tunnel modes
3. **Future Proof**: New developers can clone and run without tunnel setup
4. **Flexible**: Environment variables control all external URLs
5. **Secure**: Proper CORS, CSP, and proxy configuration

## 🔄 Switching Modes

To switch between local and tunnel modes, simply update the environment variables in your `.env` files. No code changes required!

## 🐛 Troubleshooting

- **CORS errors**: Check that `FRONTEND_URL` matches your access method
- **OAuth issues**: Verify Google OAuth URLs match your environment
- **WebSocket problems**: Ensure tunnel supports WebSocket connections
- **HMR not working**: Check that WSS is properly configured in Vite

Run `node verify-tunnel-config.js` to diagnose configuration issues.