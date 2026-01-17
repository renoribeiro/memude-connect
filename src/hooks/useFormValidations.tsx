import { useMemo } from 'react';

export const useFormValidations = () => {
  const validateCPF = useMemo(() => {
    return (cpf: string): boolean => {
      // Remove formatação
      const cleanCPF = cpf.replace(/[^\d]/g, '');
      
      // Verifica se tem 11 dígitos
      if (cleanCPF.length !== 11) return false;
      
      // Verifica sequências inválidas (todos os dígitos iguais)
      if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
      
      // Calcula primeiro dígito verificador
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
      }
      let remainder = 11 - (sum % 11);
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
      
      // Calcula segundo dígito verificador
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
      }
      remainder = 11 - (sum % 11);
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
      
      return true;
    };
  }, []);

  const validatePhone = useMemo(() => {
    return (phone: string): boolean => {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      // Aceita formatos: (11) 9 9999-9999 ou (11) 99999-9999
      return cleanPhone.length >= 10 && cleanPhone.length <= 11;
    };
  }, []);

  const validateEmail = useMemo(() => {
    return (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
  }, []);

  const validateCRECI = useMemo(() => {
    return (creci: string): boolean => {
      const cleanCRECI = creci.replace(/[^\d]/g, '');
      return cleanCRECI.length >= 4 && cleanCRECI.length <= 10;
    };
  }, []);

  const formatCPF = useMemo(() => {
    return (value: string): string => {
      const cleanValue = value.replace(/[^\d]/g, '');
      return cleanValue
        .substring(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    };
  }, []);

  const formatPhone = useMemo(() => {
    return (value: string): string => {
      const cleanValue = value.replace(/[^\d]/g, '');
      if (cleanValue.length <= 10) {
        return cleanValue
          .substring(0, 10)
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        return cleanValue
          .substring(0, 11)
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    };
  }, []);

  const applyMask = useMemo(() => {
    return (value: string, type: 'cpf' | 'phone'): string => {
      if (type === 'cpf') {
        return formatCPF(value);
      } else if (type === 'phone') {
        return formatPhone(value);
      }
      return value;
    };
  }, [formatCPF, formatPhone]);

  return {
    validateCPF,
    validatePhone,
    validateEmail,
    validateCRECI,
    formatCPF,
    formatPhone,
    applyMask,
  };
};