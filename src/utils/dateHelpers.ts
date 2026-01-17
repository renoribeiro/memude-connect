// Custom implementations for date-fns functions that might not be available
export const subDays = (date: Date, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - amount);
  return result;
};

export const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

/**
 * Parse a date string in YYYY-MM-DD format as local date
 * Avoids timezone conversion issues
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Compare if two dates are the same day (ignoring time)
 */
export const isSameLocalDay = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseLocalDate(date2) : date2;
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export const isToday = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? parseLocalDate(date) : date;
  const today = new Date();
  return checkDate.toDateString() === today.toDateString();
};

export const isTomorrow = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? parseLocalDate(date) : date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return checkDate.toDateString() === tomorrow.toDateString();
};

export const isPast = (date: Date): boolean => {
  return date < new Date();
};

/**
 * Normaliza horário do formato HH:MM:SS para HH:MM
 * Útil para compatibilizar dados do banco (TIME) com campos de formulário
 * @param time - Horário no formato HH:MM:SS ou HH:MM
 * @returns Horário no formato HH:MM
 */
export const normalizeTime = (time: string | null | undefined): string => {
  if (!time) return '';
  // Pega apenas os primeiros 5 caracteres (HH:MM)
  return time.substring(0, 5);
};
