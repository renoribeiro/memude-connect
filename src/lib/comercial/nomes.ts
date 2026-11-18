export function nomeCorretor(c?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null): string {
  return [c?.profiles?.first_name, c?.profiles?.last_name].filter(Boolean).join(' ');
}
