# 🚂 Railway Environment Variables

## Required Environment Variables for Deployment

Copy these into Railway's environment variables section:

### 🔹 Supabase Configuration
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 🔹 Firebase Configuration
```
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### 🔹 Server Configuration
```
NODE_ENV=production
PORT=5001
```

### 🔹 Optional Performance Settings
```
VITE_DEBUG_QUERIES=false
VITE_ENABLE_REALTIME=true
VITE_MAP_TILE_CACHE_SIZE=100
VITE_MAX_MARKERS_PER_VIEW=1000
```

## 📝 How to Get These Values:

### Supabase:
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon public key
4. Go to Settings → Database to get the connection string

### Firebase:
1. Go to Firebase Console
2. Project Settings → General tab
3. Scroll down to "Your apps" section
4. Copy the config values

## 🚨 Important Notes:
- Never commit these values to git
- The Firebase service account key file should NOT be uploaded to Railway
- Railway will use these environment variables during deployment