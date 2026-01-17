import { z } from 'zod';

// Auth validation schemas
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email deve ter um formato válido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const signUpSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres'),
  lastName: z
    .string()
    .min(1, 'Sobrenome é obrigatório')
    .min(2, 'Sobrenome deve ter no mínimo 2 caracteres')
    .max(50, 'Sobrenome deve ter no máximo 50 caracteres'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email deve ter um formato válido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha deve ter no máximo 100 caracteres'),
});

// Profile validation schemas
export const profileSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres'),
  lastName: z
    .string()
    .min(2, 'Sobrenome deve ter no mínimo 2 caracteres')
    .max(50, 'Sobrenome deve ter no máximo 50 caracteres'),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(val), {
      message: 'Telefone deve ter o formato (11) 99999-9999',
    }),
});

// Corretor validation schema
export const corretorSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cpf: z
    .string()
    .min(11, 'CPF deve ter 11 dígitos')
    .max(14, 'CPF inválido')
    .optional(),
  telefone: z
    .string()
    .min(10, 'Telefone deve ter no mínimo 10 dígitos')
    .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Formato: (11) 99999-9999'),
  email: z
    .string()
    .email('Email deve ter um formato válido')
    .optional(),
  creci: z
    .string()
    .min(3, 'CRECI deve ter no mínimo 3 caracteres')
    .max(20, 'CRECI deve ter no máximo 20 caracteres'),
  cidade: z
    .string()
    .min(2, 'Cidade deve ter no mínimo 2 caracteres')
    .max(50, 'Cidade deve ter no máximo 50 caracteres'),
  estado: z.enum([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ], { message: 'Selecione um estado válido' }),
  tipo_imovel: z.enum([
    'residencial', 'comercial', 'terreno', 'rural', 'todos'
  ], { message: 'Selecione um tipo de imóvel válido' }),
  observacoes: z.string().optional(),
  status: z.enum(['em_avaliacao', 'ativo', 'inativo', 'bloqueado']).optional(),
  nota_media: z.number().min(0).max(5).optional(),
  bairros: z.array(z.string()).min(1, 'Selecione pelo menos um bairro'),
  construtoras: z.array(z.string()).min(1, 'Selecione pelo menos uma construtora'),
});

// Type inference
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type CorretorFormData = z.infer<typeof corretorSchema>;