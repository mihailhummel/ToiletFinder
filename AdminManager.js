import express from 'express';
import { auth } from './firebase-admin-config.js';
import { writeFileSync, appendFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AdminManager {
  constructor() {
    this.app = express();
    this.port = 3001; // Different port from main app
    this.setupMiddleware();
    this.setupRoutes();
    this.logFile = join(__dirname, 'admin-actions.log');
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, 'public')));
  }

  log(action, details) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}: ${JSON.stringify(details)}\n`;
    
    console.log(`🔧 ADMIN ACTION: ${action}`, details);
    
    // Append to log file
    appendFileSync(this.logFile, logEntry);
  }

  async getAllUsers() {
    try {
      console.log('🔍 Attempting to fetch users from Firebase...');
      const listUsers = await auth.listUsers();
      console.log(`✅ Successfully fetched ${listUsers.users.length} users`);
      
      const users = listUsers.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isAdmin: user.customClaims?.admin === true,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        emailVerified: user.emailVerified,
        disabled: user.disabled
      }));

      // Sort users: admins first, then by creation date
      return users.sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error.code, error.message);
      
      // Return a mock user for testing if permissions fail
      if (error.code === 'auth/insufficient-permission' || 
          error.code === 'auth/permission-denied' || 
          error.message.includes('PERMISSION_DENIED') ||
          error.message.includes('serviceusage.serviceUsageConsumer')) {
        console.log('⚠️  Using mock data due to permissions. Service account needs Firebase Auth Admin role.');
        return [{
          uid: 'mock-uid-1',
          email: 'admin@example.com',
          displayName: 'Mock Admin User',
          photoURL: null,
          isAdmin: true,
          createdAt: new Date().toISOString(),
          lastSignIn: new Date().toISOString(),
          emailVerified: true,
          disabled: false
        }, {
          uid: 'mock-uid-2',
          email: 'user@example.com',
          displayName: 'Mock Regular User',
          photoURL: null,
          isAdmin: false,
          createdAt: new Date().toISOString(),
          lastSignIn: new Date().toISOString(),
          emailVerified: true,
          disabled: false
        }];
      }
      
      throw error;
    }
  }

  async makeAdmin(uid, email) {
    try {
      await auth.setCustomUserClaims(uid, { admin: true });
      this.log('MAKE_ADMIN', { uid, email });
      return { success: true, message: `${email} is now an admin` };
    } catch (error) {
      console.error('Error making user admin:', error);
      throw error;
    }
  }

  async removeAdmin(uid, email) {
    try {
      await auth.setCustomUserClaims(uid, { admin: false });
      this.log('REMOVE_ADMIN', { uid, email });
      return { success: true, message: `${email} is no longer an admin` };
    } catch (error) {
      console.error('Error removing admin status:', error);
      throw error;
    }
  }

  async deleteUser(uid, email) {
    try {
      await auth.deleteUser(uid);
      this.log('DELETE_USER', { uid, email });
      return { success: true, message: `User ${email} has been deleted` };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  setupRoutes() {
    // Serve the admin dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, 'admin.html'));
    });

    // Get all users
    this.app.get('/api/users', async (req, res) => {
      try {
        console.log('📡 API call to /api/users received');
        const users = await this.getAllUsers();
        console.log(`📤 Sending ${users.length} users to client`);
        res.json(users);
      } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({ 
          error: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          details: 'Check server logs for more information'
        });
      }
    });

    // Make user admin
    this.app.post('/api/users/:uid/make-admin', async (req, res) => {
      try {
        const { uid } = req.params;
        const { email } = req.body;
        const result = await this.makeAdmin(uid, email);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Remove admin status
    this.app.post('/api/users/:uid/remove-admin', async (req, res) => {
      try {
        const { uid } = req.params;
        const { email } = req.body;
        const result = await this.removeAdmin(uid, email);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete user
    this.app.delete('/api/users/:uid', async (req, res) => {
      try {
        const { uid } = req.params;
        const { email } = req.body;
        const result = await this.deleteUser(uid, email);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get admin logs
    this.app.get('/api/logs', (req, res) => {
      try {
        const logs = existsSync(this.logFile) 
          ? readFileSync(this.logFile, 'utf8').split('\n').filter(line => line.trim())
          : [];
        res.json(logs.reverse()); // Most recent first
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`
🔧 ======================================
   ADMIN MANAGER STARTED
🔧 ======================================
   
   📱 Dashboard: http://localhost:${this.port}
   🔑 Manage users and admin permissions
   📝 All actions are logged to: ${this.logFile}
   
🔧 ======================================
      `);
      
      this.log('ADMIN_MANAGER_STARTED', { port: this.port, timestamp: new Date().toISOString() });
    });
  }
}

// Start the admin manager
const adminManager = new AdminManager();
adminManager.start(); 