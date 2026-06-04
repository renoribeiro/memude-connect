import { z } from "zod";
import { useCallback } from "react";
import { toast } from "@/hooks/use-toast";

// Função matemática estrita de CPF para o Zod
const isCPFValid = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/[^\d]/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  if (remainder >= 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  if (remainder >= 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
};

// Esquemas de validação
export const leadValidationSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  telefone: z.string()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .max(15, "Telefone muito longo")
    .regex(/^[\d\s\-()+]+$/, "Telefone contém caracteres inválidos"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  data_visita_solicitada: z.date().refine(date => date >= new Date(), "Data deve ser futura").optional().nullable(),
  horario_visita_solicitada: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Horário inválido (HH:MM)").optional().nullable(),
  empreendimento_id: z.string().uuid("Empreendimento inválido").optional().nullable()
});

export const corretorValidationSchema = z.object({
  profile_id: z.string().uuid("Profile ID inválido"),
  whatsapp: z.string()
    .min(10, "WhatsApp deve ter pelo menos 10 dígitos")
    .max(15, "WhatsApp muito longo")
    .regex(/^[\d\s\-()+]+$/, "WhatsApp contém caracteres inválidos"),
  creci: z.string().min(3, "CRECI deve ter pelo menos 3 caracteres").max(20, "CRECI muito longo"),
  cpf: z.string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, "CPF inválido")
    .optional()
    .or(z.literal(""))
    .refine(val => {
      if (!val) return true;
      return isCPFValid(val);
    }, "Os dígitos verificadores do CPF são matematicamente inválidos"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cidade: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres").optional().or(z.literal("")),
  telefone: z.string()
    .regex(/^[\d\s\-()+]*$/, "Telefone contém caracteres inválidos")
    .optional()
    .or(z.literal(""))
});

export const distributionSettingsSchema = z.object({
  timeout_minutes: z.number()
    .min(1, "Timeout deve ser pelo menos 1 minuto")
    .max(60, "Timeout não pode exceder 60 minutos"),
  max_attempts: z.number()
    .min(1, "Deve haver pelo menos 1 tentativa")
    .max(10, "Máximo de 10 tentativas"),
  auto_distribution_enabled: z.boolean(),
  fallback_to_admin: z.boolean()
});

export const whatsappMessageSchema = z.object({
  phone_number: z.string()
    .min(10, "Número de telefone inválido")
    .regex(/^[\d+\-\s()]+$/, "Número contém caracteres inválidos"),
  message: z.string()
    .min(1, "Mensagem não pode estar vazia")
    .max(4096, "Mensagem muito longa (máximo 4096 caracteres)"),
  lead_id: z.string().uuid("Lead ID inválido").optional(),
  corretor_id: z.string().uuid("Corretor ID inválido").optional()
});

// Hook principal de validações
export const useValidations = () => {
  const validateLead = useCallback((data: unknown) => {
    try {
      return leadValidationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast({
          title: "Erro de Validação",
          description: firstError.message,
          variant: "destructive"
        });
        throw new Error(firstError.message);
      }
      throw error;
    }
  }, []);

  const validateCorretor = useCallback((data: unknown) => {
    try {
      return corretorValidationSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast({
          title: "Erro de Validação",
          description: firstError.message,
          variant: "destructive"
        });
        throw new Error(firstError.message);
      }
      throw error;
    }
  }, []);

  const validateDistributionSettings = useCallback((data: unknown) => {
    try {
      return distributionSettingsSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast({
          title: "Erro de Validação",
          description: firstError.message,
          variant: "destructive"
        });
        throw new Error(firstError.message);
      }
      throw error;
    }
  }, []);

  const validateWhatsappMessage = useCallback((data: unknown) => {
    try {
      return whatsappMessageSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast({
          title: "Erro de Validação",
          description: firstError.message,
          variant: "destructive"
        });
        throw new Error(firstError.message);
      }
      throw error;
    }
  }, []);

  const sanitizePhoneNumber = useCallback((phone: string): string => {
    const cleaned = phone.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("+55")) {
      return cleaned;
    }

    if (cleaned.startsWith("55") && cleaned.length > 11) {
      return "+" + cleaned;
    }

    if (cleaned.length === 11 && /^[1-9][1-9]/.test(cleaned)) {
      return "+55" + cleaned;
    }

    if (cleaned.length === 10 && /^[1-9][1-9]/.test(cleaned)) {
      return "+55" + cleaned.substring(0, 2) + "9" + cleaned.substring(2);
    }

    return cleaned;
  }, []);

  const validateCPF = useCallback((cpf: string): boolean => {
    return isCPFValid(cpf);
  }, []);

  return {
    validateLead,
    validateCorretor,
    validateDistributionSettings,
    validateWhatsappMessage,
    sanitizePhoneNumber,
    validateCPF,
    schemas: {
      leadValidationSchema,
      corretorValidationSchema,
      distributionSettingsSchema,
      whatsappMessageSchema
    }
  };
};