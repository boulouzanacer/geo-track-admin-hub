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
}

interface UpdateUserRequest {
  userId: string;
  name: string;
  email: string;
  role: string;
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
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw new Error('Failed to get user profile');
    }

    if (userProfile?.role !== 'admin') {
      console.error('User role:', userProfile?.role, 'User ID:', user.id);
      throw new Error('Admin access required');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'create': {
        const { email, password, name, role }: CreateUserRequest = await req.json();

        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) {
          throw new Error(`Failed to create auth user: ${authError.message}`);
        }

        // Add user to users table
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            auth_user_id: authData.user.id,
            name,
            email,
            role,
          })
          .select()
          .single();

        if (userError) {
          // If user table insert fails, clean up auth user
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw new Error(`Failed to create user profile: ${userError.message}`);
        }

        return new Response(JSON.stringify({ success: true, user: userData }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      case 'update': {
        const { userId, name, email, role }: UpdateUserRequest = await req.json();

        const { error } = await supabaseAdmin
          .from('users')
          .update({ name, email, role })
          .eq('id', userId);

        if (error) {
          throw new Error(`Failed to update user: ${error.message}`);
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
          throw new Error(`Failed to delete user: ${deleteError.message}`);
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
        throw new Error('Invalid action');
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