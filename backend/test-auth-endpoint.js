// Temporary test endpoint to get a token for the test user
// Add this to your backend routes for testing

import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './src/utils/database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Test endpoint to get a token for the test user
router.post('/test-login', async (req, res) => {
  try {
    // Find the test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Test user not found. Run the test script first.' });
    }

    // Generate JWT token
    const payload = {
      userId: user.id,
      email: user.email
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        oauthProvider: user.oauthProvider,
        oauthId: user.oauthId,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      },
      token,
      refreshToken: token // Using same token for simplicity in testing
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;