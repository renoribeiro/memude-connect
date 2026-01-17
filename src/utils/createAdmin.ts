import { supabase } from '@/integrations/supabase/client';

export const createAdminUser = async () => {
  try {
    const response = await supabase.functions.invoke('create-admin', {
      body: {
        email: 'reno@re9.online',
        password: '123Re92019!@#',
        firstName: 'Reno',
        lastName: 'Administrador'
      }
    });

    if (response.error) {
      console.error('Error creating admin:', response.error);
      return { success: false, error: response.error };
    }

    console.log('Admin created successfully:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error calling create-admin function:', error);
    return { success: false, error };
  }
};

// Execute this in the browser console to create the admin user
// createAdminUser().then(result => console.log('Result:', result));