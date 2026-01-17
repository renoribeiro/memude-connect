import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { format, data, title, period } = await req.json();

    console.log('Exporting report:', { format, title, period });

    if (format === 'csv') {
      // Generate CSV
      const csvContent = generateCSV(data);
      
      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${title}_${period}.csv"`,
        },
      });
    }

    if (format === 'json') {
      // Generate JSON
      const jsonContent = JSON.stringify({
        title,
        period,
        generated_at: new Date().toISOString(),
        data
      }, null, 2);

      return new Response(jsonContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${title}_${period}.json"`,
        },
      });
    }

    if (format === 'excel') {
      // For Excel, we'll return structured data that can be processed on the frontend
      const excelData = {
        title,
        period,
        sheets: [
          {
            name: 'Resumo',
            data: data.summary || []
          },
          {
            name: 'Dados Detalhados',  
            data: data.detailed || []
          }
        ]
      };

      return new Response(JSON.stringify(excelData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Export-Format': 'excel'
        },
      });
    }

    throw new Error('Formato de export não suportado');

  } catch (error) {
    console.error('Error in export-reports function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateCSV(data: any): string {
  if (!data || !Array.isArray(data)) {
    return 'No data available';
  }

  if (data.length === 0) {
    return 'No data available';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}