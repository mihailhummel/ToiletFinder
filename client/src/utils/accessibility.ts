// ♿ Accessibility Utilities and Improvements

// 🎯 ARIA live region for dynamic announcements
export const createLiveRegion = (level: 'polite' | 'assertive' = 'polite') => {
  const liveRegion = document.createElement('div')
  liveRegion.setAttribute('aria-live', level)
  liveRegion.setAttribute('aria-atomic', 'true')
  liveRegion.style.position = 'absolute'
  liveRegion.style.left = '-10000px'
  liveRegion.style.width = '1px'
  liveRegion.style.height = '1px'
  liveRegion.style.overflow = 'hidden'
  
  document.body.appendChild(liveRegion)
  return liveRegion
}

// 📢 Announce to screen readers
let liveRegion: HTMLElement | null = null

export const announce = (message: string, level: 'polite' | 'assertive' = 'polite') => {
  if (!liveRegion) {
    liveRegion = createLiveRegion(level)
  }
  
  // Clear previous message
  liveRegion.textContent = ''
  
  // Add new message after a brief delay to ensure it's announced
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message
    }
  }, 100)
}

// ⌨️ Keyboard navigation utilities
export const trapFocus = (element: HTMLElement) => {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>
  
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  
  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus()
        e.preventDefault()
      }
    }
  }
  
  element.addEventListener('keydown', handleTabKey)
  
  // Focus the first element
  firstElement?.focus()
  
  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleTabKey)
  }
}

// 🎨 High contrast mode detection
export const isHighContrastMode = (): boolean => {
  // Check for Windows High Contrast mode
  if (window.matchMedia('(prefers-contrast: high)').matches) {
    return true
  }
  
  // Fallback detection method
  const testElement = document.createElement('div')
  testElement.style.color = 'rgb(31, 32, 33)'
  testElement.style.backgroundColor = 'rgb(31, 32, 33)'
  document.body.appendChild(testElement)
  
  const computedStyle = window.getComputedStyle(testElement)
  const isHighContrast = computedStyle.color !== computedStyle.backgroundColor
  
  document.body.removeChild(testElement)
  return isHighContrast
}

// 🔄 Reduced motion preference
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// 🎯 Focus management for modals
export class FocusManager {
  private previousActiveElement: HTMLElement | null = null
  private focusTrapCleanup: (() => void) | null = null
  
  trapFocus(container: HTMLElement) {
    this.previousActiveElement = document.activeElement as HTMLElement
    this.focusTrapCleanup = trapFocus(container)
  }
  
  restoreFocus() {
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup()
      this.focusTrapCleanup = null
    }
    
    if (this.previousActiveElement) {
      this.previousActiveElement.focus()
      this.previousActiveElement = null
    }
  }
}

// 🏷️ Generate accessible IDs
export const generateId = (prefix: string = 'toilet-finder'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 📝 ARIA labels for common UI patterns
export const getToiletAriaLabel = (toilet: any): string => {
  const parts = []
  
  if (toilet.title) {
    parts.push(toilet.title)
  } else {
    parts.push(`${toilet.type || 'Public'} toilet`)
  }
  
  if (toilet.averageRating) {
    parts.push(`rated ${toilet.averageRating} out of 5 stars`)
  } else {
    parts.push('not yet rated')
  }
  
  if (toilet.accessibility === 'yes') {
    parts.push('wheelchair accessible')
  } else if (toilet.accessibility === 'no') {
    parts.push('not wheelchair accessible')
  }
  
  if (toilet.reviewCount) {
    parts.push(`${toilet.reviewCount} review${toilet.reviewCount === 1 ? '' : 's'}`)
  }
  
  return parts.join(', ')
}

// ⌨️ Keyboard event handlers
export const handleEnterOrSpace = (callback: () => void) => {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback()
    }
  }
}

