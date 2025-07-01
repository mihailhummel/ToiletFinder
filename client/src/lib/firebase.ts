import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, getDoc, increment, writeBatch } from "firebase/firestore";
import type { Toilet, Review, Report, InsertToilet, InsertReview, InsertReport } from "@shared/schema";

// Debug: Log environment variables to check if they're loading
console.log('Firebase Config Debug:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'Present' : 'Missing',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Present' : 'Missing',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ? 'Present' : 'Missing'
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || ""}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || ""}.firebasestorage.app`,
  messagingSenderId: "823137125904",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// Auth functions
export const signInWithGoogle = () => {
  return signInWithRedirect(auth, provider);
};

export const signOutUser = () => {
  return signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Toilet functions
export const addToilet = async (toilet: InsertToilet): Promise<string> => {
  const toiletData = {
    ...toilet,
    createdAt: new Date(),
    averageRating: 0,
    reviewCount: 0
  };
  
  const docRef = await addDoc(collection(db, "toilets"), toiletData);
  return docRef.id;
};

export const getToilets = async (): Promise<Toilet[]> => {
  const q = query(collection(db, "toilets"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate()
  })) as Toilet[];
};

export const getToiletsNearby = async (lat: number, lng: number, radiusKm: number = 10): Promise<Toilet[]> => {
  // For simplicity, we'll get all toilets and filter client-side
  // In production, you'd want to use Firestore's geohash queries
  const toilets = await getToilets();
  
  return toilets.filter(toilet => {
    const distance = calculateDistance(
      lat, lng,
      toilet.coordinates.lat, toilet.coordinates.lng
    );
    return distance <= radiusKm;
  });
};

// Review functions
export const addReview = async (review: InsertReview): Promise<void> => {
  const batch = writeBatch(db);
  
  // Add the review
  const reviewData = {
    ...review,
    createdAt: new Date()
  };
  const reviewRef = doc(collection(db, "reviews"));
  batch.set(reviewRef, reviewData);
  
  // Update toilet stats
  const toiletRef = doc(db, "toilets", review.toiletId);
  const toiletDoc = await getDoc(toiletRef);
  
  if (toiletDoc.exists()) {
    const currentReviews = await getReviewsForToilet(review.toiletId);
    const newReviewCount = currentReviews.length + 1;
    const totalRating = currentReviews.reduce((sum, r) => sum + r.rating, 0) + review.rating;
    const newAverageRating = totalRating / newReviewCount;
    
    batch.update(toiletRef, {
      reviewCount: newReviewCount,
      averageRating: Math.round(newAverageRating * 10) / 10
    });
  }
  
  await batch.commit();
};

export const getReviewsForToilet = async (toiletId: string): Promise<Review[]> => {
  const q = query(
    collection(db, "reviews"),
    where("toiletId", "==", toiletId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate()
  })) as Review[];
};

export const hasUserReviewedToilet = async (toiletId: string, userId: string): Promise<boolean> => {
  const q = query(
    collection(db, "reviews"),
    where("toiletId", "==", toiletId),
    where("userId", "==", userId)
  );
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

// Report functions
export const addReport = async (report: InsertReport): Promise<void> => {
  const reportData = {
    ...report,
    createdAt: new Date()
  };
  
  await addDoc(collection(db, "reports"), reportData);
};

// Utility functions
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value: number): number => {
  return value * Math.PI / 180;
};
