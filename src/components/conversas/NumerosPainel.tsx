import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MoreVertical, Plus, QrCode, RefreshCw, Smartphone, Star, Unplug, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoVazio } from '@/components/comercial/ui';
import { haQuanto, telefoneLegivel } from '@/lib/conversas/formato';
import { chamarFuncao, mensagemErro } from '@/lib/conversas/servidor';
import type { Numero } from '@/lib/conversas/tipos';
import { useAcaoNumero, useNumeros } from '@/hooks/conversas/dados';

type RespostaNumero = { numero?: Numero; qr?: string };

const STATUS: Record<string, { rotulo: string; cor: string; icone: typeof Wifi }> = {
  aberto: { rotulo: 'Conectado', cor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950', icone: Wifi },
  conectando: { rotulo: 'Aguardando QR code', cor: 'text-amber-700 bg-amber-50 dark:bg-amber-950', icone: QrCode },
  desconectado: { rotulo: 'Desconectado', cor: 'text-rose-600 bg-rose-50 dark:bg-rose-950', icone: WifiOff },
};

/** Janela do QR code: renova sozinho a cada 30 s e fecha quando o celular conecta. */
function ConectarDialog({ numero, qrInicial, aoFechar }: { numero: Numero; qrInicial: string | null; aoFechar: () => void }) {
  const [qr, setQr] = useState<string | null>(qrInicial);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const qc = useQueryClient();

  useEffect(() => {
    let vivo = true;
    const buscarQr = async () => {
      let r: RespostaNumero | null = null;
      try {
        r = await chamarFuncao<RespostaNumero>('conversas-numeros', { acao: 'qr', id: numero.id });
      } catch (e) {
        if (vivo) setErro(mensagemErro(e));
        return;
      }
      if (!vivo || !r) return;
      setErro(null);
      if (r.qr) setQr(r.qr);
      else if (r.numero?.status === 'aberto') setConectado(true);
    };
    if (!qrInicial) buscarQr();
    const renovar = setInterval(buscarQr, 30_000);
    const conferir = setInterval(async () => {
      const r = await chamarFuncao<RespostaNumero>('conversas-numeros', { acao: 'estado', id: numero.id }).catch(() => null);
      if (vivo && r?.numero?.status === 'aberto') setConectado(true);
    }, 4000);
    return () => { vivo = false; clearInterval(renovar); clearInterval(conferir); };
  }, [numero.id, qrInicial, tentativa]);

  useEffect(() => {
    if (!conectado) return;
    qc.invalidateQueries({ queryKey: ['conversas', 'numeros'] });
    const t = setTimeout(aoFechar, 1800);
    return () => clearTimeout(t);
  }, [conectado, aoFechar, qc]);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar “{numero.nome}”</DialogTitle>
          <DialogDescription>No celular do número: WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo.</DialogDescription>
        </DialogHeader>
        <div className="flex aspect-square w-full items-center justify-center rounded-xl border bg-white p-4">
          {conectado ? (
            <div className="text-center text-emerald-600">
              <CheckCircle2 className="mx-auto h-16 w-16" />
              <p className="mt-2 font-semibold">Conectado!</p>
            </div>
          ) : erro && !qr ? (
            <div className="px-6 text-center text-sm text-zinc-700">
              <p className="font-semibold text-rose-600">Não foi possível gerar o QR code</p>
              <p className="mt-1">{erro}</p>
              <Button className="mt-4" variant="outline" onClick={() => { setErro(null); setTentativa((t) => t + 1); }}>Tentar de novo</Button>
            </div>
          ) : qr ? (
            <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR code para conectar o WhatsApp" className="h-full w-full object-contain" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">O código se renova sozinho. Use de preferência um chip dedicado à MeMude.</p>
      </DialogContent>
    </Dialog>
  );
}

function NovoNumeroDialog({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (n: Numero, qr: string | null) => void }) {
  const acao = useAcaoNumero();
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<'principal' | 'backup'>('principal');
  const criar = () => acao.mutate({ acao: 'criar', nome: nome.trim(), papel }, {
    onSuccess: (r) => { if (r.numero) aoCriar(r.numero, r.qr ?? null); setNome(''); },
  });
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo número de WhatsApp</DialogTitle>
          <DialogDescription>Cria uma conexão nova no servidor da MeMude. Os números que já existem (avisos e visitas) não são alterados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome-numero">Nome</Label>
            <Input id="nome-numero" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atendimento MeMude" maxLength={60} autoFocus />
          </div>
          <RadioGroup value={papel} onValueChange={(v) => setPapel(v as 'principal' | 'backup')} className="grid grid-cols-2 gap-2">
            {[
              { v: 'principal', t: 'Principal', d: 'Recebe e inicia as conversas' },
              { v: 'backup', t: 'Reserva', d: 'Fica pronto caso o principal caia' },
            ].map((o) => (
              <Label key={o.v} htmlFor={`papel-${o.v}`} className={cn('cursor-pointer rounded-xl border p-3', papel === o.v && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                <span className="flex items-center gap-2 font-medium"><RadioGroupItem id={`papel-${o.v}`} value={o.v} />{o.t}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{o.d}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={criar} disabled={nome.trim().length < 2 || acao.isPending}>
            {acao.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Criar e mostrar QR code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin: números da MeMude que atendem os clientes (Evolution). */
export function NumerosPainel() {
  const { data: numeros = [], isLoading } = useNumeros();
  const acao = useAcaoNumero();
  const [novo, setNovo] = useState(false);
  const [conectando, setConectando] = useState<{ n: Numero; qr: string | null } | null>(null);
  const [confirmar, setConfirmar] = useState<{ n: Numero; tipo: 'desconectar' | 'desativar' } | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Números da MeMude</h2>
          <p className="text-sm text-muted-foreground">O cliente sempre fala com o mesmo número; quem atende muda por dentro.</p>
        </div>
        <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo número</Button>
      </div>

      {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : !numeros.length ? (
        <EstadoVazio icone={Smartphone} titulo="Nenhum número conectado" descricao="Conecte o chip da MeMude para começar a receber as conversas aqui e no app dos corretores."
          acao={<Button onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Conectar o primeiro número</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {numeros.map((n) => {
            const st = STATUS[n.status] ?? STATUS.desconectado;
            const Icone = st.icone;
            return (
              <div key={n.id} className={cn('rounded-xl border bg-card p-4 shadow-sm', !n.ativo && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <span className={cn('rounded-full p-2', st.cor)}><Icone className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {n.nome}
                      {n.papel === 'principal' && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Principal" />}
                    </p>
                    <p className="text-sm text-muted-foreground">{n.telefone ? telefoneLegivel(n.telefone) : 'Telefone aparece ao conectar'}</p>
                    <p className={cn('mt-1 text-xs font-medium', st.cor.split(' ')[0])}>
                      {n.ativo ? st.rotulo : 'Desativado'}{n.ultimo_evento_em ? ` · ${haQuanto(n.ultimo_evento_em)}` : ''}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Opções de ${n.nome}`}><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => acao.mutate({ acao: 'estado', id: n.id })}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar status</DropdownMenuItem>
                      {n.papel !== 'principal' && <DropdownMenuItem onClick={() => acao.mutate({ acao: 'editar', id: n.id, papel: 'principal' })}><Star className="mr-2 h-4 w-4" /> Tornar principal</DropdownMenuItem>}
                      {n.papel === 'principal' && <DropdownMenuItem onClick={() => acao.mutate({ acao: 'editar', id: n.id, papel: 'backup' })}>Tornar reserva</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => acao.mutate({ acao: 'webhook', id: n.id })}>Reaplicar webhook</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {n.status === 'aberto' && <DropdownMenuItem className="text-rose-600" onClick={() => setConfirmar({ n, tipo: 'desconectar' })}><Unplug className="mr-2 h-4 w-4" /> Desconectar aparelho</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => (n.ativo ? setConfirmar({ n, tipo: 'desativar' }) : acao.mutate({ acao: 'editar', id: n.id, ativo: true }))}>{n.ativo ? 'Desativar' : 'Reativar'}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {n.ativo && n.status !== 'aberto' && (
                  <Button className="mt-3 w-full" variant={n.status === 'desconectado' ? 'default' : 'outline'} onClick={() => setConectando({ n, qr: null })}>
                    <QrCode className="h-4 w-4" /> {n.status === 'desconectado' ? 'Reconectar com QR code' : 'Mostrar QR code'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Boas práticas para não bloquear o número</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Sem disparo em massa: o Connect limita 40 conversas novas por dia e 40 mensagens por minuto em cada número.</li>
          <li>Deixe um número reserva conectado. Se o principal cair, o cliente que escrever no reserva continua com o mesmo atendente.</li>
          <li>Não use o chip em outro WhatsApp Web ao mesmo tempo.</li>
        </ul>
      </div>

      <NovoNumeroDialog aberto={novo} aoFechar={() => setNovo(false)} aoCriar={(n, qr) => { setNovo(false); setConectando({ n, qr }); }} />
      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.tipo === 'desconectar' ? `Desconectar “${confirmar?.n.nome}”?` : `Desativar “${confirmar?.n.nome}”?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.tipo === 'desconectar'
                ? 'O WhatsApp sai deste aparelho. Ninguém consegue responder por este número até ler o QR code de novo.'
                : 'O número para de ser usado nas conversas. As conversas antigas continuam salvas e você pode reativar depois.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!confirmar) return;
              acao.mutate(confirmar.tipo === 'desconectar' ? { acao: 'desconectar', id: confirmar.n.id } : { acao: 'editar', id: confirmar.n.id, ativo: false });
              setConfirmar(null);
            }}>{confirmar?.tipo === 'desconectar' ? 'Desconectar' : 'Desativar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {conectando && <ConectarDialog numero={conectando.n} qrInicial={conectando.qr} aoFechar={() => setConectando(null)} />}
    </div>
  );
}
