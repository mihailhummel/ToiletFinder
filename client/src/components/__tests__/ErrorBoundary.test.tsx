import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ErrorBoundary, { MapErrorBoundary, ToiletErrorBoundary } from '../ErrorBoundary'

// 🧪 Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('renders error UI when there is an error', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
    consoleSpy.mockRestore()
  })

  it('calls retry handler when Try Again is clicked', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    const retryButton = screen.getByText('Try Again')
    await user.click(retryButton)
    
    // After retry, re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    consoleSpy.mockRestore()
  })
})

describe('MapErrorBoundary', () => {
  it('renders map-specific error message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <MapErrorBoundary>
        <ThrowError shouldThrow={true} />
      </MapErrorBoundary>
    )
    
    expect(screen.getByText('Map Error')).toBeInTheDocument()
    expect(screen.getByText('Unable to load the map. Please refresh the page.')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })
})

describe('ToiletErrorBoundary', () => {
  it('renders toilet-specific error message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ToiletErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ToiletErrorBoundary>
    )
    
    expect(screen.getByText('Toilet Operation Failed')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong with this toilet operation. Please try again.')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })
})