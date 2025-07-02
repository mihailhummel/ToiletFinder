# ToiletMap Bulgaria - IBS Support Web App

## Overview

ToiletMap Bulgaria is a mobile-responsive web application designed to help people suffering from IBS (Irritable Bowel Syndrome) in Bulgaria find nearby public restrooms. The app features an interactive map interface with crowd-sourced toilet locations, user reviews, and ratings to create a supportive community resource.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state, React hooks for local state
- **Map Integration**: Mapbox GL JS for interactive mapping
- **PWA Support**: Service worker, manifest.json, and installable features

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: Firebase Firestore for real-time data storage
- **Authentication**: Firebase Auth with Google OAuth integration
- **ORM**: Drizzle ORM configured for PostgreSQL (currently using Firebase)
- **Development**: Hot Module Replacement (HMR) with Vite middleware

### Data Storage Solutions
- **Primary Database**: Firebase Firestore for real-time capabilities
- **Schema Design**: Zod schemas for type validation and runtime checks
- **Collections**: toilets, reviews, reports with relational data structure
- **Caching**: TanStack Query for client-side caching with stale-while-revalidate strategy

### Authentication and Authorization
- **Provider**: Firebase Authentication
- **Method**: Google OAuth sign-in only
- **Session Management**: Firebase handles token management
- **Authorization**: User-based permissions for creating toilets, reviews, and reports

## Key Components

### Map System
- Interactive Mapbox map centered on Bulgaria (Sofia: 42.6977, 23.3219)
- Custom toilet markers with different colors for different venue types
- Real-time geolocation support for user positioning
- Click-to-add functionality for new toilet locations

### Toilet Management
- Add new toilet locations with type categorization (public, restaurant, cafe, gas station, mall, other)
- Location auto-fill from map center or user position
- Optional notes/descriptions for each location

### Review System
- 1-5 star rating system
- Text reviews with user attribution
- One review per user per toilet location
- Average rating calculation and display

### Reporting System
- Issue reporting for incorrect or problematic toilet entries
- Categories: doesn't exist, inaccessible, closed, other
- Optional comments for detailed feedback

### User Interface
- Mobile-first responsive design
- Bottom sheet modals for mobile interactions
- Floating action buttons for primary actions
- Filter panel for toilet types and minimum ratings
- PWA banner for app installation prompts

## Data Flow

1. **User Authentication**: Google OAuth through Firebase Auth
2. **Map Loading**: Mapbox initialization with Bulgaria center point
3. **Toilet Data**: Real-time fetch from Firestore with location-based queries
4. **User Interactions**: Add toilets, reviews, reports through Firebase functions
5. **Real-time Updates**: Firestore listeners for live data synchronization
6. **Offline Support**: Service worker caching for basic functionality

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, hosting
- **Mapbox**: Map tiles, geocoding, and interactive mapping
- **Google OAuth**: User authentication provider

### Development Dependencies
- **Vite**: Build tool and development server
- **TypeScript**: Type safety and development experience
- **ESBuild**: Fast bundling for production builds
- **TanStack Query**: Server state management and caching

### UI Dependencies
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library
- **Date-fns**: Date formatting and manipulation

## Deployment Strategy

### Development Environment
- Vite dev server with HMR for rapid development
- Express middleware for API routes during development
- Firebase emulators for local testing (when needed)

### Production Build
- Vite builds static assets to `dist/public`
- ESBuild bundles server code to `dist/index.js`
- Single production server serves both static files and API routes

### Environment Configuration
- Firebase project configuration through environment variables
- Mapbox API token configuration
- Drizzle database URL configuration (for future PostgreSQL migration)

### PWA Deployment
- Service worker for offline functionality
- Web app manifest for installable experience
- App icons and screenshots for app stores

## Changelog

```
Changelog:
- July 01, 2025. Initial setup
- July 02, 2025. Added review display functionality - reviews now load and display in popup bubbles
- July 02, 2025. Enhanced user location detection with automatic zoom to 100-meter radius (zoom level 18)
- July 02, 2025. Fixed user location marker visibility and modal z-index issues
- July 02, 2025. Resolved location marker persistence problem with proper verification and re-adding logic
- July 02, 2025. Perfected user location marker with blue dot (CircleMarker) and pulsing ring (DivIcon) with 1.5s animation
- July 02, 2025. MAJOR: Imported complete OpenStreetMap toilet dataset for Bulgaria - expanded from ~80 to 961 facilities
- July 02, 2025. Created efficient bulk import system using Overpass API and parallel processing
- July 02, 2025. Added comprehensive toilet information including opening hours, fees, accessibility, and operators
- July 02, 2025. Researched additional data sources: Zyla API Hub (50K+ daily updates), MAPOG GIS, Bulgarian government portals
- July 02, 2025. Identified potential for commercial API integration to supplement OSM data with user ratings and amenities
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```