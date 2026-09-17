import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function VisitDistributionSettings() {
 return <Card><CardHeader><CardTitle>Match integrado às visitas</CardTitle></CardHeader><CardContent className="space-y-3"><p>Todos os novos agendamentos usam o mesmo Match. O corretor informado é consultado primeiro; após recusa ou 15 minutos sem resposta, o sistema consulta o próximo.</p><p>Ordem: especialidade (tipo de imóvel e construtora), bairro/região, nota média; menos visitas realizadas desempata.</p><Link className="underline" to="/configuracoes">Configurar limite de consultas em Configurações → Automação de visitas</Link></CardContent></Card>;
}
