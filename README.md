# 🚽 ToiletMap - Bulgaria

A mobile-responsive web application for finding public toilets in Bulgaria. Built with React, TypeScript, and Supabase.

## 🚀 Features

- **Interactive Map**: Find toilets near your location
- **Real-time Data**: Viewport-based toilet loading
- **User Reviews**: Rate and review toilets
- **Google Authentication**: Secure login system
- **Mobile Optimized**: Works great on all devices
- **PWA Ready**: Install as a mobile app

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Shadcn/ui
- **Map**: Leaflet.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Firebase Auth
- **State Management**: TanStack Query

## 📁 Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and configurations
│   │   ├── types/         # TypeScript type definitions
│   │   └── pages/         # Page components
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── server/                # Backend API server
│   ├── routes.ts          # API endpoints
│   ├── db.ts             # Database configuration
│   └── storage.ts        # File storage handling
├── shared/               # Shared types and utilities
├── docs/                 # Documentation
└── package.json          # Root dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd IBSHealthTracker_Master_WIP
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp supabase.env.template .env
   
   # Add your environment variables
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   ```

4. **Start Development Server**
   ```bash
   # Start backend
   npm run dev:server
   
   # Start frontend (in another terminal)
   cd client && npm run dev
   ```

## 📖 Documentation

See the [docs/](docs/) directory for detailed documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 