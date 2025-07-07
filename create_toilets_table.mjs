#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fvohytokcumrauwplnwo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createToiletsTable() {
  console.log('🗄️ Creating toilets table in Supabase...\n');

  try {
    // First, try to create a basic toilets table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS public.toilets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        coordinates JSONB NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'public',
        source VARCHAR(20) NOT NULL DEFAULT 'osm',
        tags JSONB DEFAULT '{}',
        notes TEXT,
        is_removed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('📝 Creating toilets table...');
    
    // Try basic insert to test if we can create table via insert
    const { data, error } = await supabase
      .from('toilets')
      .insert({
        coordinates: { lat: 42.7, lng: 23.3 },
        type: 'test',
        source: 'test',
        notes: 'Test entry for table creation'
      })
      .select();

    if (error) {
      console.log('ℹ️ Table does not exist yet, this is expected:', error.message);
      console.log('\n📋 Manual Setup Required:');
      console.log('Please go to the Supabase Dashboard and run this SQL:');
      console.log('👉 https://app.supabase.com/project/fvohytokcumrauwplnwo/sql\n');
      console.log('Copy and paste this SQL code:');
      console.log('```sql');
      console.log(createTableQuery);
      console.log('```\n');
    } else {
      console.log('✅ Table exists! Test entry created:', data[0].id);
      
      // Clean up test entry
      await supabase
        .from('toilets')
        .delete()
        .eq('id', data[0].id);
      
      console.log('🧹 Test entry cleaned up');
    }

    // Test if table exists now
    const { data: testData, error: testError } = await supabase
      .from('toilets')
      .select('*', { count: 'exact', head: true });

    if (testError) {
      console.log('\n❌ Table not accessible yet');
      console.log('Please create the table manually using the SQL above, then run the migration script');
      return false;
    } else {
      console.log('✅ Toilets table is ready for migration!');
      console.log(`📊 Current table has ${testData} rows`);
      return true;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

createToiletsTable(); 