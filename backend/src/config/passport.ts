import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import { authService, JWTPayload } from '../services/authService'

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        const name = profile.displayName
        const profilePicture = profile.photos?.[0]?.value

        if (!email) {
          return done(new Error('No email found in Google profile'), undefined)
        }

        const user = await authService.authenticateOAuth(
          'google',
          profile.id,
          email,
          name,
          profilePicture
        )

        return done(null, user)
      } catch (error) {
        return done(error, undefined)
      }
    }
  )
)

// Configure JWT Strategy for protected routes
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret-key'
    },
    async (payload: JWTPayload, done) => {
      try {
        const user = await authService.validateJWT(
          // We need to reconstruct the token for validation
          // In practice, this strategy validates the payload directly
          JSON.stringify(payload)
        )

        if (user) {
          // Update last active timestamp
          await authService.updateLastActive(user.id)
          return done(null, user)
        } else {
          return done(null, false)
        }
      } catch (error) {
        return done(error, false)
      }
    }
  )
)

// Serialize user for session (not used in JWT setup, but required by Passport)
passport.serializeUser((user: any, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await authService.validateJWT(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

export default passport