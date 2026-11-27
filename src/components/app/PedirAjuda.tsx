import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Handshake, HelpCircle, LifeBuoy, Loader2, MessageCircleQuestion, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useListaConversas } from '@/hooks/conversas/dados';
import { nomeDaConversa } from '@/lib/conversas/formato';
import { mensagemErro } from '@/lib/conversas/servidor';

type Assunto = 'fechamento' | 'comercial' | 'duvida';
const ASSUNTOS: { valor: Assunto; titulo: string; texto: string; icone: typeof Handshake }[] = [
  { valor: 'fechamento', titulo: 'Ajuda no fechamento', texto: 'Proposta, negociação, condição para fechar', icone: Handshake },
  { valor: 'comercial', titulo: 'Suporte comercial', texto: 'Tabela, documentação, construtora, simulação', icone: LifeBuoy },
  { valor: 'duvida', titulo: 'Tirar uma dúvida', texto: 'Qualquer outra coisa', icone: MessageCircleQuestion },
];

/** Gaveta "Pedir ajuda": avisa o closer (alerta no Connect + notificação no celular dele). */
export function PedirAjuda({ aberto, aoFechar, conversaId }: { aberto: boolean; aoFechar: () => void; conversaId?: string | null }) {
  const { data: conversas = [] } = useListaConversas('minhas', '');
  const [assunto, setAssunto] = useState<Assunto | null>(null);
  const [cliente, setCliente] = useState<string>('');
  const [texto, setTexto] = useState('');
  const [agora, setAgora] = useState(false);

  useEffect(() => {
    if (aberto) { setCliente(conversaId ?? ''); return; }
    setAssunto(null); setTexto(''); setAgora(false);
  }, [aberto, conversaId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('corretor_pedir_ajuda', {
        p_assunto: assunto!, p_texto: texto.trim() || null, p_conversa: cliente || null, p_urgente: agora,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Pedido enviado. O closer foi avisado e vai falar com você.'); aoFechar(); },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  return (
    <Drawer open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DrawerContent className="tema-memude max-h-[92dvh] bg-card">
        <div className="overflow-y-auto px-5 pb-6 pt-2">
          <DrawerTitle className="text-xl">Pedir ajuda ao closer</DrawerTitle>
          <DrawerDescription className="mt-1 text-[14px]">O closer da MeMude recebe na hora e fala com você.</DrawerDescription>

          <fieldset className="mt-4 space-y-2">
            <legend className="mb-2 text-[13px] font-bold text-muted-foreground">Com o que você precisa de ajuda?</legend>
            {ASSUNTOS.map((a) => (
              <button key={a.valor} type="button" onClick={() => setAssunto(a.valor)} aria-pressed={assunto === a.valor}
                className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.99]',
                  assunto === a.valor ? 'border-primary bg-mm-lilas' : 'border-mm-borda-suave bg-card')}>
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', assunto === a.valor ? 'bg-primary text-white' : 'bg-muted text-primary')}>
                  <a.icone className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{a.titulo}</span>
                  <span className="block text-[13px] text-muted-foreground">{a.texto}</span>
                </span>
              </button>
            ))}
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">Sobre qual cliente? (opcional)</span>
            <select value={cliente} onChange={(e) => setCliente(e.target.value)}
              className="h-12 w-full rounded-xl border border-mm-campo bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <option value="">Nenhum em especial</option>
              {conversas.map((c) => <option key={c.id} value={c.id}>{nomeDaConversa(c)}</option>)}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">Conte rapidinho (opcional)</span>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 600))} rows={3}
              placeholder="Ex.: cliente quer fechar hoje, mas pediu desconto na entrada" className="rounded-xl text-[15px]" />
          </label>

          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted p-3.5">
            <span>
              <span className="block text-[15px] font-bold">Estou com o cliente agora</span>
              <span className="block text-[13px] text-muted-foreground">O closer vê como urgente</span>
            </span>
            <Switch checked={agora} onCheckedChange={setAgora} aria-label="Estou com o cliente agora" />
          </label>

          <Button variant="acao" className="mt-5 h-14 w-full text-[16px]" disabled={!assunto || enviar.isPending} onClick={() => enviar.mutate()}>
            {enviar.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Pedir ajuda
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Botão flutuante, sempre à mão (fica acima da barra de baixo). */
export function BotaoAjuda({ aoTocar, className }: { aoTocar: () => void; className?: string }) {
  return (
    <button type="button" onClick={aoTocar} aria-label="Pedir ajuda ao closer"
      className={cn('flex h-12 items-center gap-2 rounded-full bg-mm-roxo pl-3.5 pr-4 text-[14px] font-bold text-white shadow-lg shadow-mm-roxo/30 transition active:scale-95',
        className)}>
      <HelpCircle className="h-5 w-5" aria-hidden /> Ajuda
    </button>
  );
}
