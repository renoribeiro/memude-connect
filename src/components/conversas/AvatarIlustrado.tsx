/**
 * Avatar ilustrado (bonequinho) no lugar das iniciais: mais humano e lúdico.
 * Sempre o mesmo desenho para a mesma pessoa (escolhido pelo nome/id). O cabelo segue um palpite pelo
 * primeiro nome só para o desenho; nada disso é gravado nem usado em outro lugar.
 */
const FUNDOS = ['#EDE9FB', '#FDE8EF', '#FFEBD9', '#E2F4EC', '#E3EEFB', '#F4E8FB'];
const PELES = ['#F7D7B8', '#EDBB91', '#D39A6B', '#A8704A', '#7A4E33'];
const CABELOS = ['#2B2140', '#4A2F22', '#7A4A2A', '#B5793A', '#1E1640'];
const ROUPAS = ['#422F91', '#E92662', '#5B43B5', '#2F8F6B', '#F29F05', '#3A78C9'];

const FEMININOS_SEM_A = new Set(['raquel', 'isabel', 'beatriz', 'ingrid', 'carmen', 'ester', 'esther', 'ruth', 'rute', 'miriam', 'thais', 'tais',
  'lais', 'iris', 'luz', 'rachel', 'mabel', 'nicole', 'alice', 'beatrice', 'liz', 'elis', 'ines', 'agnes', 'karen', 'kelly', 'evelyn', 'jaqueline',
  'jacqueline', 'aline', 'caroline', 'carol', 'michele', 'michelle', 'gabriele', 'gisele', 'giselle', 'denise', 'eliane', 'cristiane', 'simone',
  'daiane', 'viviane', 'tatiane', 'rose', 'irene', 'solange', 'ivone', 'ione', 'cleide', 'neide', 'joice', 'joyce', 'suelen', 'emily', 'yasmin',
  'ketlin', 'heloise', 'clarice', 'louise', 'mayumi', 'dary']);
const MASCULINOS_COM_A = new Set(['luca', 'lucca', 'joshua', 'jonatha', 'nikita', 'elia', 'ilia', 'iuca']);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function palpiteFeminino(nome: string | null | undefined): boolean | null {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0]?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() ?? '';
  if (!primeiro || /\d/.test(primeiro)) return null;
  if (FEMININOS_SEM_A.has(primeiro)) return true;
  if (MASCULINOS_COM_A.has(primeiro)) return false;
  return primeiro.endsWith('a');
}

export function AvatarIlustrado({ nome, chave, className }: { nome?: string | null; chave?: string | null; className?: string }) {
  const h = hash(`${chave ?? ''}|${nome ?? ''}`);
  const fundo = FUNDOS[h % FUNDOS.length];
  const pele = PELES[(h >>> 3) % PELES.length];
  const cabelo = CABELOS[(h >>> 6) % CABELOS.length];
  const roupa = ROUPAS[(h >>> 9) % ROUPAS.length];
  const fem = palpiteFeminino(nome);
  const estilo = fem === true ? ['longo', 'coque', 'cacheado-longo'][(h >>> 12) % 3] : ['curto', 'cacheado', 'topete'][(h >>> 12) % 3];

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden role="img">
      <circle cx="32" cy="32" r="32" fill={fundo} />
      {/* cabelo atrás da cabeça */}
      {estilo === 'longo' && <path d="M17 30 C16 14 25 10 32 10 C39 10 48 14 47 30 L48 46 C44 44 41 40 41 34 L23 34 C23 40 20 44 16 46 Z" fill={cabelo} />}
      {estilo === 'cacheado-longo' && <g fill={cabelo}>{[[18, 26], [17, 34], [19, 42], [46, 26], [47, 34], [45, 42], [24, 16], [32, 12], [40, 16]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" />)}</g>}
      {/* corpo */}
      <path d="M11 64 C11 50 21 43.5 32 43.5 C43 43.5 53 50 53 64 Z" fill={roupa} />
      <path d="M27 43.8 L32 50 L37 43.8 Z" fill="#fff" opacity="0.85" />
      <rect x="28" y="35" width="8" height="10" rx="3.5" fill={pele} />
      {/* cabeça */}
      <circle cx="32" cy="27" r="12.5" fill={pele} />
      {/* cabelo na frente */}
      {estilo === 'curto' && <path d="M19.2 26 C18.8 16 25.5 12.6 32 12.6 C39 12.6 45.4 16 44.8 26 C42.5 21.2 37.5 19.6 32 19.6 C26.5 19.6 21.5 21.2 19.2 26 Z" fill={cabelo} />}
      {estilo === 'topete' && <path d="M19.4 25 C19 16 25 12 32.5 12 C40 12 46 16.5 44.6 25 C43 20 40 18.5 36 18.5 C33 18.5 30 21 26 20.5 C23 20.2 21 22 19.4 25 Z" fill={cabelo} />}
      {estilo === 'cacheado' && <g fill={cabelo}>{[[22, 20], [27, 16], [32, 14.5], [37, 16], [42, 20], [20, 25], [44, 25]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4.6" />)}</g>}
      {(estilo === 'longo' || estilo === 'coque' || estilo === 'cacheado-longo') && (
        <path d="M19.4 26 C19.6 16 26 13 32 13 C38 13 44.4 16 44.6 26 C41 21.5 36 20 31 20.5 C26.5 21 22.5 22.5 19.4 26 Z" fill={cabelo} />
      )}
      {estilo === 'coque' && <circle cx="32" cy="10.5" r="5.5" fill={cabelo} />}
      {/* rosto */}
      <circle cx="27.4" cy="28" r="1.35" fill="#2B2140" />
      <circle cx="36.6" cy="28" r="1.35" fill="#2B2140" />
      <circle cx="24.6" cy="31.6" r="2" fill="#E92662" opacity="0.18" />
      <circle cx="39.4" cy="31.6" r="2" fill="#E92662" opacity="0.18" />
      <path d="M28.6 32.4 Q32 35.2 35.4 32.4" stroke="#2B2140" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
