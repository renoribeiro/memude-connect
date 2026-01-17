import React from 'react';
import { cn } from '@/lib/utils';
import logoSvg from '@/assets/logo-memude.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'minimal';
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto', 
  lg: 'h-12 w-auto',
  xl: 'h-16 w-auto'
};

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'default', 
  className, 
  showText = true 
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img 
        src={logoSvg} 
        alt="MeMude Connect Logo" 
        className={cn(
          sizeMap[size],
          variant === 'white' && 'brightness-0 invert',
          "object-contain"
        )}
      />
      {showText && (
        <span className={cn(
          "font-bold tracking-tight",
          size === 'sm' && "text-lg",
          size === 'md' && "text-xl", 
          size === 'lg' && "text-2xl",
          size === 'xl' && "text-3xl",
          variant === 'white' ? "text-white" : "text-foreground"
        )}>
          MeMude Connect
        </span>
      )}
    </div>
  );
};

export default Logo;