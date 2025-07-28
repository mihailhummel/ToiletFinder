# 🚀 Quick Database Setup Guide

## The Issue
Your app is getting 500 errors because the database tables for reviews and reports don't exist yet. Here's how to fix it in 2 minutes:

## Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Sign in with your account
3. Select project: `fvohytokcumrauwplnwo`

## Step 2: Run the SQL Script
1. Click on **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy and paste the entire contents of `setup_reviews_tables.sql` into the editor
4. Click **"Run"** button

## Step 3: Verify Setup
After running the SQL, you should see:
- ✅ 3 new tables created: `reviews`, `reports`, `toilet_reports`
- ✅ Toilets table updated with rating columns
- ✅ Database functions created
- ✅ Security policies enabled

## Step 4: Test Your App
Once the database is set up:
- ✅ **Add Toilet**: Should work perfectly
- ✅ **Leave Reviews**: Should work perfectly  
- ✅ **Report Toilets**: Should work perfectly

## What the SQL Script Does
The `setup_reviews_tables.sql` file creates:
- **Reviews table**: Stores user ratings and comments
- **Reports table**: Stores general reports
- **Toilet_reports table**: Stores "toilet doesn't exist" reports
- **Rating columns**: Added to existing toilets table
- **Database functions**: For automatic rating updates
- **Security policies**: For data protection

## Need Help?
If you get any errors during the SQL execution, just let me know and I'll help you troubleshoot! 