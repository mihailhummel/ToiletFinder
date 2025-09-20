import { createClient } from '@supabase/supabase-js';
import { IStorage } from './storage';
import type { Toilet, Review, Report, ToiletReport, InsertToilet, InsertReview, InsertReport, InsertToiletReport } from '@shared/schema';

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

// Environment check for production
if (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_SERVICE_KEY) {
  console.error('🚨 CRITICAL: SUPABASE_SERVICE_KEY environment variable is required in production');
  console.error('Please set your Supabase service key in the .env file');
  process.exit(1);
}

// Use service key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export class SupabaseStorage implements IStorage {
  
  async createToilet(toilet: InsertToilet): Promise<string> {
    try {
      // Generate a unique ID for the toilet
      const toiletId = `toilet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const toiletData = {
        id: toiletId,
        coordinates: toilet.coordinates,
        type: toilet.type,
        title: toilet.title || null,
        source: toilet.source || 'user',
        notes: toilet.notes || null,
        accessibility: toilet.accessibility || 'unknown',
        access_type: toilet.accessType || 'unknown',
        user_id: toilet.userId,
        added_by_user_name: toilet.addedByUserName || null,
        is_removed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        review_count: 0
      };

      const { data, error } = await supabase
        .from('toilets')
        .insert([toiletData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating toilet:', error);
        
        // If the error is about missing columns, provide helpful message
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          throw new Error('Database setup required. Please run the SQL script in Supabase dashboard first.');
        }
        
        throw error;
      }

      return data.id;
      
    } catch (error) {
      console.error('❌ Failed to create toilet:', error);
      throw error;
    }
  }

  async getToilets(): Promise<Toilet[]> {
    try {
      // Silent for performance
      
      // Use pagination to get all toilets - fetch in chunks of 1000
      let allToilets: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('toilets')
          .select('*')
          .eq('is_removed', false)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('❌ Error fetching toilets:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allToilets = allToilets.concat(data);
          from += pageSize;
          // Silent for performance
        } else {
          hasMore = false;
        }
      }

            // Silent for performance
      
      // Check for toilets with invalid coordinates (silent for performance)
      const invalidToilets = allToilets.filter(t => 
        !t.coordinates || 
        typeof t.coordinates.lat !== 'number' || 
        typeof t.coordinates.lng !== 'number'
      );
      
      const transformedToilets = allToilets.map(this.transformToilet);
      // Silent for performance
      
      return transformedToilets;
    } catch (error) {
      console.error('❌ Failed to fetch toilets:', error);
      throw error;
    }
  }

  async getToiletsNearby(lat: number, lng: number, radiusKm: number = 10): Promise<Toilet[]> {
    try {
      // Use a more efficient approach with rough bounding box filtering first
      // This reduces the number of toilets we need to process
      
      // Calculate rough bounding box (1 degree ≈ 111 km)
      const latBuffer = radiusKm / 111;
      const lngBuffer = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const minLat = lat - latBuffer;
      const maxLat = lat + latBuffer;
      const minLng = lng - lngBuffer;
      const maxLng = lng + lngBuffer;
      
      // First, get toilets within the bounding box using JSON path queries
      const { data, error } = await supabase
        .from('toilets')
        .select('*')
        .eq('is_removed', false)
        .gte('coordinates->lat', minLat)
        .lte('coordinates->lat', maxLat)
        .gte('coordinates->lng', minLng)
        .lte('coordinates->lng', maxLng);

      if (error) {
        console.error('❌ Error fetching nearby toilets:', error);
        throw error;
      }

      // Now filter by exact distance and transform
      const toilets = data
        .map(this.transformToilet)
        .filter((toilet: Toilet) => {
          const distance = this.calculateDistance(lat, lng, toilet.coordinates.lat, toilet.coordinates.lng);
          return distance <= radiusKm;
        });

      return toilets;
      return toilets;
      
    } catch (error) {
      console.error('❌ Failed to fetch nearby toilets:', error);
      throw error;
    }
  }

  async createReview(review: InsertReview): Promise<void> {
    try {
      // First, check if reviews table exists and has the right structure
      const { data: existingReviews, error: checkError } = await supabase
        .from('reviews')
        .select('*')
        .limit(1);

      if (checkError) {
        console.error('❌ Reviews table error:', checkError);
        throw new Error('Reviews table not found or not accessible. Please run the SQL script in Supabase dashboard first.');
      }

      const { error } = await supabase
        .from('reviews')
        .insert([{
          toilet_id: review.toiletId,
          user_id: review.userId,
          user_name: review.userName,
          rating: review.rating,
          text: review.text,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('❌ Error creating review:', error);
        throw error;
      }

      // Update toilet review count
      const { error: updateError } = await supabase
        .from('toilets')
        .update({ 
          review_count: (existingReviews.length || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', review.toiletId);

      if (updateError) {
        console.error('❌ Error updating toilet review count:', updateError);
      }
    } catch (error) {
      console.error('❌ Failed to create review:', error);
      throw error;
    }
  }

  async getReviewsForToilet(toiletId: string): Promise<Review[]> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('toilet_id', toiletId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching reviews:', error);
        throw error;
      }

      return data.map((review: any) => ({
        id: review.id,
        toiletId: review.toilet_id,
        userId: review.user_id,
        userName: review.user_name,
        rating: review.rating,
        text: review.text,
        createdAt: new Date(review.created_at)
      }));
    } catch (error) {
      console.error('❌ Failed to fetch reviews:', error);
      throw error;
    }
  }

  async hasUserReviewedToilet(toiletId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id')
        .eq('toilet_id', toiletId)
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking user review:', error);
        throw error;
      }

      return data.length > 0;
    } catch (error) {
      console.error('❌ Failed to check user review:', error);
      return false;
    }
  }

  async createReport(report: InsertReport): Promise<void> {
    try {
      // Silent for performance
      
      const reportData = {
        toilet_id: report.toiletId,
        user_id: report.userId,
        user_name: report.userName,
        reason: report.reason,
        comment: report.comment || null,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('reports')
        .insert([reportData]);

      if (error) {
        console.error('❌ Error creating report:', error);
        throw error;
      }

              // Silent for performance
    } catch (error) {
      console.error('❌ Failed to create report:', error);
      throw error;
    }
  }

  async reportToiletNotExists(toiletReport: InsertToiletReport): Promise<void> {
    try {
      // Silent for performance
      
      const reportData = {
        toilet_id: toiletReport.toiletId,
        user_id: toiletReport.userId,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('toilet_reports')
        .insert([reportData]);

      if (error) {
        console.error('❌ Error reporting toilet:', error);
        throw error;
      }

              // Silent for performance
    } catch (error) {
      console.error('❌ Failed to report toilet:', error);
      throw error;
    }
  }

  async getToiletReportCount(toiletId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('toilet_reports')
        .select('*', { count: 'exact', head: true })
        .eq('toilet_id', toiletId);

      if (error) {
        console.error('❌ Error getting report count:', error);
        throw error;
      }

      // Silent for performance
      return count || 0;
    } catch (error) {
      console.error('❌ Failed to get report count:', error);
      return 0;
    }
  }

  async hasUserReportedToilet(toiletId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('toilet_reports')
        .select('id')
        .eq('toilet_id', toiletId)
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking user report:', error);
        throw error;
      }

      return data.length > 0;
    } catch (error) {
      console.error('❌ Failed to check user report:', error);
      return false;
    }
  }

  async removeToiletFromReports(toiletId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('toilets')
        .update({ 
          is_removed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', toiletId);

      if (error) {
        console.error('❌ Error removing toilet:', error);
        throw error;
      }

              // Silent for performance
    } catch (error) {
      console.error('❌ Failed to remove toilet:', error);
      throw error;
    }
  }

  async updateToilet(toiletId: string, updateData: Partial<InsertToilet>): Promise<void> {
    try {
      const updatePayload: any = {};
      
      if (updateData.type) updatePayload.type = updateData.type;
      if (updateData.title !== undefined) updatePayload.title = updateData.title;
      if (updateData.accessibility) updatePayload.accessibility = updateData.accessibility;
      if (updateData.accessType) updatePayload.access_type = updateData.accessType;
      if (updateData.notes !== undefined) updatePayload.notes = updateData.notes;
      if (updateData.coordinates) updatePayload.coordinates = updateData.coordinates;
      
      updatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('toilets')
        .update(updatePayload)
        .eq('id', toiletId);

      if (error) {
        console.error('❌ Error updating toilet:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to update toilet:', error);
      throw error;
    }
  }

  async deleteToilet(toiletId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('toilets')
        .delete()
        .eq('id', toiletId);

      if (error) {
        console.error('❌ Error deleting toilet:', error);
        throw error;
      }

              // Silent for performance
    } catch (error) {
      console.error('❌ Failed to delete toilet:', error);
      throw error;
    }
  }

  async getUserToilets(userId: string): Promise<Toilet[]> {
    try {
      const { data, error } = await supabase
        .from('toilets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_removed', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user toilets:', error);
        throw error;
      }

      return data.map(this.transformToilet);
    } catch (error) {
      console.error('❌ Failed to fetch user toilets:', error);
      throw error;
    }
  }

  async getUserReviews(userId: string): Promise<Review[]> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user reviews:', error);
        throw error;
      }

      return data.map((review: any) => ({
        id: review.id,
        toiletId: review.toilet_id,
        userId: review.user_id,
        userName: review.user_name,
        rating: review.rating,
        text: review.text,
        createdAt: new Date(review.created_at)
      }));
    } catch (error) {
      console.error('❌ Failed to fetch user reviews:', error);
      throw error;
    }
  }

  async deleteReview(reviewId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        console.error('❌ Error deleting review:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to delete review:', error);
      throw error;
    }
  }

  async queueChange(type: 'add' | 'report' | 'delete', data: any): Promise<void> {
    // For Supabase, we execute changes immediately instead of queuing
    // Silent for performance
    
    try {
      switch (type) {
        case 'add':
          await this.createToilet(data);
          break;
        case 'delete':
          await this.deleteToilet(data.toiletId);
          break;
        case 'report':
          if (data.toiletId) {
            await this.reportToiletNotExists(data);
          } else {
            await this.createReport(data);
          }
          break;
        default:
          console.warn(`Unknown queue operation type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to execute ${type} operation:`, error);
      throw error;
    }
  }

  private transformToilet(data: any): Toilet {
    // Check for invalid data but don't throw errors - try to fix if possible
    if (!data) {
      console.error('❌ Invalid toilet data in transformToilet: data is null or undefined');
      throw new Error('Invalid toilet data: data is null or undefined');
    }
    
    // Try to fix coordinates if they're invalid
    let coordinates = data.coordinates;
    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      console.warn(`⚠️ Toilet ${data.id} has invalid coordinates:`, coordinates);
      
      // Try to use a default coordinate if none exists
      coordinates = {
        lat: typeof coordinates?.lat === 'number' ? coordinates.lat : 42.6977, // Sofia center as fallback
        lng: typeof coordinates?.lng === 'number' ? coordinates.lng : 23.3219
      };
      
      // Silent for performance
    }
    
    const transformed = {
      id: data.id,
      coordinates: coordinates,
      lat: coordinates.lat,
      lng: coordinates.lng,
      type: data.type || 'other',
      title: data.title,
      source: data.source || 'user', // Default to user if source is missing
      tags: data.tags || {},
      notes: data.notes,
      accessibility: data.accessibility || 'unknown',
      accessType: data.access_type || 'unknown',
      userId: data.user_id || 'unknown',
      addedByUserName: data.added_by_user_name,
      osmId: data.osm_id || null,
      reportCount: data.report_count || 0,
      isRemoved: data.is_removed || false,
      removedAt: data.removed_at ? new Date(data.removed_at) : null,
      createdAt: new Date(data.created_at || Date.now()),
      averageRating: data.average_rating || 0,
      reviewCount: data.review_count || 0
    };
    
    // No logging for performance
    
    return transformed;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const supabaseStorage = new SupabaseStorage(); 