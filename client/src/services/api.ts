// 🔗 Centralized API Service Layer with Error Handling & Retry Logic

import type { Toilet, InsertToilet, Review, InsertReview, Report, InsertReport } from '@/types/toilet'

// 🛡️ Enhanced fetch with retry logic and error handling
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// ⚡ Fetch with exponential backoff retry
const fetchWithRetry = async (
  url: string, 
  options: RequestInit = {}, 
  retries = 3
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // Don't retry on 4xx errors (client errors)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        const errorText = await response.text()
        throw new APIError(
          errorText || response.statusText,
          response.status,
          url
        )
      }

      if (!response.ok && i === retries - 1) {
        // Last retry failed
        const errorText = await response.text()
        throw new APIError(
          errorText || response.statusText,
          response.status,
          url
        )
      }

      if (response.ok) {
        return response
      }

    } catch (error) {
      if (error instanceof APIError) {
        throw error // Re-throw API errors
      }

      if (i === retries - 1) {
        // Last retry failed
        throw new APIError(
          'Network request failed',
          0,
          url,
          error as Error
        )
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000))
    }
  }

  throw new APIError('Max retries exceeded', 0, url)
}

// 🎯 Toilet API Service
class ToiletAPI {
  private baseURL = '/api'

  // 📍 Get toilets in viewport bounds
  async getToiletsInViewport(bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }): Promise<Toilet[]> {
    const params = new URLSearchParams({
      minLat: bounds.minLat.toString(),
      maxLat: bounds.maxLat.toString(),
      minLng: bounds.minLng.toString(),
      maxLng: bounds.maxLng.toString()
    })

    const response = await fetchWithRetry(
      `${this.baseURL}/toilets-in-area?${params}`
    )
    
    return await response.json()
  }

  // 🌍 Get toilets by location and radius
  async getToiletsByLocation(
    lat: number, 
    lng: number, 
    radiusKm: number = 15
  ): Promise<Toilet[]> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: radiusKm.toString()
    })

    const response = await fetchWithRetry(
      `${this.baseURL}/toilets?${params}`
    )
    
    return await response.json()
  }

  // 🏢 Get all toilets (use with caution)
  async getAllToilets(): Promise<Toilet[]> {
    const response = await fetchWithRetry(`${this.baseURL}/toilets`)
    return await response.json()
  }

  // ➕ Create new toilet
  async createToilet(toilet: InsertToilet): Promise<Toilet> {
    const response = await fetchWithRetry(`${this.baseURL}/toilets`, {
      method: 'POST',
      body: JSON.stringify(toilet),
    })

    return await response.json()
  }

  // 🗑️ Delete toilet (admin only)
  async deleteToilet(
    toiletId: string, 
    adminEmail: string, 
    userId: string
  ): Promise<void> {
    await fetchWithRetry(`${this.baseURL}/toilets/${toiletId}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminEmail, userId }),
    })
  }

  // ⭐ Get reviews for toilet
  async getToiletReviews(toiletId: string): Promise<Review[]> {
    const response = await fetchWithRetry(
      `${this.baseURL}/toilets/${toiletId}/reviews`
    )
    
    return await response.json()
  }

  // 📝 Add review to toilet
  async addReview(toiletId: string, review: InsertReview): Promise<Review> {
    const response = await fetchWithRetry(
      `${this.baseURL}/toilets/${toiletId}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(review),
      }
    )

    return await response.json()
  }

  // 👤 Check if user has reviewed toilet
  async getUserReviewStatus(toiletId: string, userId: string): Promise<{ hasReviewed: boolean }> {
    const params = new URLSearchParams({ userId })
    const response = await fetchWithRetry(
      `${this.baseURL}/toilets/${toiletId}/user-review?${params}`
    )
    
    return await response.json()
  }

  // 🚨 Report toilet issues
  async reportToilet(report: InsertReport): Promise<void> {
    await fetchWithRetry(`${this.baseURL}/reports`, {
      method: 'POST',
      body: JSON.stringify(report),
    })
  }
}

// 🏥 Health API Service
class HealthAPI {
  private baseURL = '/api'

  async getHealthStatus(): Promise<{
    status: string
    timestamp: number
    database: string
    requests: number
  }> {
    const response = await fetchWithRetry(`${this.baseURL}/health`)
    return await response.json()
  }
}

// 📊 Analytics API Service (for future implementation)
class AnalyticsAPI {
  private baseURL = '/api'

  async trackEvent(event: string, properties?: Record<string, any>): Promise<void> {
    // Implementation for analytics tracking
    console.log('Analytics event:', event, properties)
  }

  async trackPageView(page: string): Promise<void> {
    await this.trackEvent('page_view', { page })
  }

  async trackToiletInteraction(action: string, toiletId: string): Promise<void> {
    await this.trackEvent('toilet_interaction', { action, toiletId })
  }
}

// 🚀 Create service instances
export const toiletAPI = new ToiletAPI()
export const healthAPI = new HealthAPI()
export const analyticsAPI = new AnalyticsAPI()

// Export the error class for error handling
export { APIError }

// 🔧 Utility functions
export const isNetworkError = (error: unknown): boolean => {
  return error instanceof APIError && error.status === 0
}

export const isServerError = (error: unknown): boolean => {
  return error instanceof APIError && error.status >= 500
}

export const isClientError = (error: unknown): boolean => {
  return error instanceof APIError && error.status >= 400 && error.status < 500
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof APIError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}