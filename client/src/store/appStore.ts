import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Toilet, MapLocation, ToiletType, Accessibility, AccessType, User } from '@/types/toilet'

// 🏪 Centralized App State with Zustand

interface FilterOptions {
  types: ToiletType[]
  minRating: number
}

interface AppState {
  // 👤 User state
  currentUser: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  
  // 🚽 Toilet state
  selectedToilet: Toilet | null
  toilets: Toilet[]
  
  // 🗺️ Map state
  mapCenter: MapLocation
  userLocation: MapLocation | null
  mapBounds: any
  isMapLoading: boolean
  
  // 🎛️ UI state
  isAddingToilet: boolean
  showAddToiletModal: boolean
  showLoginModal: boolean
  showFilterPanel: boolean
  showUserMenu: boolean
  
  // 🔍 Filter state
  filters: FilterOptions
  
  // 📱 App state
  isOffline: boolean
  lastSync: number | null
  
  // 🎯 Actions - User
  setUser: (user: User | null) => void
  setAuthenticated: (isAuth: boolean) => void
  setAdmin: (isAdmin: boolean) => void
  
  // 🎯 Actions - Toilets
  setSelectedToilet: (toilet: Toilet | null) => void
  setToilets: (toilets: Toilet[]) => void
  addToilet: (toilet: Toilet) => void
  updateToilet: (toiletId: string, updates: Partial<Toilet>) => void
  removeToilet: (toiletId: string) => void
  
  // 🎯 Actions - Map
  setMapCenter: (center: MapLocation) => void
  setUserLocation: (location: MapLocation | null) => void
  setMapBounds: (bounds: any) => void
  setMapLoading: (loading: boolean) => void
  
  // 🎯 Actions - UI
  setAddingMode: (isAdding: boolean) => void
  toggleAddingMode: () => void
  setShowAddToiletModal: (show: boolean) => void
  setShowLoginModal: (show: boolean) => void
  setShowFilterPanel: (show: boolean) => void
  setShowUserMenu: (show: boolean) => void
  closeAllModals: () => void
  
  // 🎯 Actions - Filters
  setFilters: (filters: FilterOptions) => void
  updateFilter: (key: keyof FilterOptions, value: any) => void
  resetFilters: () => void
  
  // 🎯 Actions - App
  setOffline: (offline: boolean) => void
  updateLastSync: () => void
  resetApp: () => void
}

// 🌍 Default values
const defaultFilters: FilterOptions = {
  types: ["public", "restaurant", "cafe", "gas-station", "mall", "other"],
  minRating: 1
}

const defaultMapCenter: MapLocation = {
  lat: 42.6977, // Sofia, Bulgaria
  lng: 23.3219
}

