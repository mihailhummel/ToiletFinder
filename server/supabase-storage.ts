import { createClient } from '@supabase/supabase-js';
import { IStorage } from './storage';
import type { Toilet, Review, Report, ToiletReport, InsertToilet, InsertReview, InsertReport, InsertToiletReport } from '@shared/schema';

const supabaseUrl = 'https://fvohytokcumrauwplnwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

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
      console.log('🚽 Creating toilet in Supabase:', toilet);
      
      const toiletData = {
        coordinates: toilet.coordinates,
        type: toilet.type,
        source: toilet.source || 'user',
        tags: toilet.tags || {},
        notes: toilet.notes || null,
        is_removed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('toilets')
        .insert([toiletData])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating toilet:', error);
        throw error;
      }

      console.log('✅ Toilet created successfully:', data.id);
      return data.id;
      
    } catch (error) {
      console.error('❌ Failed to create toilet:', error);
      throw error;
    }
  }

  async getToilets(): Promise<Toilet[]> {
    try {
      const { data, error } = await supabase
        .from('toilets')
        .select('*')
        .eq('is_removed', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all toilets:', error);
        throw error;
      }

      return data.map(this.transformToilet);
    } catch (error) {
      console.error('❌ Failed to fetch toilets:', error);
      throw error;
    }
  }

  async getToiletsNearby(lat: number, lng: number, radiusKm: number = 10): Promise<Toilet[]> {
    try {
      console.log(`🔍 Fetching toilets near ${lat}, ${lng} within ${radiusKm}km`);
      
      // Expand bounds slightly for spatial query
      const latOffset = radiusKm / 111; // 1 degree lat ≈ 111km
      const lngOffset = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const { data, error } = await supabase
        .rpc('get_toilets_in_bounds', {
          west: lng - lngOffset,
          south: lat - latOffset,
          east: lng + lngOffset,
          north: lat + latOffset
        });

      if (error) {
        console.error('❌ Error fetching nearby toilets:', error);
        throw error;
      }

      // Filter by exact distance and transform
      const toilets = data
        .map(this.transformToilet)
        .filter((toilet: Toilet) => {
          const distance = this.calculateDistance(lat, lng, toilet.coordinates.lat, toilet.coordinates.lng);
          return distance <= radiusKm;
        });

      console.log(`✅ Found ${toilets.length} toilets within ${radiusKm}km`);
      return toilets;
      
    } catch (error) {
      console.error('❌ Failed to fetch nearby toilets:', error);
      throw error;
    }
  }

  async createReview(review: InsertReview): Promise<void> {
    try {
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

      console.log('✅ Review created successfully');
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
      const { error } = await supabase
        .from('reports')
        .insert([{
          user_id: report.userId,
          type: report.type,
          description: report.description,
          location: report.location,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('❌ Error creating report:', error);
        throw error;
      }

      console.log('✅ Report created successfully');
    } catch (error) {
      console.error('❌ Failed to create report:', error);
      throw error;
    }
  }

  async reportToiletNotExists(toiletReport: InsertToiletReport): Promise<void> {
    try {
      const { error } = await supabase
        .from('toilet_reports')
        .insert([{
          toilet_id: toiletReport.toiletId,
          user_id: toiletReport.userId,
          reason: toiletReport.reason,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('❌ Error reporting toilet:', error);
        throw error;
      }

      console.log('✅ Toilet report created successfully');
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

      console.log('✅ Toilet marked as removed');
    } catch (error) {
      console.error('❌ Failed to remove toilet:', error);
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

      console.log('✅ Toilet deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete toilet:', error);
      throw error;
    }
  }

  async queueChange(type: 'add' | 'report' | 'delete', data: any): Promise<void> {
    // For Supabase, we execute changes immediately instead of queuing
    console.log(`🔄 Executing ${type} operation immediately in Supabase`);
    
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
    return {
      id: data.id,
      coordinates: data.coordinates,
      type: data.type,
      source: data.source,
      tags: data.tags || {},
      notes: data.notes,
      isRemoved: data.is_removed || false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at)
    };
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