import {
  Activity, BarChart3, Bot, Building2, Calendar, CalendarDays, DollarSign, Handshake, Headset, Home, Kanban, ListChecks,
  MessageSquare, MessagesSquare, RefreshCw, Smartphone, Send, Settings, SlidersHorizontal, TrendingUp, UserCheck, UserCog, Users, Wrench, type LucideIcon,
} from 'lucide-react';

export type Acesso = 'admin' | 'comercial';

export interface ItemNav { nome: string; href: string; icone: LucideIcon; acesso: Acesso }
export interface GrupoNav { nome: string; icone: LucideIcon; itens: ItemNav[] }
export type EntradaNav = ItemNav | GrupoNav;

export const ehGrupo = (e: EntradaNav): e is GrupoNav => 'itens' in e;

/** Menu da equipe interna, agrupado por função (SDR, closer, gestão). */
export const NAV_EQUIPE: EntradaNav[] = [
  { nome: 'Hoje', href: '/hoje', icone: ListChecks, acesso: 'comercial' },
  { nome: 'Conversas', href: '/conversas', icone: MessagesSquare, acesso: 'comercial' },
  { nome: 'Dashboard', href: '/dashboard', icone: Home, acesso: 'comercial' },
  { nome: 'Agenda', href: '/agenda', icone: CalendarDays, acesso: 'comercial' },
  { nome: 'CRM', href: '/crm', icone: Kanban, acesso: 'comercial' },
  {
    nome: 'SDR', icone: Headset, itens: [
      { nome: 'Leads', href: '/leads', icone: Users, acesso: 'comercial' },
      { nome: 'Visitas', href: '/visitas', icone: Calendar, acesso: 'comercial' },
    ],
  },
  {
    nome: 'Closer', icone: Handshake, itens: [
      { nome: 'Corretores', href: '/corretores', icone: UserCheck, acesso: 'comercial' },
      { nome: 'Vendas', href: '/vendas', icone: DollarSign, acesso: 'comercial' },
      { nome: 'Visitas', href: '/visitas', icone: Calendar, acesso: 'comercial' },
    ],
  },
  { nome: 'Empreendimentos', href: '/empreendimentos', icone: Building2, acesso: 'comercial' },
  { nome: 'Gestão de Usuários', href: '/admin/users', icone: UserCog, acesso: 'admin' },
  {
    nome: 'Relatórios', icone: BarChart3, itens: [
      { nome: 'Visão geral', href: '/relatorios', icone: BarChart3, acesso: 'admin' },
      { nome: 'Analytics', href: '/admin/analytics', icone: TrendingUp, acesso: 'admin' },
      { nome: 'Envios automáticos', href: '/relatorios?aba=automaticos', icone: Send, acesso: 'admin' },
    ],
  },
  {
    nome: 'Configurações', icone: Settings, itens: [
      { nome: 'Agentes de IA', href: '/admin/ai-agents', icone: Bot, acesso: 'admin' },
      { nome: 'Monitoramento', href: '/admin/monitoring', icone: Activity, acesso: 'admin' },
      { nome: 'Sincronização WP', href: '/sincronizacao-wordpress', icone: RefreshCw, acesso: 'admin' },
      { nome: 'Ajustes comerciais', href: '/comercial/ajustes', icone: SlidersHorizontal, acesso: 'admin' },
      { nome: 'Comunicações', href: '/comunicacoes', icone: MessageSquare, acesso: 'admin' },
      { nome: 'Configurações gerais', href: '/configuracoes', icone: Wrench, acesso: 'admin' },
    ],
  },
];

export const NAV_CORRETOR: ItemNav[] = [
  { nome: 'App do corretor', href: '/app', icone: Smartphone, acesso: 'comercial' },
  { nome: 'Dashboard', href: '/', icone: Home, acesso: 'comercial' },
  { nome: 'Meus Leads', href: '/meus-leads', icone: Users, acesso: 'comercial' },
  { nome: 'Minhas Visitas', href: '/minhas-visitas', icone: Calendar, acesso: 'comercial' },
  { nome: 'Minhas Comissões', href: '/minhas-comissoes', icone: DollarSign, acesso: 'comercial' },
  { nome: 'Meu Perfil', href: '/perfil', icone: UserCheck, acesso: 'comercial' },
];

/** Remove o que o papel não pode abrir; grupos vazios somem, grupos com um item viram item solto. */
export function filtrarNav(nav: EntradaNav[], admin: boolean): EntradaNav[] {
  const pode = (i: ItemNav) => admin || i.acesso === 'comercial';
  return nav.flatMap((e): EntradaNav[] => {
    if (!ehGrupo(e)) return pode(e) ? [e] : [];
    const itens = e.itens.filter(pode);
    if (!itens.length) return [];
    return itens.length === 1 ? [itens[0]] : [{ ...e, itens }];
  });
}

// Abas que têm link próprio no menu (ex.: /relatorios?aba=automaticos).
const ABAS_NO_MENU = new Set(
  NAV_EQUIPE.flatMap((e) => (ehGrupo(e) ? e.itens : [e])).map((i) => i.href).filter((h) => h.includes('?aba=')),
);

/** Rota ativa: considera subrotas (/leads/123) e a aba (?aba=) quando o link aponta para uma. */
export function rotaAtiva(href: string, pathname: string, search: string): boolean {
  const [caminho, query] = href.split('?');
  if (caminho === '/') return pathname === '/';
  if (pathname !== caminho && !pathname.startsWith(`${caminho}/`)) return false;
  const aba = new URLSearchParams(query ?? '').get('aba');
  const abaAtual = new URLSearchParams(search).get('aba');
  if (aba) return aba === abaAtual;
  // Sem aba no link: não acende junto com o item da aba que tem link próprio.
  return !abaAtual || !ABAS_NO_MENU.has(`${caminho}?aba=${abaAtual}`);
}

export const NAV_CLIENTE: ItemNav[] = [
  { nome: 'Dashboard', href: '/', icone: Home, acesso: 'comercial' },
];
