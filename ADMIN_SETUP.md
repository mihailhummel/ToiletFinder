# Admin Setup Guide

## Setting Up Admin Users

### Method 1: Firebase Console (Recommended)

1. Go to your Firebase Console
2. Navigate to Authentication > Users
3. Find the user you want to make admin
4. Click on the user to view details
5. In the "Custom claims" section, add:
   ```json
   {
     "admin": true
   }
   ```
6. Click "Save"

### Method 2: Firebase Functions (Advanced)

1. Create a Firebase Cloud Function:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.setAdminStatus = functions.https.onCall(async (data, context) => {
  // Only allow super admins to call this function
  if (!context.auth.token.superAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Super admin required');
  }

  const { email, isAdmin } = data;
  
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: isAdmin });
    
    return { success: true, message: `Admin status set to ${isAdmin} for ${email}` };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
```

### Method 3: Manual Database Update (Temporary)

If you need a quick solution, you can manually update the admin emails in the server code:

1. Open `server/routes.ts`
2. Find the `adminEmails` array
3. Add your email address:

```typescript
const adminEmails = [
  'your-email@gmail.com', // Add your email here
  'mihail@gmail.com'
];
```

## Database Setup

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the `setup_database.sql` script to create all necessary tables
4. Make sure Row Level Security (RLS) is properly configured

## Testing Admin Functionality

1. Sign in with a Google account that has admin privileges
2. Navigate to any toilet location on the map
3. Click on the toilet marker to open details
4. You should see a red "Delete" button next to the other action buttons
5. Click "Delete" to test the admin deletion functionality

## Security Notes

- Admin status is checked on both client and server side
- Only users with `admin: true` in their Firebase custom claims can delete toilets
- The server also validates admin emails as a backup security measure
- All admin actions are logged for audit purposes

## Troubleshooting

### Admin button not showing up
- Make sure you're signed in with a Google account
- Check that the user has admin custom claims in Firebase
- Verify the `useAuth` hook is properly checking admin status

### Delete operation failing
- Check the server logs for error messages
- Verify the admin email is in the `adminEmails` array
- Make sure the database tables exist and are properly configured

### Reviews not working
- Ensure the reviews table exists in Supabase
- Check that the user is authenticated before trying to leave a review
- Verify the API endpoints are working correctly 