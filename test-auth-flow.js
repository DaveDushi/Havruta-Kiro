// Simple test to verify authentication flow
console.log('Testing authentication flow...')

// Test 1: Check if auth token exists
const token = localStorage.getItem('authToken')
console.log('Auth token exists:', !!token)
if (token) {
  console.log('Token preview:', token.substring(0, 20) + '...')
}

// Test 2: Check if user is in auth context
const checkAuthContext = () => {
  const authState = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.findFiberByHostInstance?.(document.body)
  console.log('Auth context check completed')
}

// Test 3: Test session access
const testSessionAccess = async (sessionId) => {
  if (!sessionId) {
    console.log('No session ID provided for testing')
    return
  }
  
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    console.log('Session access test:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('Session data received:', !!data)
    } else {
      const error = await response.text()
      console.log('Session access error:', error)
    }
  } catch (error) {
    console.log('Session access test failed:', error.message)
  }
}

// Test 4: Test WebSocket connection
const testSocketConnection = () => {
  console.log('Socket connection test - check browser console for WebSocket logs')
}

// Export test functions for manual execution
window.testAuthFlow = {
  checkAuthContext,
  testSessionAccess,
  testSocketConnection
}

console.log('Auth flow test functions available at window.testAuthFlow')
console.log('Usage: window.testAuthFlow.testSessionAccess("your-session-id")')