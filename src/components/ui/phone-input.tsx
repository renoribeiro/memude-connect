import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  normalizePhoneNumber,
  formatPhoneDisplay,
  isValidBrazilianPhone,
  isValidInternationalPhone,
  isInternationalPhone,
} from "@/utils/phoneHelpers";
import { CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

type PhoneMode = 'br' | 'exterior';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder, disabled, className }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [mode, setMode] = useState<PhoneMode>(() => (isInternationalPhone(value) ? 'exterior' : 'br'));

  useEffect(() => {
    if (value) {
      // Um valor que chega de fora (edição de cadastro) decide o modo sozinho.
      const external = isInternationalPhone(value);
      setMode(external ? 'exterior' : 'br');
      setDisplayValue(formatPhoneDisplay(value));
      setIsValid(external ? isValidInternationalPhone(value) : isValidBrazilianPhone(value));
    } else {
      setDisplayValue('');
      setIsValid(false);
    }
  }, [value]);

  const switchMode = (next: PhoneMode) => {
    if (next === mode) return;
    // Trocar de modo limpa o campo: um número pela metade em um formato não
    // significa nada no outro.
    setMode(next);
    setDisplayValue('');
    setIsValid(false);
    onChange('');
  };

  const handleBrazilianChange = (input: string) => {
    // Remove caracteres não numéricos para contar dígitos
    const digitsOnly = input.replace(/\D/g, '');

    // Aplica máscara visual progressiva durante digitação
    let masked = input;
    if (digitsOnly.length >= 2) {
      const ddd = digitsOnly.substring(0, 2);
      const resto = digitsOnly.substring(2);

      if (resto.length === 0) {
        masked = `(${ddd})`;
      } else if (resto.length <= 5) {
        masked = `(${ddd}) ${resto}`;
      } else {
        const parte1 = resto.substring(0, 5);
        const parte2 = resto.substring(5, 9);
        masked = `(${ddd}) ${parte1}-${parte2}`;
      }
    }

    setDisplayValue(masked);

    // Normaliza e valida apenas quando o número está completo (10 ou 11 dígitos)
    if (digitsOnly.length >= 10) {
      const normalized = normalizePhoneNumber(input);
      const valid = isValidBrazilianPhone(normalized);
      setIsValid(valid);

      // Só envia o valor normalizado se for válido
      onChange(valid ? normalized : '');
    } else {
      // Número incompleto - não normaliza ainda
      setIsValid(false);
      onChange('');
    }
  };

  const handleInternationalChange = (input: string) => {
    // No exterior o formato varia por país, então guardamos E.164: "+" e dígitos.
    const digitsOnly = input.replace(/\D/g, '');
    const e164 = digitsOnly ? `+${digitsOnly}` : '';

    setDisplayValue(e164);

    const valid = isValidInternationalPhone(e164);
    setIsValid(valid);
    onChange(valid ? e164 : '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Se o campo foi limpo
    if (!input) {
      onChange('');
      setDisplayValue('');
      setIsValid(false);
      return;
    }

    if (mode === 'exterior') {
      handleInternationalChange(input);
    } else {
      handleBrazilianChange(input);
    }
  };

  const handleBlur = () => {
    if (displayValue && !value) {
      // Usuário saiu do campo com número incompleto
      const digitsOnly = displayValue.replace(/\D/g, '');
      const minimo = mode === 'exterior' ? 8 : 10;
      if (digitsOnly.length > 0 && digitsOnly.length < minimo) {
        // Limpa o campo visual para forçar reinserção
        setDisplayValue('');
        setIsValid(false);
      }
    }
  };

  const getBorderColor = () => {
    if (!value) return '';
    return isValid ? 'border-green-500 focus-visible:ring-green-500' : 'border-red-500 focus-visible:ring-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === 'br' ? 'default' : 'outline'}
          onClick={() => switchMode('br')}
          disabled={disabled}
          aria-pressed={mode === 'br'}
          className="h-7 px-2.5 text-xs"
        >
          Brasil
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'exterior' ? 'default' : 'outline'}
          onClick={() => switchMode('exterior')}
          disabled={disabled}
          aria-pressed={mode === 'exterior'}
          className="h-7 px-2.5 text-xs"
        >
          Exterior
        </Button>
      </div>

      <div className="relative">
        <Input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={
            mode === 'exterior'
              ? "+351 912345678"
              : (placeholder || "(85) 99999-9999")
          }
          disabled={disabled}
          className={`pr-10 ${getBorderColor()} ${className || ''}`}
        />
        {value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </div>

      {mode === 'exterior' && (
        <p className="text-xs text-muted-foreground">
          Comece pelo código do país. Ex.: Portugal +351 912345678, EUA +1 2125550147.
        </p>
      )}

      {value && !isValid && (
        <p className="text-xs text-red-500">
          {mode === 'exterior'
            ? 'Número inválido. Inclua o DDI do país, sem zeros à esquerda.'
            : 'Número inválido. Use o formato: (85) 99999-9999'}
        </p>
      )}
    </div>
  );
}
