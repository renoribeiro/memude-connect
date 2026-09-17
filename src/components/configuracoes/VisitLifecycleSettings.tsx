import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitLifecycle } from '@/lib/visitLifecycle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Config { enabled: boolean; intake_enabled: boolean; closer_phone: string; group_jid: string; instance_id: string; updated_at: string }
interface SettingsData { config: Config; instances: { id: string; instance_name: string }[]; sheets_configured: boolean }

function SettingsForm({ data }: { data: SettingsData }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(data.config);
  const [saving, setSaving] = useState(false);
  const groups = useQuery({ queryKey: ['visit-groups', config.instance_id], queryFn: () => visitLifecycle<{ groups: { id: string; name: string }[] }>('groups', { instance_id: config.instance_id }), enabled: Boolean(config.instance_id), retry: false });
  async function save() {
    setSaving(true);
    try { await visitLifecycle('save_settings', { config }); await queryClient.invalidateQueries({ queryKey: ['visit-lifecycle-settings'] }); toast.success('Configurações de visitas salvas'); }
    catch (error) { toast.error((error as Error).message); } finally { setSaving(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Lembretes na véspera e 2h antes. Pergunta ao corretor 1h após o horário agendado; alerta após 2h sem resposta. Mensagens regulares das 7h às 20h (Brasília); urgências a qualquer hora.</p>
    <div><Label htmlFor="visit-closer">WhatsApp do Closer</Label><Input id="visit-closer" value={config.closer_phone} onChange={e => setConfig({ ...config, closer_phone: e.target.value })} placeholder="55 + DDD + número" /></div>
    <div><Label htmlFor="visit-instance">Instância WhatsApp</Label><select id="visit-instance" className="w-full border rounded-md p-2 bg-background" value={config.instance_id || ''} onChange={e => setConfig({ ...config, instance_id: e.target.value, group_jid: '' })}><option value="">Selecione</option>{data.instances.map(i => <option key={i.id} value={i.id}>{i.instance_name}</option>)}</select></div>
    <div><Label htmlFor="visit-group">Grupo da empresa</Label><select id="visit-group" className="w-full border rounded-md p-2 bg-background" value={config.group_jid} disabled={!config.instance_id || groups.isFetching} onChange={e => setConfig({ ...config, group_jid: e.target.value })}><option value="">Selecione</option>{groups.data?.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>{groups.error && <p role="alert" className="text-destructive text-sm">{groups.error.message}</p>}</div>
    <p className="text-sm">Planilha: <a className="underline" href="https://docs.google.com/spreadsheets/d/1Oycr_RxrO0syRw0n4IdNWfmPVfJPVfXkqbI8eKjmapI/edit#gid=490283298" target="_blank" rel="noreferrer">CRM MeMude 2025 — VISITAS</a></p>
    {!data.sheets_configured && <p role="status" className="rounded-md bg-amber-50 text-amber-900 p-3 text-sm">Integração Google pendente de configuração no servidor. Salve os contatos agora; a ativação será liberada após configurar o acesso à planilha.</p>}
    <div className="flex items-center gap-2"><Checkbox id="visit-enabled" checked={config.enabled} onCheckedChange={v => setConfig({ ...config, enabled: v === true })} /><Label htmlFor="visit-enabled">Ativar automação para novos agendamentos</Label></div>
    <div className="border rounded-md p-3 space-y-2"><div className="flex items-center gap-2"><Checkbox id="intake-enabled" checked={config.intake_enabled === true} onCheckedChange={v => setConfig({...config,intake_enabled:v===true})}/><Label htmlFor="intake-enabled">Permitir AGENDAR VISITA pelo grupo</Label></div><p className="text-sm text-muted-foreground">Qualquer participante do grupo selecionado pode solicitar. Dados inequívocos geram cadastro automático. Duração: 60 minutos, com 30 minutos de intervalo; conflitos exigem decisão do Closer. Respostas às solicitações podem sair a qualquer hora. Use um número pessoal diferente do número conectado à automação.</p></div>
    <p className="text-sm text-muted-foreground">Pausar interrompe os envios e mantém o histórico e as pendências. Visitas antigas não recebem mensagens retroativas ao ativar.</p>
    <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar automação de visitas'}</Button>
  </div>;
}

export function VisitLifecycleSettings() {
  const query = useQuery({ queryKey: ['visit-lifecycle-settings'], queryFn: () => visitLifecycle<SettingsData>('settings'), retry: false });
  return <Card><CardHeader><CardTitle>Lembretes e acompanhamento de visitas</CardTitle></CardHeader><CardContent>
    {query.isLoading ? <p>Carregando configurações…</p> : query.error ? <div role="alert"><p>Não foi possível carregar a automação: {query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : query.data ? <SettingsForm key={query.data.config.updated_at} data={query.data} /> : null}
  </CardContent></Card>;
}
