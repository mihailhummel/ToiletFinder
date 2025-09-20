import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

// Use service key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export class SupabaseStorage {
  
  async getUserToilets(userId) {
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

  async getUserReviews(userId) {
    try {
      // First get the reviews
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user reviews:', error);
        throw error;
      }

      // Then get toilet information for each review
      const reviewsWithToilets = await Promise.all(
        reviews.map(async (review) => {
          const { data: toilet } = await supabase
            .from('toilets')
            .select('id, title, type')
            .eq('id', review.toilet_id)
            .single();

          return {
            id: review.id,
            toiletId: review.toilet_id,
            userId: review.user_id,
            userName: review.user_name,
            rating: review.rating,
            text: review.text,
            createdAt: new Date(review.created_at),
            toilet: toilet ? {
              id: toilet.id,
              title: toilet.title,
              type: toilet.type
            } : null
          };
        })
      );

      return reviewsWithToilets;
    } catch (error) {
      console.error('❌ Failed to fetch user reviews:', error);
      throw error;
    }
  }

  async deleteReview(reviewId) {
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

  async deleteToilet(toiletId) {
    try {
      const { error } = await supabase
        .from('toilets')
        .delete()
        .eq('id', toiletId);

      if (error) {
        console.error('❌ Error deleting toilet:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to delete toilet:', error);
      throw error;
    }
  }

  transformToilet(data) {
    if (!data) {
      throw new Error('Invalid toilet data: data is null or undefined');
    }
    
    // Try to fix coordinates if they're invalid
    let coordinates = data.coordinates;
    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      coordinates = {
        lat: typeof coordinates?.lat === 'number' ? coordinates.lat : 42.6977, // Sofia center as fallback
        lng: typeof coordinates?.lng === 'number' ? coordinates.lng : 23.3219
      };
    }
    
    return {
      id: data.id,
      coordinates: coordinates,
      lat: coordinates.lat,
      lng: coordinates.lng,
      type: data.type || 'other',
      title: data.title,
      source: data.source || 'user',
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
  }
}

export const supabaseStorage = new SupabaseStorage();
