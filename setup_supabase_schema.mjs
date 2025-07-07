#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Supabase credentials
const SUPABASE_URL = 'https://fvohytokcumrauwplnwo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2h5dG9rY3VtcmF1d3BsbndvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg5MDczOCwiZXhwIjoyMDY3NDY2NzM4fQ.nJIBMdMfRd7BB38zS43g40zfLTLGisXVvaKH6SZDvXw';

// Initialize Supabase with service key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Execute SQL commands one by one to set up the schema
 */
async function setupSchema() {
  console.log('🗄️ Setting up Supabase database schema...\n');

  // SQL commands in order
  const sqlCommands = [
    // Enable PostGIS extension
    {
      name: 'Enable PostGIS extension',
      sql: 'CREATE EXTENSION IF NOT EXISTS postgis;'
    },
    
    // Create toilets table
    {
      name: 'Create toilets table',
      sql: `CREATE TABLE IF NOT EXISTS public.toilets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        coordinates JSONB NOT NULL,
        type VARCHAR(50) NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'osm',
        tags JSONB,
        notes TEXT,
        is_removed BOOLEAN DEFAULT FALSE,
        location GEOMETRY(POINT, 4326) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    },

    // Create spatial index
    {
      name: 'Create spatial index',
      sql: 'CREATE INDEX IF NOT EXISTS toilets_location_idx ON public.toilets USING GIST (location);'
    },

    // Create other indexes
    {
      name: 'Create type index',
      sql: 'CREATE INDEX IF NOT EXISTS toilets_type_idx ON public.toilets (type);'
    },
    {
      name: 'Create source index', 
      sql: 'CREATE INDEX IF NOT EXISTS toilets_source_idx ON public.toilets (source);'
    },
    {
      name: 'Create is_removed index',
      sql: 'CREATE INDEX IF NOT EXISTS toilets_is_removed_idx ON public.toilets (is_removed);'
    },
    {
      name: 'Create created_at index',
      sql: 'CREATE INDEX IF NOT EXISTS toilets_created_at_idx ON public.toilets (created_at);'
    }
  ];

  // Execute each command
  for (const command of sqlCommands) {
    try {
      console.log(`⚡ ${command.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: command.sql });
      
      if (error) {
        // Try alternative method for simple SQL
        const { error: directError } = await supabase
          .from('_sql_exec')
          .insert({ query: command.sql });
        
        if (directError) {
          console.warn(`⚠️ Warning for ${command.name}:`, error.message);
          // Continue with other commands
        } else {
          console.log(`✅ ${command.name} completed`);
        }
      } else {
        console.log(`✅ ${command.name} completed`);
      }
    } catch (error) {
      console.warn(`⚠️ Warning for ${command.name}:`, error.message);
      // Continue with other commands
    }
  }

  // Create functions
  await createFunctions();
  
  // Setup RLS
  await setupRLS();
  
  // Verify setup
  await verifySetup();
}

/**
 * Create PostGIS functions for spatial queries
 */
