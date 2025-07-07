# 🚀 Firebase to Supabase Migration Guide

This guide will help you migrate your toilet finder app from Firebase Firestore to Supabase PostgreSQL with PostGIS geospatial support.

## 🎯 Benefits of Migration

- **No read limits** (vs Firebase's 50k/day limit)
- **Advanced spatial queries** with PostGIS
- **Better performance** with spatial indexing
- **Cost savings** - stay on free tier longer
- **Real-time subscriptions** like Firebase
- **SQL queries** for complex analytics

## 📋 Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Firebase Service Account**: Download from Firebase Console
3. **Node.js 18+** for running migration scripts

## 🛠️ Step 1: Setup Supabase Project

### Create New Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization and fill project details
4. Wait for database to initialize (~2 minutes)

### Get Credentials
1. Go to **Settings > API**
2. Copy your:
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon Public Key**: `eyJhbGc...`
   - **Service Role Key**: `eyJhbGc...` (keep secure!)

### Configure Environment
1. Copy `supabase.env.template` to `.env`
2. Fill in your Supabase credentials:
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

## 🗄️ Step 2: Setup Database Schema

### Run SQL Schema
1. Go to **Supabase Dashboard > SQL Editor**
2. Copy contents of `supabase_schema.sql`
3. Click "Run" to create tables and functions
4. Verify PostGIS extension is enabled

### Expected Results
✅ `toilets` table created with spatial indexing  
✅ PostGIS functions working  
✅ Row Level Security enabled  
✅ Spatial indexes created  

## 📦 Step 3: Prepare Firebase Export

### Download Service Account
1. Go to **Firebase Console > Project Settings**
2. Click **Service Accounts** tab
3. Click **Generate New Private Key**
4. Save as `firebase-service-account.json` in project root

### Install Migration Dependencies
```bash
npm install firebase-admin
```

## 🔄 Step 4: Run Migration

### Execute Migration Script
```bash
node migrate_firebase_to_supabase.mjs
```

### Monitor Progress
The script will:
- Export all toilets from Firebase
- Transform data format
- Import in batches to Supabase  
- Verify data integrity
- Test spatial queries

### Expected Output
```
🔥 Exporting toilets from Firebase...
✅ Exported 8591 toilets from Firebase

📊 Importing 8591 toilets to Supabase...
📦 Processing batch 1/86 (100 items)
✅ Imported 100 toilets in this batch
...

📊 Migration Summary:
✅ Successfully imported: 8591 toilets
❌ Errors: 0 toilets
📈 Success rate: 100.0%

🔍 Verifying migration...
🔥 Firebase toilets: 8591
🟢 Supabase toilets: 8591
✅ Migration verification successful!

🗺️ Testing spatial queries...
✅ Sofia area query: Found 245 toilets
✅ 5km radius query: Found 89 toilets near Sofia center
   Closest toilet: 127m away

🎉 Migration completed successfully!
```

## 🔧 Step 5: Update Application Code

### Switch to Supabase Hook
Replace in your components:
```typescript
// Old Firebase hook
import { useToiletsInViewport } from './hooks/useToilets';

// New Supabase hook  
import { useSupabaseToilets } from './hooks/useSupabaseToilets';

// Update usage
const { toilets, isLoading, error } = useSupabaseToilets({
  bounds: mapBounds,
  enabled: !!mapBounds
});
```

### Update Server Routes (if applicable)
Replace Firebase admin calls with Supabase client calls in your API routes.

## 🧪 Step 6: Testing

### Test Basic Functionality
1. **Map Loading**: Verify toilets display correctly
2. **Viewport Filtering**: Check toilets update when moving map
3. **User Location**: Ensure location detection works
4. **Popups**: Verify toilet details display properly

### Test Performance
1. **Load Times**: Should be <1 second for cached regions
2. **Memory Usage**: Monitor browser memory
3. **Network Requests**: Should be minimal with caching

### Debug Tools
Use browser console:
```javascript
// Check cache status
window.debugSupabaseToiletCache()

// Clear cache if needed
window.clearSupabaseToiletCache()
```

## 📊 Performance Comparison

| Metric | Firebase | Supabase |
|--------|----------|----------|
| **Daily Read Limit** | 50,000 | Unlimited |
| **Spatial Queries** | Manual filtering | PostGIS native |
| **Query Performance** | ~2-3 seconds | ~200-500ms |
| **Cache Duration** | 30 minutes | 3 days |
| **Cost (Free Tier)** | Often exceeded | Under limits |

## 🔄 Step 7: Gradual Migration (Optional)

### Feature Flag Approach
```typescript
const useSupabase = import.meta.env.VITE_DATABASE_PROVIDER === 'supabase';

const { toilets, isLoading, error } = useSupabase 
  ? useSupabaseToilets({ bounds })
  : useToiletsInViewport(bounds);
```

### Monitor Both Systems
- Keep Firebase read-only as backup
- Compare results between systems
- Monitor error rates and performance

## 🛡️ Step 8: Security & Cleanup

### Update Firebase Rules (Optional)
Make Firebase read-only:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false; // Disable writes
    }
  }
}
```

### Supabase Security
Row Level Security is already configured in the schema for:
- Public read access to toilets
- Authenticated write access
- Admin-only updates

## 🚨 Troubleshooting

### Common Issues

**Migration fails with "Invalid coordinates"**
- Check Firebase data format
- Ensure lat/lng are valid numbers
- Review transformation function

**Spatial queries not working**
- Verify PostGIS extension is enabled
- Check if location column is populated
- Review spatial index creation

**Performance issues**
- Clear browser cache
- Check network tab for failed requests
- Verify Supabase project region

**Authentication errors**
- Double-check environment variables
- Verify service key permissions
- Check RLS policies

### Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Reference](https://postgis.net/docs/)
- [Migration Script Issues](./migrate_firebase_to_supabase.mjs)

## 🎉 Success Checklist

✅ Supabase project created and configured  
✅ Database schema deployed successfully  
✅ Migration script completed without errors  
✅ Data verification passed  
✅ Application updated to use Supabase  
✅ Performance improvements confirmed  
✅ No more Firebase quota issues  

## 📈 Next Steps

1. **Monitor Usage**: Check Supabase dashboard for query patterns
2. **Optimize Queries**: Use spatial indexes for better performance  
3. **Add Features**: Leverage PostgreSQL for advanced analytics
4. **Scale**: Add read replicas if needed
5. **Backup**: Setup regular database backups

---

**🚀 Congratulations!** You've successfully migrated to Supabase and eliminated Firebase quota limitations while gaining powerful spatial query capabilities. 