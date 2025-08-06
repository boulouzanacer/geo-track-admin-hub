import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: string;
  start_time?: string | null;
  end_time?: string | null;
  enabled?: boolean;
}

interface UpdateUserRequest {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  start_time?: string | null;
  end_time?: string | null;
  enabled?: boolean;
}

interface DeleteUserRequest {
  userId: string;
  authUserId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
        },
      }
    );

    // Create regular client for user verification
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Check if user is admin using admin client
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (!userProfile || userProfile.role !== 'admin') {
      console.error('User profile:', userProfile, 'User ID:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'create': {
        const { email, password, name, role, start_time, end_time, enabled = true }: CreateUserRequest = await req.json();

        // Check if email already exists in users table OR auth
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (existingUser) {
          return new Response(
            JSON.stringify({ error: 'A user with this email already exists' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // Also check if user exists in auth
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = authUsers.users?.find(u => u.email === email);
        
        if (existingAuthUser) {
          return new Response(
            JSON.stringify({ error: 'A user with this email already exists in authentication' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) {
          return new Response(
            JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // Add user to users table
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            auth_user_id: authData.user.id,
            name,
            email,
            role,
            start_time: start_time || null,
            end_time: end_time || null,
            enabled,
          })
          .select()
          .single();

        if (userError) {
          // If user table insert fails, clean up auth user
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return new Response(
            JSON.stringify({ error: `Failed to create user profile: ${userError.message}` }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        return new Response(JSON.stringify({ success: true, user: userData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'update': {
        const { userId, name, email, role, start_time, end_time, enabled }: UpdateUserRequest = await req.json();

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (role !== undefined) updateData.role = role;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) updateData.end_time = end_time;
        if (enabled !== undefined) updateData.enabled = enabled;

        const { error } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', userId);

        if (error) {
          return new Response(
            JSON.stringify({ error: `Failed to update user: ${error.message}` }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'delete': {
        const { userId, authUserId }: DeleteUserRequest = await req.json();

        // Delete from users table first
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: `Failed to delete user: ${deleteError.message}` }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // Delete from auth if has auth_user_id
        if (authUserId) {
          const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
          if (authDeleteError) {
            console.warn('Auth deletion failed:', authDeleteError);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
    }

  } catch (error: any) {
    console.error('Error in admin-user-management function:', error);
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