// 🎯 Focus visible management
export const addFocusVisibleSupport = () => {
  // Add focus-visible polyfill behavior
  let hadKeyboardEvent = true
  let keyboardThrottleId = 0
  
  const pointerInitiatedEvents = ['mousedown', 'pointerdown']
  const keyboardInitiatedEvents = ['keydown']
  
  const onPointerDown = () => {
    hadKeyboardEvent = false
  }
  
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.altKey || e.ctrlKey) {
      return
    }
    hadKeyboardEvent = true
  }
  
  const onFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (target && (hadKeyboardEvent || target.matches(':focus-visible'))) {
      target.classList.add('focus-visible')
    }
  }
  
  const onBlur = (e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (target) {
      target.classList.remove('focus-visible')
    }
  }
  
  // Listen for events
  pointerInitiatedEvents.forEach(eventName => {
    document.addEventListener(eventName, onPointerDown, true)
  })
  
  keyboardInitiatedEvents.forEach(eventName => {
    document.addEventListener(eventName, onKeyDown, true)
  })
  
  document.addEventListener('focus', onFocus, true)
  document.addEventListener('blur', onBlur, true)
}

// 🎨 Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    // Simple luminance calculation - in a real app you'd use a proper color library
    const rgb = color.match(/\d+/g)
    if (!rgb) return 0
    
    const [r, g, b] = rgb.map(Number).map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  
  return (lighter + 0.05) / (darker + 0.05)
}

// ♿ Accessibility checker
export const checkAccessibility = (element: HTMLElement): string[] => {
  const issues: string[] = []
  
  // Check for missing alt text on images
  const images = element.querySelectorAll('img')
  images.forEach((img, index) => {
    if (!img.alt && !img.getAttribute('aria-label')) {
      issues.push(`Image at index ${index} is missing alt text`)
    }
  })
  
  // Check for buttons without accessible names
  const buttons = element.querySelectorAll('button')
  buttons.forEach((button, index) => {
    const hasText = button.textContent?.trim()
    const hasAriaLabel = button.getAttribute('aria-label')
    const hasAriaLabelledby = button.getAttribute('aria-labelledby')
    
    if (!hasText && !hasAriaLabel && !hasAriaLabelledby) {
      issues.push(`Button at index ${index} has no accessible name`)
    }
  })
  
  // Check for form inputs without labels
  const inputs = element.querySelectorAll('input, select, textarea')
  inputs.forEach((input, index) => {
    const id = input.id
    const hasLabel = id && element.querySelector(`label[for="${id}"]`)
    const hasAriaLabel = input.getAttribute('aria-label')
    const hasAriaLabelledby = input.getAttribute('aria-labelledby')
    
    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
      issues.push(`Form control at index ${index} has no associated label`)
    }
  })
  
  return issues
}

// 🎵 Audio feedback for actions
export const playAccessibilitySound = (type: 'success' | 'error' | 'info') => {
  // Only play sounds if user hasn't disabled them
  if (prefersReducedMotion()) return
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  
  const frequencies = {
    success: 800,
    error: 300,
    info: 600,
  }
  
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.frequency.value = frequencies[type]
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

// 🔍 Screen reader detection
export const isScreenReaderActive = (): boolean => {
  // This is a heuristic - not 100% accurate
  return !!(
    navigator.userAgent.match(/NVDA|JAWS|DRAGON|VOICE|TALKBACK/i) ||
    window.speechSynthesis ||
    (window as any).speechSynthesis
  )
}

// Initialize accessibility features
export const initAccessibility = () => {
  addFocusVisibleSupport()
  
  // Add global accessibility styles
  const style = document.createElement('style')
  style.textContent = `
    .focus-visible {
      outline: 2px solid #4285f4;
      outline-offset: 2px;
    }
    
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    
    @media (prefers-contrast: high) {
      .toilet-marker {
        border: 2px solid currentColor;
      }
    }
  `
  document.head.appendChild(style)
  
  console.log('♿ Accessibility features initialized')
}