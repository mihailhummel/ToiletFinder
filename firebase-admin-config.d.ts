declare module './firebase-admin-config.js' {
  import { Auth } from 'firebase-admin/auth';
  import { App } from 'firebase-admin/app';
  
  export const admin: App;
  export const auth: Auth;
}