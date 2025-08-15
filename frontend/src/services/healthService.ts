const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export const healthService = {
  async checkHealth(): Promise<{ status: string; timestamp: string; database: string }> {
    const response = await fetch(`${API_BASE_URL}/health`)
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`)
    }
    
    return response.json()
  }
}