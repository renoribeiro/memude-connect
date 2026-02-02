import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleSheetsRequest {
  action: 'import' | 'export';
  spreadsheetId: string;
  range?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify caller is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Get the user from the JWT token
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Check if caller has admin role
    const { data: callerRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !callerRoles) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const { action, spreadsheetId, range = 'Sheet1!A:Z' }: GoogleSheetsRequest = await req.json();

    const googleApiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')!;

    console.log(`Starting Google Sheets ${action} for spreadsheet:`, spreadsheetId);

    if (action === 'import') {
      // Import from Google Sheets to Supabase
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${googleApiKey}`
      );

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        return new Response(JSON.stringify({ message: "No data found in spreadsheet" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Expected column order: Nome Completo, CPF, Telefone, Email, CRECI, Cidade, Estado, Bairros, Tipo Imóvel, Construtora, Status, Visitas Realizadas, Visitas Agendadas
      const headers = rows[0];
      const dataRows = rows.slice(1);

      console.log(`Found ${dataRows.length} rows to import`);
      console.log('Headers:', headers);

      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (const row of dataRows) {
        try {
          // Validate required fields first
          const nome = row[0]?.trim() || '';
          const creci = row[4]?.trim() || '';
          const telefone = row[2]?.trim() || '';
          const cidade = row[5]?.trim() || '';
          const estado = row[6]?.trim() || 'CE';
          const tipoImovel = row[8]?.trim() || 'todos';
          const status = row[10]?.trim() || 'em_avaliacao';

          // Skip empty rows or rows without required fields
          if (!nome || !creci || !telefone || !cidade) {
            console.log(`Skipping row - missing required fields: nome=${nome}, creci=${creci}, telefone=${telefone}, cidade=${cidade}`);
            continue;
          }

          // Map row data to corretor fields according to expected format (13 columns)
          const corretorData = {
            nome: nome, // 1. Nome Completo
            cpf: row[1]?.trim() || null, // 2. CPF
            telefone: telefone, // 3. Telefone 
            whatsapp: telefone, // Use same as telefone
            email: row[3]?.trim() || null, // 4. Email
            creci: creci, // 5. CRECI
            cidade: cidade, // 6. Cidade
            estado: estado, // 7. Estado
            tipo_imovel: tipoImovel, // 9. Tipo Imóvel
            status: status, // 11. Status
            observacoes: null
          };

          // Extract bairros and construtoras for later processing
          const bairrosText = row[7]?.trim() || ''; // 8. Bairros (comma-separated)
          const construtorasText = row[9]?.trim() || ''; // 10. Construtora (comma-separated)

          console.log('Processing corretor:', corretorData.nome, corretorData.creci);

          // Check if corretor already exists by CRECI
          const { data: existingCorretor } = await supabase
            .from('corretores')
            .select('id, profile_id')
            .eq('creci', corretorData.creci)
            .maybeSingle();

          let corretorId: string;

          if (existingCorretor) {
            // Update existing corretor
            const { error } = await supabase
              .from('corretores')
              .update(corretorData)
              .eq('id', existingCorretor.id);

            if (error) throw error;
            corretorId = existingCorretor.id;
            updated++;
          } else {
            // Create new corretor - first create user profile
            const tempEmail = corretorData.email || `${corretorData.creci}@temp.memude.com`;
            const tempPassword = `temp_${corretorData.creci}_${Date.now()}`;

            const [firstName, ...lastNameParts] = corretorData.nome.split(' ');
            const lastName = lastNameParts.join(' ') || 'Corretor';

            // Create auth user
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: tempEmail,
              password: tempPassword,
              user_metadata: {
                first_name: firstName,
                last_name: lastName,
                role: 'corretor'
              }
            });

            if (authError) throw authError;

            // Create profile (without role - using user_roles table)
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .insert({
                user_id: authUser.user.id,
                first_name: firstName,
                last_name: lastName,
                role: 'corretor'
              })
              .select()
              .single();

            if (profileError) throw profileError;

            // Create corretor role in user_roles table
            const { error: roleInsertError } = await supabase
              .from('user_roles')
              .insert({
                user_id: authUser.user.id,
                role: 'corretor',
                created_by: callerUser.id
              });

            if (roleInsertError) {
              console.error('Error creating corretor role:', roleInsertError);
              // Continue anyway - role will be added manually if needed
            }

            if (profileError) throw profileError;

            // Create corretor
            const { data: newCorretor, error: corretorError } = await supabase
              .from('corretores')
              .insert({
                ...corretorData,
                profile_id: profile.id
              })
              .select('id')
              .single();

            if (corretorError) throw corretorError;
            corretorId = newCorretor.id;
            imported++;
          }

          // Process Bairros associations
          if (bairrosText) {
            // Clear existing bairro associations
            await supabase
              .from('corretor_bairros')
              .delete()
              .eq('corretor_id', corretorId);

            // Process each bairro (comma-separated)
            const bairroNames = bairrosText.split(',').map(b => b.trim()).filter(b => b);

            for (const bairroName of bairroNames) {
              // Find or create bairro
              let { data: bairro } = await supabase
                .from('bairros')
                .select('id')
                .eq('nome', bairroName)
                .eq('cidade', cidade)
                .eq('estado', estado)
                .maybeSingle();

              if (!bairro) {
                // Create new bairro
                const { data: newBairro, error: bairroError } = await supabase
                  .from('bairros')
                  .insert({
                    nome: bairroName,
                    cidade: cidade,
                    estado: estado,
                    ativo: true
                  })
                  .select('id')
                  .single();

                if (bairroError) throw bairroError;
                bairro = newBairro;
              }

              // Associate corretor with bairro
              await supabase
                .from('corretor_bairros')
                .insert({
                  corretor_id: corretorId,
                  bairro_id: bairro.id
                });
            }
          }

          // Process Construtoras associations
          if (construtorasText) {
            // Clear existing construtora associations
            await supabase
              .from('corretor_construtoras')
              .delete()
              .eq('corretor_id', corretorId);

            // Process each construtora (comma-separated)
            const construtoraNames = construtorasText.split(',').map(c => c.trim()).filter(c => c);

            for (const construtoraName of construtoraNames) {
              // Find or create construtora
              let { data: construtora } = await supabase
                .from('construtoras')
                .select('id')
                .eq('nome', construtoraName)
                .maybeSingle();

              if (!construtora) {
                // Create new construtora
                const { data: newConstrutora, error: construtoraError } = await supabase
                  .from('construtoras')
                  .insert({
                    nome: construtoraName,
                    ativo: true
                  })
                  .select('id')
                  .single();

                if (construtoraError) throw construtoraError;
                construtora = newConstrutora;
              }

              // Associate corretor with construtora
              await supabase
                .from('corretor_construtoras')
                .insert({
                  corretor_id: corretorId,
                  construtora_id: construtora.id
                });
            }
          }

        } catch (error) {
          console.error('Error processing row:', error);
          errors++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        imported,
        updated,
        errors,
        message: `Import completed: ${imported} new, ${updated} updated, ${errors} errors`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (action === 'export') {
      // Export from Supabase to Google Sheets
      const { data: corretores, error } = await supabase
        .from('corretores')
        .select(`
          *,
          profiles!inner(first_name, last_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Format data for Google Sheets
      const headers = [
        'Nome Completo',
        'CPF',
        'Telefone',
        'Email',
        'CRECI',
        'Cidade',
        'Estado',
        'Bairros',
        'Tipo Imóvel',
        'Construtora',
        'Status',
        'Visitas Realizadas',
        'Visitas Agendadas'
      ];

      const rows = [headers];

      for (const corretor of corretores) {
        // Get visit stats
        const { data: visitStats } = await supabase
          .rpc('get_corretor_visitas_stats', { corretor_uuid: corretor.id });

        // Get bairros
        const { data: bairrosList } = await supabase
          .from('corretor_bairros')
          .select(`
              bairros!inner(nome)
            `)
          .eq('corretor_id', corretor.id);

        // Get construtoras  
        const { data: construtorasList } = await supabase
          .from('corretor_construtoras')
          .select(`
              construtoras!inner(nome)
            `)
          .eq('corretor_id', corretor.id);

        const bairrosNames = bairrosList?.map(b => b.bairros.nome).join(', ') || '';
        const construtorasNames = construtorasList?.map(c => c.construtoras.nome).join(', ') || '';
        const visitasRealizadas = visitStats?.[0]?.visitas_realizadas || 0;
        const visitasAgendadas = visitStats?.[0]?.visitas_agendadas || 0;

        rows.push([
          corretor.nome || '',
          corretor.cpf || '',
          corretor.telefone || corretor.whatsapp || '',
          corretor.email || '',
          corretor.creci || '',
          corretor.cidade || '',
          corretor.estado || '',
          bairrosNames,
          corretor.tipo_imovel || '',
          construtorasNames,
          corretor.status || '',
          visitasRealizadas.toString(),
          visitasAgendadas.toString()
        ]);
      }

      // Update Google Sheet
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW&key=${googleApiKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rows
          })
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Google Sheets update error: ${updateResponse.statusText}`);
      }

      console.log(`Exported ${rows.length - 1} corretores to Google Sheets`);

      return new Response(JSON.stringify({
        success: true,
        exported: rows.length - 1,
        message: `Successfully exported ${rows.length - 1} corretores to Google Sheets`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in Google Sheets sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);