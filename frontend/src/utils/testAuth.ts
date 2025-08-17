// Test authentication utility for development
// This allows testing the havruta creation without going through OAuth

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface TestLoginResponse {
  user: {
    id: string
    email: string
    name: string
    profilePicture?: string
    oauthProvider: string
    oauthId: string
    createdAt: string
    lastActiveAt: string
  }
  token: string
  refreshToken: string
}

export async function testLogin(): Promise<TestLoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/test/test-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Store tokens in localStorage
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('refreshToken', data.refreshToken)
    
    return data
  } catch (error) {
    console.error('Test login failed:', error)
    throw error
  }
}

export function isTestMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_TEST_MODE === 'true'
}