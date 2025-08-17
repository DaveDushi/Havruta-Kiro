import nodemailer from 'nodemailer'
import { z } from 'zod'

export interface HavrutaInvitation {
  havrutaId: string
  havrutaName: string
  bookTitle: string
  inviterName: string
  joinLink: string
  invitationToken: string
}

export interface InvitationResult {
  successful: string[]
  failed: { email: string; reason: string }[]
  existingUsers: string[]
  newUsers: string[]
}

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

const emailValidationSchema = z.string().email('Invalid email format')

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private isConfigured = false

  constructor() {
    this.initializeTransporter()
  }

  /**
   * Initialize email transporter with configuration
   */
  private initializeTransporter(): void {
    try {
      // Check if email configuration is available
      const emailConfig = this.getEmailConfig()
      
      if (emailConfig) {
        this.transporter = nodemailer.createTransport(emailConfig)
        this.isConfigured = true
        console.log('Email service initialized successfully')
      } else {
        console.warn('Email service not configured - email functionality will be disabled')
        this.isConfigured = false
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      this.isConfigured = false
    }
  }

  /**
   * Get email configuration from environment variables
   */
  private getEmailConfig(): EmailConfig | null {
    const host = process.env.EMAIL_HOST
    const port = process.env.EMAIL_PORT
    const user = process.env.EMAIL_USER
    const pass = process.env.EMAIL_PASS

    if (!host || !port || !user || !pass) {
      return null
    }

    return {
      host,
      port: parseInt(port, 10),
      secure: port === '465', // true for 465, false for other ports
      auth: {
        user,
        pass
      }
    }
  }

  /**
   * Validate email format
   */
  validateEmailFormat(email: string): boolean {
    try {
      emailValidationSchema.parse(email.trim())
      return true
    } catch {
      return false
    }
  }

  /**
   * Send Havruta invitation email
   */
  async sendHavrutaInvitation(
    email: string, 
    invitation: HavrutaInvitation,
    isNewUser: boolean = false
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email service is not configured')
    }

    if (!this.validateEmailFormat(email)) {
      throw new Error('Invalid email format')
    }

    const subject = `You're invited to join "${invitation.havrutaName}" on Havruta`
    
    const htmlContent = this.generateInvitationEmailHTML(invitation, isNewUser)
    const textContent = this.generateInvitationEmailText(invitation, isNewUser)

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@havruta.app',
        to: email.trim(),
        subject,
        text: textContent,
        html: htmlContent
      })

      console.log(`Invitation email sent successfully to ${email}`)
    } catch (error) {
      console.error(`Failed to send invitation email to ${email}:`, error)
      throw new Error(`Failed to send email to ${email}`)
    }
  }

  /**
   * Generate HTML content for invitation email
   */
  private generateInvitationEmailHTML(invitation: HavrutaInvitation, isNewUser: boolean): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Havruta Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
          .highlight { background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Havruta Invitation</h1>
        </div>
        
        <div class="content">
          <h2>You're invited to study together!</h2>
          
          <p>Hello!</p>
          
          <p><strong>${invitation.inviterName}</strong> has invited you to join their Havruta study group on the Havruta platform.</p>
          
          <div class="highlight">
            <h3>📖 Study Group Details:</h3>
            <ul>
              <li><strong>Havruta Name:</strong> ${invitation.havrutaName}</li>
              <li><strong>Text:</strong> ${invitation.bookTitle}</li>
              <li><strong>Invited by:</strong> ${invitation.inviterName}</li>
            </ul>
          </div>
          
          ${isNewUser ? `
            <p>Since this is your first time using Havruta, you'll need to create an account first. Don't worry - it's quick and easy using your Google account!</p>
            
            <p><strong>To join this study group:</strong></p>
            <ol>
              <li>Click the button below to visit Havruta</li>
              <li>Sign up using your Google account</li>
              <li>You'll automatically be added to "${invitation.havrutaName}"</li>
              <li>Start studying together!</li>
            </ol>
          ` : `
            <p>You already have a Havruta account, so joining is easy! Just click the button below and you'll be automatically added to the study group.</p>
          `}
          
          <div style="text-align: center;">
            <a href="${invitation.joinLink}" class="button">
              ${isNewUser ? 'Join Havruta & Accept Invitation' : 'Accept Invitation'}
            </a>
          </div>
          
          <p><strong>What is Havruta?</strong></p>
          <p>Havruta is a collaborative learning platform for Jewish text study. You can study together in real-time with synchronized text navigation, built-in video calling, and progress tracking.</p>
          
          <p>If you have any questions, feel free to reach out to ${invitation.inviterName} or visit our help center.</p>
        </div>
        
        <div class="footer">
          <p>This invitation will expire in 7 days. If you're having trouble with the link above, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #1976d2;">${invitation.joinLink}</p>
          
          <p style="margin-top: 20px;">
            <small>© 2025 Havruta Platform. This email was sent because ${invitation.inviterName} invited you to join their study group.</small>
          </p>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate plain text content for invitation email
   */
  private generateInvitationEmailText(invitation: HavrutaInvitation, isNewUser: boolean): string {
    return `
You're invited to join "${invitation.havrutaName}" on Havruta!

Hello!

${invitation.inviterName} has invited you to join their Havruta study group.

Study Group Details:
- Havruta Name: ${invitation.havrutaName}
- Text: ${invitation.bookTitle}
- Invited by: ${invitation.inviterName}

${isNewUser ? `
Since this is your first time using Havruta, you'll need to create an account first. 

To join this study group:
1. Visit the link below
2. Sign up using your Google account
3. You'll automatically be added to "${invitation.havrutaName}"
4. Start studying together!
` : `
You already have a Havruta account, so joining is easy! Just visit the link below and you'll be automatically added to the study group.
`}

Accept Invitation: ${invitation.joinLink}

What is Havruta?
Havruta is a collaborative learning platform for Jewish text study. You can study together in real-time with synchronized text navigation, built-in video calling, and progress tracking.

If you have any questions, feel free to reach out to ${invitation.inviterName}.

This invitation will expire in 7 days.

© 2025 Havruta Platform
    `.trim()
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email connection test failed:', error)
      return false
    }
  }

  /**
   * Send a test email
   */
  async sendTestEmail(to: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email service is not configured')
    }

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@havruta.app',
      to,
      subject: 'Havruta Email Service Test',
      text: 'This is a test email from the Havruta platform. If you received this, the email service is working correctly.',
      html: `
        <h2>Email Service Test</h2>
        <p>This is a test email from the Havruta platform.</p>
        <p>If you received this, the email service is working correctly.</p>
      `
    })
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.isConfigured
  }
}

export const emailService = new EmailService()
export default emailService