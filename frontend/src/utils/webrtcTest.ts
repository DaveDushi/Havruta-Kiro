/**
 * WebRTC Test Utilities
 * Helper functions to test WebRTC functionality
 */

export interface WebRTCTestResult {
  success: boolean
  message: string
  details?: any
}

/**
 * Test if WebRTC is supported in the browser
 */
export function testWebRTCSupport(): WebRTCTestResult {
  try {
    if (!window.RTCPeerConnection) {
      return {
        success: false,
        message: 'WebRTC is not supported in this browser'
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        message: 'Media devices API is not supported'
      }
    }

    return {
      success: true,
      message: 'WebRTC is supported'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error checking WebRTC support',
      details: error
    }
  }
}

/**
 * Test camera and microphone access
 */
export async function testMediaAccess(videoEnabled: boolean = true): Promise<WebRTCTestResult> {
  try {
    const constraints = {
      video: videoEnabled,
      audio: true
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    
    // Clean up the stream
    stream.getTracks().forEach(track => track.stop())

    return {
      success: true,
      message: `Media access successful (video: ${videoEnabled ? 'enabled' : 'disabled'})`
    }
  } catch (error: any) {
    let message = 'Failed to access media devices'
    
    if (error.name === 'NotAllowedError') {
      message = 'Camera/microphone access denied by user'
    } else if (error.name === 'NotFoundError') {
      message = 'No camera/microphone found'
    } else if (error.name === 'NotReadableError') {
      message = 'Camera/microphone is already in use'
    }

    return {
      success: false,
      message,
      details: error
    }
  }
}

/**
 * Test STUN server connectivity
 */
export async function testSTUNConnectivity(): Promise<WebRTCTestResult> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })

      let candidateReceived = false
      const timeout = setTimeout(() => {
        pc.close()
        if (!candidateReceived) {
          resolve({
            success: false,
            message: 'STUN server connectivity test timed out'
          })
        }
      }, 5000)

      pc.onicecandidate = (event) => {
        if (event.candidate && !candidateReceived) {
          candidateReceived = true
          clearTimeout(timeout)
          pc.close()
          resolve({
            success: true,
            message: 'STUN server connectivity successful',
            details: event.candidate
          })
        }
      }

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('test')
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer)
      }).catch(error => {
        clearTimeout(timeout)
        pc.close()
        resolve({
          success: false,
          message: 'Failed to create offer for STUN test',
          details: error
        })
      })

    } catch (error) {
      resolve({
        success: false,
        message: 'Error during STUN connectivity test',
        details: error
      })
    }
  })
}

/**
 * Run all WebRTC tests
 */
export async function runWebRTCTests(): Promise<{
  support: WebRTCTestResult
  mediaAccess: WebRTCTestResult
  stunConnectivity: WebRTCTestResult
  overall: WebRTCTestResult
}> {
  const support = testWebRTCSupport()
  
  let mediaAccess: WebRTCTestResult = { success: false, message: 'Skipped due to WebRTC support failure' }
  let stunConnectivity: WebRTCTestResult = { success: false, message: 'Skipped due to WebRTC support failure' }

  if (support.success) {
    mediaAccess = await testMediaAccess()
    stunConnectivity = await testSTUNConnectivity()
  }

  const overall: WebRTCTestResult = {
    success: support.success && mediaAccess.success && stunConnectivity.success,
    message: support.success && mediaAccess.success && stunConnectivity.success 
      ? 'All WebRTC tests passed' 
      : 'Some WebRTC tests failed'
  }

  return {
    support,
    mediaAccess,
    stunConnectivity,
    overall
  }
}