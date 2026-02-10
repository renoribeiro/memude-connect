import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageUserRequest {
    action: 'update' | 'delete' | 'toggle_active' | 'list';
    user_id?: string;
    data?: {
        first_name?: string;
        last_name?: string;
        phone?: string;
        role?: 'admin' | 'corretor' | 'cliente';
        is_active?: boolean;
    };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Verify caller is authenticated
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: No authorization header' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !callerUser) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Invalid token' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Check if caller is admin
        const { data: callerRole, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', callerUser.id)
            .eq('role', 'admin')
            .maybeSingle();

        if (roleError || !callerRole) {
            return new Response(
                JSON.stringify({ error: 'Forbidden: Admin access required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        const body: ManageUserRequest = await req.json();
        const { action } = body;

        // === ACTION: LIST ===
        if (action === 'list') {
            // Fetch all profiles
            const { data: profiles, error: profilesError } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Fetch all user roles
            const { data: roles, error: rolesError } = await supabaseAdmin
                .from('user_roles')
                .select('user_id, role');

            if (rolesError) throw rolesError;

            // Fetch all auth users to get emails
            const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();

            if (authUsersError) throw authUsersError;

            // Build a map of user_id -> email
            const emailMap = new Map<string, string>();
            for (const u of authUsers.users) {
                emailMap.set(u.id, u.email || '');
            }

            // Build a map of user_id -> role
            const roleMap = new Map<string, string>();
            for (const r of roles) {
                roleMap.set(r.user_id, r.role);
            }

            // Combine data
            const users = profiles.map((p: any) => ({
                ...p,
                email: emailMap.get(p.user_id) || '',
                role: roleMap.get(p.user_id) || p.role || 'cliente',
            }));

            return new Response(
                JSON.stringify({ success: true, users }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // All other actions require user_id
        const { user_id, data } = body;

        if (!user_id) {
            return new Response(
                JSON.stringify({ error: 'user_id is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // === ACTION: UPDATE ===
        if (action === 'update') {
            if (!data) {
                return new Response(
                    JSON.stringify({ error: 'data is required for update' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                );
            }

            // Update profile
            const profileUpdate: Record<string, any> = {};
            if (data.first_name !== undefined) profileUpdate.first_name = data.first_name;
            if (data.last_name !== undefined) profileUpdate.last_name = data.last_name;
            if (data.phone !== undefined) profileUpdate.phone = data.phone;

            if (Object.keys(profileUpdate).length > 0) {
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update(profileUpdate)
                    .eq('user_id', user_id);

                if (profileError) {
                    console.error('Profile update error:', profileError);
                    throw profileError;
                }
            }

            // Update role in user_roles if provided
            if (data.role) {
                const { error: roleUpdateError } = await supabaseAdmin
                    .from('user_roles')
                    .update({ role: data.role })
                    .eq('user_id', user_id);

                if (roleUpdateError) {
                    console.error('Role update error:', roleUpdateError);
                    throw roleUpdateError;
                }

                // Also update auth user metadata
                await supabaseAdmin.auth.admin.updateUserById(user_id, {
                    user_metadata: { role: data.role }
                });
            }

            // Update auth user metadata for name
            if (data.first_name || data.last_name) {
                const metadataUpdate: Record<string, any> = {};
                if (data.first_name) metadataUpdate.first_name = data.first_name;
                if (data.last_name) metadataUpdate.last_name = data.last_name;

                await supabaseAdmin.auth.admin.updateUserById(user_id, {
                    user_metadata: metadataUpdate
                });
            }

            console.log(`User ${user_id} updated successfully`);

            return new Response(
                JSON.stringify({ success: true, message: 'User updated successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // === ACTION: TOGGLE_ACTIVE ===
        if (action === 'toggle_active') {
            // Prevent self-deactivation
            if (user_id === callerUser.id) {
                return new Response(
                    JSON.stringify({ error: 'You cannot deactivate your own account' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                );
            }

            // Get current is_active status
            const { data: currentProfile, error: fetchError } = await supabaseAdmin
                .from('profiles')
                .select('is_active')
                .eq('user_id', user_id)
                .single();

            if (fetchError) throw fetchError;

            const newActive = !(currentProfile.is_active ?? true);

            // Update profiles
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ is_active: newActive })
                .eq('user_id', user_id);

            if (updateError) throw updateError;

            // Ban/unban auth user
            await supabaseAdmin.auth.admin.updateUserById(user_id, {
                ban_duration: newActive ? 'none' : '876000h' // ~100 years
            });

            console.log(`User ${user_id} is now ${newActive ? 'active' : 'inactive'}`);

            return new Response(
                JSON.stringify({ success: true, is_active: newActive }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // === ACTION: DELETE ===
        if (action === 'delete') {
            // Prevent self-deletion
            if (user_id === callerUser.id) {
                return new Response(
                    JSON.stringify({ error: 'You cannot delete your own account' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                );
            }

            // 1. Delete from user_roles
            await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);

            // 2. Delete from profiles
            await supabaseAdmin.from('profiles').delete().eq('user_id', user_id);

            // 3. Delete auth user
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
            if (deleteAuthError) {
                console.error('Error deleting auth user:', deleteAuthError);
                throw deleteAuthError;
            }

            console.log(`User ${user_id} deleted successfully`);

            return new Response(
                JSON.stringify({ success: true, message: 'User deleted successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        return new Response(
            JSON.stringify({ error: `Unknown action: ${action}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );

    } catch (error: any) {
        console.error('Error in manage-user function:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
