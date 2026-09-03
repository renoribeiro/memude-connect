import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/**
 * Alterna entre o modo claro e o escuro. A escolha fica no localStorage
 * (next-themes), então vale por navegador e sobrevive ao recarregar.
 */
export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
            <Sun className="h-5 w-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
            <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
        </Button>
    );
}
