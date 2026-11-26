import React from 'react';
import { cn } from '@/lib/utils';
import logotipo from '@/assets/memude-logotipo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'minimal';
  className?: string;
  /** Mostra "| CONNECT" ao lado, no mesmo formato do "| CORRETOR" do app. */
  showText?: boolean;
}

const sizeMap = {
  sm: 'h-[26px] w-auto',
  md: 'h-8 w-auto',
  lg: 'h-12 w-auto',
  xl: 'h-16 w-auto',
};

/** Logotipo MeMude (balão roxo com o M + nome em rosa). Não recolorir nem esticar; mínimo 26 px de altura. */
const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'default', className, showText = true }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <img
      src={logotipo}
      alt="MeMude"
      className={cn(sizeMap[size], variant === 'white' && 'brightness-0 invert', 'object-contain')}
    />
    {showText && (
      <>
        <span aria-hidden className={cn('w-px bg-mm-divisor', size === 'sm' ? 'h-4' : size === 'md' ? 'h-5' : 'h-7')} />
        <span className={cn(
          'font-bold uppercase tracking-[0.14em]',
          size === 'sm' || size === 'md' ? 'text-[11px]' : 'text-sm',
          variant === 'white' ? 'text-white' : 'text-primary',
        )}>
          Connect
        </span>
      </>
    )}
  </div>
);

export default Logo;
