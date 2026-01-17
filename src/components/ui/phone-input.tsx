import { Input } from "@/components/ui/input";
import { normalizePhoneNumber, formatPhoneDisplay, isValidBrazilianPhone } from "@/utils/phoneHelpers";
import { CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (value) {
      const formatted = formatPhoneDisplay(value);
      setDisplayValue(formatted);
      setIsValid(isValidBrazilianPhone(value));
    } else {
      setDisplayValue('');
      setIsValid(false);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Se o campo foi limpo
    if (!input) {
      onChange('');
      setDisplayValue('');
      setIsValid(false);
      return;
    }
    
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
      if (valid) {
        onChange(normalized);
      } else {
        onChange(''); // Não salva número inválido
      }
    } else {
      // Número incompleto - não normaliza ainda
      setIsValid(false);
      onChange(''); // Não salva número incompleto
    }
  };

  const handleBlur = () => {
    if (displayValue && !value) {
      // Usuário saiu do campo com número incompleto
      const digitsOnly = displayValue.replace(/\D/g, '');
      if (digitsOnly.length > 0 && digitsOnly.length < 10) {
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
    <div className="relative">
      <Input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder || "(85) 99999-9999"}
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
      {value && !isValid && (
        <p className="text-xs text-red-500 mt-1">
          Número inválido. Use o formato: (85) 99999-9999
        </p>
      )}
    </div>
  );
}
