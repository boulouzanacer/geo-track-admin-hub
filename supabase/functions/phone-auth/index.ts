import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthRequest {
  phone_id: string;
  username: string;
  password: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phone_id, username, password }: AuthRequest = await req.json();

    if (!phone_id || !username || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`DEBUG: Phone auth request - phone_id: ${phone_id}, username: ${username}`);

    // Check if user exists and get their details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, enabled, auth_user_id')
      .eq('name', username)
      .single();

    if (userError || !userData) {
      console.log(`DEBUG: User not found - username: ${username}, error:`, userError);
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials',
        debug: `User '${username}' not found` 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`DEBUG: User found - id: ${userData.id}, enabled: ${userData.enabled}`);

    // For this example, we'll accept either "defaultpassword" or the user's name as password
    // In production, you should use proper password hashing
    if (password !== 'defaultpassword' && password !== userData.name.toLowerCase()) {
      console.log(`DEBUG: Invalid password for user: ${username}, tried: ${password}`);
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials',
        debug: `Invalid password. Try 'defaultpassword' or '${userData.name.toLowerCase()}'`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is enabled
    if (!userData.enabled) {
      console.log(`DEBUG: User disabled - username: ${username}`);
      return new Response(JSON.stringify({ message: 'account disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if phone exists
    const { data: phoneData, error: phoneError } = await supabase
      .from('phones')
      .select('id, phone_id, user_id')
      .eq('phone_id', phone_id)
      .single();

    if (phoneError && phoneError.code === 'PGRST116') {
      // Phone doesn't exist, add it to the user
      console.log(`DEBUG: Phone not found, adding new phone - phone_id: ${phone_id}`);
      
      const { data: newPhone, error: insertError } = await supabase
        .from('phones')
        .insert({
          phone_id: phone_id,
          name: `Phone ${phone_id}`,
          user_id: userData.id
        })
        .select()
        .single();

      if (insertError) {
        console.error(`DEBUG: Error adding phone:`, insertError);
        return new Response(JSON.stringify({ error: 'Failed to add phone' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`DEBUG: Phone added successfully:`, newPhone);
      return new Response(JSON.stringify({ message: 'phone added successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (phoneError) {
      console.error(`DEBUG: Error checking phone:`, phoneError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phone exists, check if it belongs to the user
    if (phoneData.user_id !== userData.id) {
      console.log(`DEBUG: Phone belongs to different user - phone_id: ${phone_id}, expected_user: ${userData.id}, actual_user: ${phoneData.user_id}`);
      return new Response(JSON.stringify({ error: 'Phone belongs to another user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`DEBUG: User authenticated and phone verified - phone_id: ${phone_id}, user: ${username}`);
    return new Response(JSON.stringify({ message: 'connected' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in phone-auth function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});