// 🏗️ Create the store
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // 📊 Initial state
        currentUser: null,
        isAuthenticated: false,
        isAdmin: false,
        
        selectedToilet: null,
        toilets: [],
        
        mapCenter: defaultMapCenter,
        userLocation: null,
        mapBounds: null,
        isMapLoading: false,
        
        isAddingToilet: false,
        showAddToiletModal: false,
        showLoginModal: false,
        showFilterPanel: false,
        showUserMenu: false,
        
        filters: defaultFilters,
        
        isOffline: false,
        lastSync: null,
        
        // 🎯 User actions
        setUser: (user) => {
          set({ 
            currentUser: user, 
            isAuthenticated: !!user,
            isAdmin: user?.isAdmin || false 
          })
        },
        
        setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
        setAdmin: (isAdmin) => set({ isAdmin }),
        
        // 🎯 Toilet actions
        setSelectedToilet: (toilet) => set({ selectedToilet: toilet }),
        
        setToilets: (toilets) => set({ toilets }),
        
        addToilet: (toilet) => {
          const { toilets } = get()
          set({ toilets: [...toilets, toilet] })
        },
        
        updateToilet: (toiletId, updates) => {
          const { toilets } = get()
          set({
            toilets: toilets.map(toilet => 
              toilet.id === toiletId ? { ...toilet, ...updates } : toilet
            )
          })
        },
        
        removeToilet: (toiletId) => {
          const { toilets, selectedToilet } = get()
          set({
            toilets: toilets.filter(toilet => toilet.id !== toiletId),
            selectedToilet: selectedToilet?.id === toiletId ? null : selectedToilet
          })
        },
        
        // 🎯 Map actions
        setMapCenter: (center) => set({ mapCenter: center }),
        setUserLocation: (location) => set({ userLocation: location }),
        setMapBounds: (bounds) => set({ mapBounds: bounds }),
        setMapLoading: (loading) => set({ isMapLoading: loading }),
        
        // 🎯 UI actions
        setAddingMode: (isAdding) => set({ isAddingToilet: isAdding }),
        
        toggleAddingMode: () => {
          const { isAddingToilet } = get()
          set({ isAddingToilet: !isAddingToilet })
        },
        
        setShowAddToiletModal: (show) => set({ showAddToiletModal: show }),
        setShowLoginModal: (show) => set({ showLoginModal: show }),
        setShowFilterPanel: (show) => set({ showFilterPanel: show }),
        setShowUserMenu: (show) => set({ showUserMenu: show }),
        
        closeAllModals: () => set({
          showAddToiletModal: false,
          showLoginModal: false,
          showFilterPanel: false,
          showUserMenu: false
        }),
        
        // 🎯 Filter actions
        setFilters: (filters) => set({ filters }),
        
        updateFilter: (key, value) => {
          const { filters } = get()
          set({ filters: { ...filters, [key]: value } })
        },
        
        resetFilters: () => set({ filters: defaultFilters }),
        
        // 🎯 App actions
        setOffline: (offline) => set({ isOffline: offline }),
        updateLastSync: () => set({ lastSync: Date.now() }),
        
        resetApp: () => set({
          selectedToilet: null,
          toilets: [],
          mapCenter: defaultMapCenter,
          userLocation: null,
          mapBounds: null,
          isMapLoading: false,
          isAddingToilet: false,
          showAddToiletModal: false,
          showLoginModal: false,
          showFilterPanel: false,
          showUserMenu: false,
          filters: defaultFilters,
          isOffline: false,
          lastSync: null,
        }),
      }),
      {
        name: 'toilet-finder-store',
        // Only persist certain values
        partialize: (state) => ({
          mapCenter: state.mapCenter,
          filters: state.filters,
          lastSync: state.lastSync,
        }),
      }
    ),
    {
      name: 'toilet-finder-store',
    }
  )
)

// 🔧 Utility hooks for common state patterns
export const useAuth = () => {
  const currentUser = useAppStore(state => state.currentUser)
  const isAuthenticated = useAppStore(state => state.isAuthenticated)
  const isAdmin = useAppStore(state => state.isAdmin)
  const setUser = useAppStore(state => state.setUser)
  
  return { currentUser, isAuthenticated, isAdmin, setUser }
}

export const useMap = () => {
  const mapCenter = useAppStore(state => state.mapCenter)
  const userLocation = useAppStore(state => state.userLocation)
  const mapBounds = useAppStore(state => state.mapBounds)
  const isMapLoading = useAppStore(state => state.isMapLoading)
  const setMapCenter = useAppStore(state => state.setMapCenter)
  const setUserLocation = useAppStore(state => state.setUserLocation)
  const setMapBounds = useAppStore(state => state.setMapBounds)
  const setMapLoading = useAppStore(state => state.setMapLoading)
  
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
  const selectedToilet = useAppStore(state => state.selectedToilet)
  const setSelectedToilet = useAppStore(state => state.setSelectedToilet)
  const toilets = useAppStore(state => state.toilets)
  
  return { selectedToilet, setSelectedToilet, toilets }
}

export const useUI = () => {
  const isAddingToilet = useAppStore(state => state.isAddingToilet)
  const showAddToiletModal = useAppStore(state => state.showAddToiletModal)
  const showLoginModal = useAppStore(state => state.showLoginModal)
  const showFilterPanel = useAppStore(state => state.showFilterPanel)
  const showUserMenu = useAppStore(state => state.showUserMenu)
  
  const setAddingMode = useAppStore(state => state.setAddingMode)
  const setShowAddToiletModal = useAppStore(state => state.setShowAddToiletModal)
  const setShowLoginModal = useAppStore(state => state.setShowLoginModal)
  const setShowFilterPanel = useAppStore(state => state.setShowFilterPanel)
  const setShowUserMenu = useAppStore(state => state.setShowUserMenu)
  const closeAllModals = useAppStore(state => state.closeAllModals)
  
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