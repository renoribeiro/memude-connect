import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Numeros {
  leads: number; qualificados: number; visitas_agendadas: number; visitas_realizadas: number; visitas_no_show: number;
  visitas_canceladas: number; visitas_futuras: number; vendas: number; vgv: number; ticket_medio: number;
  comissao_memude: number; comissao_liquida: number;
}
export interface Painel {
  de: string; ate: string; atual: Numeros; anterior: Numeros;
  origem: { fonte: string; total: number }[];
  por_dia: { dia: string; leads: number }[];
}

export function usePainelComercial(de: string, ate: string) {
  return useQuery({
    queryKey: ['painel-comercial', de, ate],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_comercial', { p_de: de, p_ate: ate });
      if (error) throw error;
      return data as unknown as Painel;
    },
  });
}

export interface EtapaFunil { rotulo: string; valor: number; daEtapa: number | null; doTotal: number }

/** Funil de cima para baixo: leads → qualificados → visitas agendadas → realizadas → vendas. */
export function funil(n: Numeros): EtapaFunil[] {
  const etapas: [string, number][] = [
    ['Leads recebidos', n.leads],
    ['Leads qualificados', n.qualificados],
    ['Visitas agendadas', n.visitas_agendadas],
    ['Visitas realizadas', n.visitas_realizadas],
    ['Vendas fechadas', n.vendas],
  ];
  return etapas.map(([rotulo, valor], i) => ({
    rotulo, valor,
    daEtapa: i === 0 ? null : etapas[i - 1][1] ? valor / etapas[i - 1][1] : 0,
    doTotal: n.leads ? valor / n.leads : 0,
  }));
}

/** Leads agrupados por semana (segunda a domingo), com variação sobre a semana anterior. */
export function porSemana(porDia: Painel['por_dia']) {
  const semanas: { rotulo: string; leads: number; variacao: number | null }[] = [];
  let atual: { ini: string; fim: string; leads: number } | null = null;
  for (const d of porDia) {
    const diaSemana = new Date(`${d.dia}T12:00:00Z`).getUTCDay(); // 0 = domingo
    if (!atual || diaSemana === 1) {
      if (atual) semanas.push({ rotulo: `${atual.ini}–${atual.fim}`, leads: atual.leads, variacao: null });
      atual = { ini: d.dia.slice(8, 10), fim: d.dia.slice(8, 10), leads: 0 };
    }
    atual.fim = d.dia.slice(8, 10);
    atual.leads += d.leads;
  }
  if (atual) semanas.push({ rotulo: `${atual.ini}–${atual.fim}`, leads: atual.leads, variacao: null });
  return semanas.map((s, i) => ({
    ...s,
    rotulo: `Sem. ${i + 1} (${s.rotulo})`,
    variacao: i > 0 && semanas[i - 1].leads ? (s.leads - semanas[i - 1].leads) / semanas[i - 1].leads : null,
  }));
}

export const CORES_ORIGEM = ['#422f91', '#e92662', '#7c6bc4', '#f27a9e', '#2f2266', '#b31d4b', '#a99fdc'];
