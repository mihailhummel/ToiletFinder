# 🚀 Deployment Guide for IBS Health Tracker

This guide will help you deploy your toilet finder app to the internet.

## 📋 Prerequisites

1. **GitHub Account** - For code hosting
2. **Supabase Project** - Already set up ✅
3. **Environment Variables** - Ready to configure

## 🎯 Recommended: Vercel Deployment (Easiest)

### Step 1: Prepare Your Code

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Ensure all files are committed**:
   - `vercel.json` ✅
   - `client/vite.config.ts` ✅
   - `package.json` scripts ✅

### Step 2: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/Login with GitHub**
3. **Click "New Project"**
4. **Import your GitHub repository**
5. **Configure settings**:
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: `npm run install:all && npm run build`
   - Output Directory: `client/dist`
   - Install Command: `npm install`

### Step 3: Set Environment Variables

In Vercel dashboard, go to **Settings → Environment Variables**:

```
SUPABASE_URL=https://fvohytokcumrauwplnwo.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTA3MzgsImV4cCI6MjA2NzQ2NjczOH0.nJZx7uUcM0U1Uj8eL8P1eR97OQLhfS3jUinT6K74utk
```

### Step 4: Deploy

1. **Click "Deploy"**
2. **Wait for build to complete** (~2-3 minutes)
3. **Your app will be live at**: `https://your-project-name.vercel.app`

## 🌐 Alternative: Render Deployment

### Step 1: Prepare for Render

1. **Ensure `render.yaml` exists** ✅
2. **Push to GitHub**

### Step 2: Deploy to Render

1. **Go to [render.com](https://render.com)**
2. **Sign up/Login with GitHub**
3. **Click "New +" → "Web Service"**
4. **Connect your repository**
5. **Configure**:
   - Name: `toilet-finder-app`
   - Environment: `Node`
   - Build Command: `npm run install:all && npm run build`
   - Start Command: `npm start`

### Step 3: Set Environment Variables

In Render dashboard, go to **Environment**:

```
SUPABASE_URL=https://fvohytokcumrauwplnwo.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTA3MzgsImV4cCI6MjA2NzQ2NjczOH0.nJZx7uUcM0U1Uj8eL8P1eR97OQLhfS3jUinT6K74utk
```

## 🔧 Post-Deployment Checklist

### ✅ Database Setup
1. **Run the corrected SQL** in Supabase dashboard
2. **Wait for Firebase quota reset**
3. **Run migration**: `node setup_and_migrate_all.mjs`

### ✅ App Testing
1. **Test map loading**
2. **Test toilet search**
3. **Test adding new toilets**
4. **Test reviews and reports**

### ✅ Performance Optimization
1. **Enable Supabase caching**
2. **Monitor API usage**
3. **Set up error tracking**

## 🌍 Custom Domain (Optional)

### Vercel
1. **Go to Settings → Domains**
2. **Add your domain**
3. **Update DNS records**

### Render
1. **Go to Settings → Custom Domains**
2. **Add your domain**
3. **Update DNS records**

## 📊 Monitoring & Analytics

### Vercel Analytics
- Built-in performance monitoring
- Real user metrics
- Error tracking

### Supabase Monitoring
- Database performance
- API usage
- Real-time logs

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check Node.js version (>=18)
   - Verify all dependencies installed
   - Check environment variables

2. **Map Not Loading**:
   - Verify Supabase connection
   - Check CORS settings
   - Ensure database is populated

3. **API Errors**:
   - Check environment variables
   - Verify Supabase permissions
   - Check RLS policies

### Support:
- **Vercel**: Excellent documentation and support
- **Render**: Good community support
- **Supabase**: Great Discord community

## 🎉 Success!

Once deployed, your app will be:
- ✅ **Publicly accessible** worldwide
- ✅ **Mobile-responsive**
- ✅ **Fast and reliable**
- ✅ **Scalable** for growth

**Your IBS Health Tracker will help thousands of people!** 🚽📍 