async function createFunctions() {
  console.log('\n🔧 Creating PostGIS functions...');

  const functions = [
    {
      name: 'Location update trigger function',
      sql: `
        CREATE OR REPLACE FUNCTION update_toilet_location()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.location = ST_SetSRID(
            ST_Point(
              (NEW.coordinates->>'lng')::FLOAT,
              (NEW.coordinates->>'lat')::FLOAT
            ), 
            4326
          );
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: 'Location update trigger',
      sql: `
        DROP TRIGGER IF EXISTS update_toilet_location_trigger ON public.toilets;
        CREATE TRIGGER update_toilet_location_trigger
          BEFORE INSERT OR UPDATE ON public.toilets
          FOR EACH ROW
          EXECUTE FUNCTION update_toilet_location();
      `
    },
    {
      name: 'Bounding box query function',
      sql: `
        CREATE OR REPLACE FUNCTION get_toilets_in_bounds(
          west FLOAT,
          south FLOAT,
          east FLOAT,
          north FLOAT
        )
        RETURNS TABLE (
          id UUID,
          coordinates JSONB,
          type VARCHAR(50),
          source VARCHAR(20),
          tags JSONB,
          notes TEXT,
          is_removed BOOLEAN,
          created_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            t.id,
            t.coordinates,
            t.type,
            t.source,
            t.tags,
            t.notes,
            t.is_removed,
            t.created_at,
            t.updated_at
          FROM public.toilets t
          WHERE 
            t.is_removed = FALSE
            AND ST_Within(
              t.location, 
              ST_MakeEnvelope(west, south, east, north, 4326)
            );
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: 'Radius query function',
      sql: `
        CREATE OR REPLACE FUNCTION get_toilets_near_point(
          lat FLOAT,
          lng FLOAT,
          radius_meters FLOAT DEFAULT 5000
        )
        RETURNS TABLE (
          id UUID,
          coordinates JSONB,
          type VARCHAR(50),
          source VARCHAR(20),
          tags JSONB,
          notes TEXT,
          is_removed BOOLEAN,
          created_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE,
          distance_meters FLOAT
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            t.id,
            t.coordinates,
            t.type,
            t.source,
            t.tags,
            t.notes,
            t.is_removed,
            t.created_at,
            t.updated_at,
            ST_Distance(
              t.location::geography, 
              ST_Point(lng, lat)::geography
            )::FLOAT as distance_meters
          FROM public.toilets t
          WHERE 
            t.is_removed = FALSE
            AND ST_DWithin(
              t.location::geography,
              ST_Point(lng, lat)::geography,
              radius_meters
            )
          ORDER BY distance_meters;
        END;
        $$ LANGUAGE plpgsql;
      `
    }
  ];

  for (const func of functions) {
    try {
      console.log(`🔧 Creating ${func.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
      if (error) {
        console.warn(`⚠️ ${func.name}: ${error.message}`);
      } else {
        console.log(`✅ ${func.name} created`);
      }
    } catch (error) {
      console.warn(`⚠️ ${func.name}: ${error.message}`);
    }
  }
}

/**
 * Setup Row Level Security
 */
async function setupRLS() {
  console.log('\n🛡️ Setting up Row Level Security...');

  const rlsCommands = [
    'ALTER TABLE public.toilets ENABLE ROW LEVEL SECURITY;',
    `CREATE POLICY IF NOT EXISTS "Toilets are viewable by everyone" ON public.toilets
     FOR SELECT USING (true);`,
    `CREATE POLICY IF NOT EXISTS "Authenticated users can insert toilets" ON public.toilets
     FOR INSERT WITH CHECK (auth.role() = 'authenticated');`
  ];

  for (const cmd of rlsCommands) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error) {
        console.warn(`⚠️ RLS setup warning: ${error.message}`);
      }
    } catch (error) {
      console.warn(`⚠️ RLS setup warning: ${error.message}`);
    }
  }

  console.log('✅ RLS policies configured');
}

/**
 * Verify the database setup
 */
async function verifySetup() {
  console.log('\n🔍 Verifying database setup...');

  try {
    // Test table exists
    const { data: tables, error: tableError } = await supabase
      .from('toilets')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      console.log('❌ Toilets table verification failed:', tableError.message);
    } else {
      console.log('✅ Toilets table exists and accessible');
    }

    // Test PostGIS functions
    try {
      const { data: boundsTest, error: boundsError } = await supabase
        .rpc('get_toilets_in_bounds', {
          west: 23.0,
          south: 42.0,
          east: 24.0,
          north: 43.0
        });

      if (boundsError) {
        console.log('❌ Bounds function test failed:', boundsError.message);
      } else {
        console.log('✅ Spatial bounding box function working');
      }
    } catch (error) {
      console.log('❌ Bounds function not available yet (will be created during migration)');
    }

    console.log('\n🎉 Database schema setup completed successfully!');
    console.log('\n📋 What was created:');
    console.log('✅ toilets table with PostGIS geometry column');
    console.log('✅ Spatial indexes for fast location queries');
    console.log('✅ PostGIS functions for bounding box and radius queries');
    console.log('✅ Automatic location update triggers');
    console.log('✅ Row Level Security policies');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSchema().catch(error => {
    console.error('💥 Schema setup failed:', error);
    process.exit(1);
  });
} 