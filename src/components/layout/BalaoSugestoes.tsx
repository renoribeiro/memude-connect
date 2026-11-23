import { MessageSquarePlus } from 'lucide-react';

// Documento onde a equipe cola prints de sugestões de melhoria e erros encontrados no sistema.
const DOC_SUGESTOES = 'https://docs.google.com/document/d/1PpDx9ktHR8xKKLCUazmSv1LlamS5WaaZiaGdkbdE6yo/edit?tab=t.0';

/** Balão fixo no canto: abre o documento de sugestões e erros em outra aba. */
export function BalaoSugestoes() {
  return (
    <a
      href={DOC_SUGESTOES}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Sugestão ou erro? Bata um print e cole no documento de melhorias"
      title="Sugestão ou erro? Bata um print e cole no documento de melhorias"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-secondary py-3 pl-3 pr-3 text-sm font-semibold text-white shadow-lg ring-4 ring-secondary/15 transition-all duration-200 hover:pr-5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-secondary/40 print:hidden"
    >
      <MessageSquarePlus className="h-5 w-5 shrink-0" aria-hidden />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[16rem] group-hover:opacity-100 group-focus-visible:max-w-[16rem] group-focus-visible:opacity-100">
        Sugestão ou erro? Mande um print
      </span>
    </a>
  );
}
