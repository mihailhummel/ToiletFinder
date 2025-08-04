// 🏪 Temporary Store Implementation (until Zustand is installed)

import { useState } from 'react'
import type { Toilet, MapLocation, User } from '@/types/toilet'

// Simple temporary hooks until Zustand is properly installed

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const setUser = (user: User | null) => {
    setCurrentUser(user)
    setIsAuthenticated(!!user)
    setIsAdmin(user?.isAdmin || false)
  }
  
  return { currentUser, isAuthenticated, isAdmin, setUser }
}

export const useMap = () => {
  const [mapCenter, setMapCenter] = useState<MapLocation>({ lat: 42.6977, lng: 23.3219 })
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null)
  const [mapBounds, setMapBounds] = useState<any>(null)
  const [isMapLoading, setMapLoading] = useState(false)
  
  return {
    mapCenter,
    userLocation,
    mapBounds,
    isMapLoading,
    setMapCenter,
    setUserLocation,
    setMapBounds,
    setMapLoading
  }
}

export const useToiletSelection = () => {
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null)
  const [toilets, setToilets] = useState<Toilet[]>([])
  
  return { selectedToilet, setSelectedToilet, toilets }
}

export const useUI = () => {
  const [isAddingToilet, setAddingMode] = useState(false)
  const [showAddToiletModal, setShowAddToiletModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  
  const closeAllModals = () => {
    setShowAddToiletModal(false)
    setShowLoginModal(false)
    setShowFilterPanel(false)
    setShowUserMenu(false)
  }
  
  return {
    isAddingToilet,
    showAddToiletModal,
    showLoginModal,
    showFilterPanel,
    showUserMenu,
    setAddingMode,
    setShowAddToiletModal,
    setShowLoginModal,
    setShowFilterPanel,
    setShowUserMenu,
    closeAllModals
  }
}