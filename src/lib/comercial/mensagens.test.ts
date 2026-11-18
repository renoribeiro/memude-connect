import { describe, expect, it } from 'vitest';
import { linkMensagem, momentosLiberados, renderizar } from './mensagens';

const msg2a = `⚠ *AGENDAMENTO DE VISITA* ⚠

*Empreendimento:* [EMPREENDIMENTO]
*Acessar o empreendimento:* [LINK DO EMPREENDIMENTO]

👤 Cliente: [NOME DO CLIENTE]
🏠 Perfil: [PERFIL DO CLIENTE]

📅 *Data:* [DATA]
⏰ *Horário:* [HORÁRIO]
📍 *Local:* [LOCAL]`;

describe('renderização das mensagens', () => {
  const dados = {
    data: '2026-11-20', hora: '14:30:00', localNome: 'Decorado', endereco: 'Av. Washington Soares, 100',
    bairro: 'Edson Queiroz', empreendimento: 'Vista Costeira', wpPostId: 4321, cliente: 'Ana Souza',
    perfil: '', corretor: 'Ricardo Lima', origem: 'Meta',
  };

  it('substitui as variáveis e preserva emojis, asteriscos e quebras de linha', () => {
    const texto = renderizar(msg2a, dados);
    expect(texto).toContain('⚠ *AGENDAMENTO DE VISITA* ⚠\n\n*Empreendimento:* Vista Costeira');
    expect(texto).toContain('*Acessar o empreendimento:* https://memude.com.br/?p=4321');
    expect(texto).toContain('📅 *Data:* 20/11/2026');
    expect(texto).toContain('⏰ *Horário:* 14:30');
    expect(texto).toContain('📍 *Local:* Decorado – Av. Washington Soares, 100 – Edson Queiroz');
  });

  it('campo opcional vazio vira "—"', () => {
    expect(renderizar(msg2a, dados)).toContain('🏠 Perfil: —');
    expect(renderizar('[LINK DO EMPREENDIMENTO]', { ...dados, wpPostId: null })).toBe('—');
  });

  it('grupo só copia; cliente e corretor abrem a conversa certa', () => {
    const tel = { cliente: '(85) 98888-7777', corretor: '85 99999-0000' };
    expect(linkMensagem('grupo', 'x', tel)).toBeNull();
    expect(linkMensagem('cliente', 'oi', tel)).toBe('https://wa.me/5585988887777?text=oi');
    expect(linkMensagem('corretor', 'oi', tel)).toBe('https://wa.me/5585999990000?text=oi');
  });
});

describe('momentos liberados por etapa', () => {
  it('na criação só libera MSG 1, 2 e 2A', () => {
    expect(momentosLiberados({ status: 'aguardando_corretor', corretorAceitou: false, tarefas: ['aceite_corretor'], temVisitaAnterior: false }))
      .toEqual(['criacao']);
  });

  it('visita para amanhã não libera D-2; visita de hoje só D0', () => {
    expect(momentosLiberados({ status: 'agendada', corretorAceitou: true, tarefas: ['confirmacao_d1', 'confirmacao_d0'], temVisitaAnterior: false }))
      .toEqual(['criacao', 'aceite', 'd1', 'd0']);
    expect(momentosLiberados({ status: 'agendada', corretorAceitou: true, tarefas: ['confirmacao_d0'], temVisitaAnterior: false }))
      .toEqual(['criacao', 'aceite', 'd0']);
  });

  it('no-show e reagendamento liberam suas mensagens; cancelada não libera nada', () => {
    expect(momentosLiberados({ status: 'no_show', corretorAceitou: true, tarefas: [], temVisitaAnterior: false })).toContain('no_show');
    expect(momentosLiberados({ status: 'aguardando_corretor', corretorAceitou: false, tarefas: [], temVisitaAnterior: true })).toContain('reagendada');
    expect(momentosLiberados({ status: 'cancelada', corretorAceitou: true, tarefas: [], temVisitaAnterior: false })).toEqual([]);
  });
});
