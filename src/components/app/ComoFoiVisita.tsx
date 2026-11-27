import { useEffect, useState } from 'react';
import { CalendarX2, Flame, Hourglass, Loader2, Search, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useRegistrarVisita, type ResultadoVisita, type VisitaParaContar } from '@/hooks/conversas/app';
import { quandoCurto } from './Chamado';

const OPCOES: { valor: ResultadoVisita; titulo: string; texto: string; icone: typeof Flame; motivo?: boolean }[] = [
  { valor: 'vai_comprar', titulo: 'Gostou e quer comprar', texto: 'O closer da MeMude é avisado para te ajudar a fechar.', icone: Flame },
  { valor: 'pensando', titulo: 'Gostou e está pensando', texto: 'O cliente continua com você.', icone: Hourglass },
  { valor: 'nao_gostou', titulo: 'Não gostou do imóvel', texto: 'A equipe da MeMude assume e procura outra opção.', icone: ThumbsDown, motivo: true },
  { valor: 'quer_outros', titulo: 'Quer ver outros imóveis', texto: 'A equipe da MeMude mostra outras opções para ele.', icone: Search, motivo: true },
  { valor: 'no_show', titulo: 'Não compareceu', texto: 'A equipe da MeMude remarca com o cliente.', icone: CalendarX2 },
];

const nomeLead = (v: VisitaParaContar) => (v.leads as { nome?: string } | null)?.nome ?? 'Cliente';
const nomeEmp = (v: VisitaParaContar) => (v.empreendimentos as { nome?: string } | null)?.nome ?? 'Empreendimento';

/** Depois da visita, o corretor conta como foi em um toque; o cliente segue o caminho certo sozinho. */
export function ComoFoiVisita({ visita, aberto, aoFechar, obrigatorio }: { visita: VisitaParaContar | null; aberto: boolean; aoFechar: () => void; obrigatorio?: boolean }) {
  const registrar = useRegistrarVisita();
  const [escolha, setEscolha] = useState<ResultadoVisita | null>(null);
  const [motivo, setMotivo] = useState('');
  useEffect(() => { setEscolha(null); setMotivo(''); }, [visita?.id]);

  const opcao = OPCOES.find((o) => o.valor === escolha);
  // O retorno escrito é obrigatório em todos os casos: é ele que o closer e a equipe leem no perfil do cliente
  const faltaMotivo = motivo.trim().length < 10;
  const enviar = () => {
    if (!visita || !escolha || faltaMotivo) return;
    registrar.mutate({ visita: visita.id, resultado: escolha, observacao: motivo }, { onSuccess: aoFechar });
  };

  return (
    <Drawer open={aberto} dismissible={!obrigatorio} onOpenChange={(v) => !v && !obrigatorio && aoFechar()}>
      <DrawerContent className="tema-memude max-h-[92dvh] bg-card">
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {obrigatorio && (
            <p className="mb-2 rounded-xl bg-mm-alerta-fundo px-3 py-2 text-[13px] font-semibold text-mm-alerta">Antes de continuar, conte para o closer como foi esta visita.</p>
          )}
          <DrawerTitle className="text-xl font-extrabold tracking-[-0.01em]">Como foi a visita?</DrawerTitle>
          {visita && (
            <DrawerDescription className="mt-0.5 text-sm">
              {nomeLead(visita)} · {nomeEmp(visita)} · {quandoCurto(visita.data_visita, String(visita.horario_visita))}
            </DrawerDescription>
          )}
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Resultado da visita">
            {OPCOES.map((o) => (
              <button key={o.valor} type="button" role="radio" aria-checked={escolha === o.valor} onClick={() => setEscolha(o.valor)}
                className={cn('flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]',
                  escolha === o.valor ? 'border-primary bg-mm-lilas' : 'border-mm-borda-suave bg-card')}>
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  escolha === o.valor ? 'bg-primary text-white' : 'bg-mm-lilas text-primary')}>
                  <o.icone className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{o.titulo}</span>
                  <span className="block text-[13px] text-muted-foreground">{o.texto}</span>
                </span>
              </button>
            ))}
          </div>
          {escolha && (
            <div className="mt-4 space-y-1.5">
              <label htmlFor="como-foi-motivo" className="text-sm font-bold">
                {opcao?.motivo ? 'O que ele achou? *' : escolha === 'no_show' ? 'O que aconteceu? *' : 'Conte para o closer como foi *'}
              </label>
              <Textarea id="como-foi-motivo" rows={3} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="text-base"
                placeholder={opcao?.motivo ? 'Ex.: achou a planta pequena, quer 3 quartos e mais perto do trabalho' : escolha === 'no_show' ? 'Ex.: esperei 30 min, liguei e não atendeu' : 'Ex.: gostou da área de lazer, vai conversar com a esposa e responde até sexta'} />
              <p className={cn('text-xs', faltaMotivo && motivo.trim() ? 'text-mm-rosa-texto' : 'text-muted-foreground')}>
                {faltaMotivo ? 'Escreva pelo menos uma frase. ' : ''}O closer recebe na hora e isso fica no perfil do cliente.
              </p>
            </div>
          )}
          <Button variant="acao" size="lg" className="mt-5 h-14 w-full rounded-full text-lg font-extrabold"
            disabled={!escolha || faltaMotivo || registrar.isPending} onClick={enviar}>
            {registrar.isPending && <Loader2 className="h-5 w-5 animate-spin" />} Enviar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
