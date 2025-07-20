import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationData {
  phone_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // POST /location-api - Send location data from phone
    if (req.method === 'POST' && path.endsWith('/location-api')) {
      const { phone_id, latitude, longitude, accuracy, timestamp }: LocationData = await req.json();
      
      console.log('Received location data:', { phone_id, latitude, longitude, accuracy, timestamp });

      if (!phone_id || latitude === undefined || longitude === undefined) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: phone_id, latitude, longitude' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Find the phone by phone_id
      const { data: phone, error: phoneError } = await supabase
        .from('phones')
        .select('id')
        .eq('phone_id', phone_id)
        .single();

      if (phoneError || !phone) {
        console.error('Phone not found:', phoneError);
        return new Response(
          JSON.stringify({ error: 'Phone not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Insert location data
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          phone_id: phone.id,
          latitude,
          longitude,
          accuracy,
          timestamp: timestamp || new Date().toISOString()
        })
        .select()
        .single();

      if (locationError) {
        console.error('Error inserting location:', locationError);
        return new Response(
          JSON.stringify({ error: 'Failed to save location' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      console.log('Location saved successfully:', location);

      return new Response(
        JSON.stringify({ success: true, location }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // GET /location-api/phone/:phoneId - Get latest location for a phone
    if (req.method === 'GET' && path.includes('/phone/')) {
      const phoneId = path.split('/phone/')[1];
      
      if (!phoneId) {
        return new Response(
          JSON.stringify({ error: 'Phone ID required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Get the latest location for the phone
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select(`
          *,
          phones!inner(phone_id, name, user_id, last_update)
        `)
        .eq('phones.phone_id', phoneId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (locationError) {
        console.error('Error fetching location:', locationError);
        return new Response(
          JSON.stringify({ error: 'Location not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ location }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // GET /location-api/phone/:phoneId/history - Get location history for a phone
    if (req.method === 'GET' && path.includes('/history')) {
      const phoneId = path.split('/phone/')[1]?.split('/history')[0];
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam) : 100;
      
      if (!phoneId) {
        return new Response(
          JSON.stringify({ error: 'Phone ID required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Get location history for the phone
      const { data: locations, error: locationsError } = await supabase
        .from('locations')
        .select(`
          *,
          phones!inner(phone_id, name, user_id)
        `)
        .eq('phones.phone_id', phoneId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (locationsError) {
        console.error('Error fetching location history:', locationsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch location history' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ locations }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in location-api function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);