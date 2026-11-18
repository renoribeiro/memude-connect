import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  buscarLeadPorTelefone, type ResultadoCriarLead, useCriarLead, useEmpreendimentos, useEquipe,
} from '@/hooks/comercial/dados';
import { FONTES, STATUS_ATENDIMENTO } from '@/lib/comercial/constantes';
import { chaveTelefone, telefoneExibicao, telefoneValido } from '@/lib/comercial/telefone';
import { ComboboxBusca, StatusAtendimentoBadge } from './ui';

interface Props {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}

const VAZIO = { nome: '', telefone: '', empreendimento_id: null as string | null, fonte: '', status: 'NOVO', responsavel: '', observacoes: '' };

export function NovoLeadDialog({ aberto, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: equipe = [] } = useEquipe();
  const { data: empreendimentos = [] } = useEmpreendimentos();
  const criar = useCriarLead();
  const [form, setForm] = useState(VAZIO);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [existente, setExistente] = useState<ResultadoCriarLead['lead'] | null>(null);
  const [verificando, setVerificando] = useState(false);

  const responsaveis = useMemo(() => equipe.filter((u) => u.responsavel), [equipe]);
  const chave = chaveTelefone(form.telefone);

  useEffect(() => {
    if (aberto) {
      setForm({ ...VAZIO, responsavel: responsaveis.some((r) => r.user_id === user?.id) ? user!.id : '' });
      setTentouSalvar(false);
      setExistente(null);
    }
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checagem de duplicidade enquanto digita (pela mesma chave usada no banco)
  useEffect(() => {
    setExistente(null);
    if (!telefoneValido(form.telefone)) return;
    let ativo = true;
    setVerificando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarLeadPorTelefone(form.telefone);
        if (ativo) setExistente(r.existe ? r.lead : null);
      } finally {
        if (ativo) setVerificando(false);
      }
    }, 350);
    return () => { ativo = false; clearTimeout(t); setVerificando(false); };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const erros = {
    nome: form.nome.trim().length < 2 ? 'Informe o nome' : null,
    telefone: !telefoneValido(form.telefone) ? 'Informe DDD e número' : null,
  };
  const valido = !erros.nome && !erros.telefone && !existente;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentouSalvar(true);
    if (!valido) return;
    try {
      const r = await criar.mutateAsync({
        nome: form.nome.trim(), telefone: form.telefone, empreendimento_id: form.empreendimento_id,
        fonte: form.fonte || null, status_atendimento: form.status, responsavel_id: form.responsavel || null,
        observacoes: form.observacoes.trim() || null,
      });
      if (r.duplicado) {
        setExistente(r.lead);
        return;
      }
      onOpenChange(false);
      toast.success('Lead cadastrado', {
        description: `${r.lead.nome} · ${r.lead.telefone_exibicao}`,
        action: { label: 'Abrir ficha', onClick: () => navigate(`/leads/${r.lead_id}`) },
      });
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível cadastrar o lead');
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={salvar} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Novo lead</DialogTitle>
            <DialogDescription>O telefone é a chave do lead: o mesmo número nunca gera dois cadastros.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nl-telefone">Telefone (WhatsApp) *</Label>
              <div className="relative">
                <Input
                  id="nl-telefone" inputMode="tel" autoComplete="off" autoFocus placeholder="(85) 9 9999-9999"
                  value={form.telefone} onChange={(e) => set('telefone', e.target.value)}
                  aria-invalid={tentouSalvar && !!erros.telefone} aria-describedby="nl-telefone-ajuda"
                />
                {verificando && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <p id="nl-telefone-ajuda" className="text-xs text-muted-foreground">
                {tentouSalvar && erros.telefone
                  ? <span className="text-destructive">{erros.telefone}</span>
                  : telefoneValido(form.telefone) ? `Será salvo como ${telefoneExibicao(form.telefone)}` : 'Aceita qualquer formato: com ou sem 55, DDD e o 9.'}
              </p>
            </div>

            {existente && (
              <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-amber-900">Lead já cadastrado</p>
                  <p className="truncate text-amber-900/80">{existente.nome} · {existente.telefone_exibicao}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusAtendimentoBadge status={existente.status_atendimento} />
                    {existente.responsavel && <span className="text-xs text-amber-900/70">Responsável: {existente.responsavel}</span>}
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" className="shrink-0 bg-card"
                  onClick={() => { onOpenChange(false); navigate(`/leads/${existente.id}`); }}>
                  Abrir ficha <ArrowRight />
                </Button>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="nl-nome">Nome *</Label>
              <Input id="nl-nome" autoComplete="off" value={form.nome} onChange={(e) => set('nome', e.target.value)}
                aria-invalid={tentouSalvar && !!erros.nome} maxLength={120} />
              {tentouSalvar && erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nl-emp">Empreendimento</Label>
              <ComboboxBusca id="nl-emp" placeholder="Selecione o empreendimento" permitirLimpar
                opcoes={empreendimentos.map((e) => ({ valor: e.id, rotulo: e.nome, detalhe: e.bairro }))}
                valor={form.empreendimento_id} onChange={(v) => set('empreendimento_id', v)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Fonte</Label>
                <Select value={form.fonte} onValueChange={(v) => set('fonte', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{FONTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_ATENDIMENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Responsável</Label>
              <Select value={form.responsavel || 'nenhum'} onValueChange={(v) => set('responsavel', v === 'nenhum' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem responsável</SelectItem>
                  {responsaveis.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nl-obs">Observação</Label>
              <Textarea id="nl-obs" rows={3} maxLength={4000} value={form.observacoes}
                onChange={(e) => set('observacoes', e.target.value)} placeholder="Perfil, renda, interesse, melhor horário…" />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={criar.isPending || !!existente}>
              {criar.isPending && <Loader2 className="animate-spin" />} Cadastrar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
