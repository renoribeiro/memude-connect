import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAcaoVisita, useEmpreendimentos, useConfigComercial } from '@/hooks/comercial/dados';
import { TIPOS_LOCAL } from '@/lib/comercial/constantes';
import { hojeISO, inicioVisita } from '@/lib/comercial/datas';
import { linkEmpreendimento } from '@/lib/comercial/mensagens';
import { ComboboxBusca } from './ui';
import { SeletorCorretor, type CorretorEscolhido } from './SeletorCorretor';

interface Props {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  lead: { id: string; nome: string; empreendimento_id: string | null; fonte: string | null; observacoes?: string | null };
  onAgendada?: (visitaId: string) => void;
}

export function AgendarVisitaDialog({ aberto, onOpenChange, lead, onAgendada }: Props) {
  const { data: empreendimentos = [] } = useEmpreendimentos();
  const { data: config } = useConfigComercial();
  const agendar = useAcaoVisita();
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [empId, setEmpId] = useState<string | null>(lead.empreendimento_id);
  const [local, setLocal] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [perfil, setPerfil] = useState(lead.observacoes ?? '');
  const [corretor, setCorretor] = useState<CorretorEscolhido | null>(null);
  const [tentou, setTentou] = useState(false);
  const [sugeridos, setSugeridos] = useState({ endereco: false, bairro: false, perfil: !!lead.observacoes });

  const emp = useMemo(() => empreendimentos.find((e) => e.id === empId) ?? null, [empreendimentos, empId]);

  // Sugere endereço e bairro do empreendimento sem sobrescrever o que o usuário digitou
  useEffect(() => {
    if (!emp) return;
    const trocarEndereco = !endereco || sugeridos.endereco;
    const trocarBairro = !bairro || sugeridos.bairro;
    if (trocarEndereco) setEndereco(emp.endereco ?? '');
    if (trocarBairro) setBairro(emp.bairro ?? '');
    setSugeridos((s) => ({
      ...s,
      endereco: trocarEndereco ? !!emp.endereco : s.endereco,
      bairro: trocarBairro ? !!emp.bairro : s.bairro,
    }));
    setCorretor(null);
  }, [emp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const noPassado = data && hora ? inicioVisita(data, hora).getTime() < Date.now() : false;
  const erros = {
    quando: !data || !hora ? 'Informe data e horário' : noPassado ? 'Escolha um horário no futuro' : null,
    emp: !empId ? 'Selecione o empreendimento' : null,
    local: local.trim().length < 2 ? 'Informe o local' : null,
    endereco: endereco.trim().length < 5 ? 'Informe o endereço' : null,
    bairro: bairro.trim().length < 2 ? 'Informe o bairro' : null,
    corretor: !corretor ? 'Escolha o corretor' : null,
  };
  const valido = Object.values(erros).every((e) => !e);
  const link = linkEmpreendimento(emp?.wp_post_id, config?.site_url);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!valido) return;
    const r = await agendar.mutateAsync({
      rpc: 'visita_agendar',
      sucesso: 'Visita criada · aguardando aceite do corretor',
      args: {
        p_dados: {
          lead_id: lead.id, data, hora, empreendimento_id: empId, local_nome: local.trim(), endereco: endereco.trim(),
          bairro: bairro.trim(), corretor_id: corretor!.id, perfil: perfil.trim() || null,
          score: corretor!.score, motivo_sugestao: corretor!.motivo,
        },
      },
    }).catch(() => null);
    if (r?.visita_id) {
      onOpenChange(false);
      onAgendada?.(String(r.visita_id));
    }
  };

  const erro = (k: keyof typeof erros) => tentou && erros[k] ? <p className="text-xs text-destructive">{erros[k]}</p> : null;
  const Sugestao = ({ ativo }: { ativo: boolean }) => ativo
    ? <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] font-semibold uppercase text-primary-dark"><Sparkles className="h-3 w-3" />Sugestão — confira</span>
    : null;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={salvar} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" /> Agendar visita</DialogTitle>
            <DialogDescription>
              {lead.nome} · o sistema sugere, você confirma. A visita nasce como <strong>Aguardando corretor</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="av-data">Data *</Label>
                  <Input id="av-data" type="date" min={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} aria-invalid={tentou && !!erros.quando} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="av-hora">Horário *</Label>
                  <Input id="av-hora" type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} aria-invalid={tentou && !!erros.quando} />
                </div>
                <div className="col-span-2 -mt-2">{erro('quando')}</div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="av-emp">Empreendimento *</Label>
                <ComboboxBusca id="av-emp" opcoes={empreendimentos.map((x) => ({ valor: x.id, rotulo: x.nome, detalhe: x.bairro }))}
                  valor={empId} onChange={setEmpId} invalido={tentou && !!erros.emp} />
                {erro('emp')}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer noopener" className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline">
                    Página no memude.com.br <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="av-local">Local (decorado ou stand) *</Label>
                <Input id="av-local" value={local} onChange={(e) => setLocal(e.target.value)} maxLength={120}
                  placeholder="Ex.: Decorado da torre B" aria-invalid={tentou && !!erros.local} />
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_LOCAL.map((t) => (
                    <button key={t} type="button" onClick={() => setLocal(t)}
                      className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                        local === t ? 'border-primary bg-primary/10 text-primary-dark' : 'hover:bg-muted')}>
                      {t}
                    </button>
                  ))}
                </div>
                {erro('local')}
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between"><Label htmlFor="av-end">Endereço *</Label><Sugestao ativo={sugeridos.endereco} /></div>
                <Input id="av-end" value={endereco} maxLength={300} aria-invalid={tentou && !!erros.endereco}
                  onChange={(e) => { setEndereco(e.target.value); setSugeridos((s) => ({ ...s, endereco: false })); }} />
                {erro('endereco')}
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between"><Label htmlFor="av-bairro">Bairro *</Label><Sugestao ativo={sugeridos.bairro} /></div>
                <Input id="av-bairro" value={bairro} maxLength={120} aria-invalid={tentou && !!erros.bairro}
                  onChange={(e) => { setBairro(e.target.value); setSugeridos((s) => ({ ...s, bairro: false })); }} />
                {erro('bairro')}
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between"><Label htmlFor="av-perfil">Perfil do cliente</Label><Sugestao ativo={sugeridos.perfil} /></div>
                <Textarea id="av-perfil" rows={3} maxLength={2000} value={perfil} placeholder="Renda, composição familiar, objetivo (moradia ou investimento)…"
                  onChange={(e) => { setPerfil(e.target.value); setSugeridos((s) => ({ ...s, perfil: false })); }} />
              </div>

              <p className="text-xs text-muted-foreground">Origem do lead: <strong className="text-foreground">{lead.fonte ?? '—'}</strong></p>
            </div>

            <div className="grid content-start gap-2">
              <Label>Corretor *</Label>
              <SeletorCorretor empreendimentoId={empId} data={data || null} hora={hora || null}
                valor={corretor?.id ?? null} onChange={setCorretor} />
              {erro('corretor')}
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={agendar.isPending}>
              {agendar.isPending && <Loader2 className="animate-spin" />} Criar visita e convidar corretor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
