import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { AvatarContato } from '@/components/conversas/pecas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mensagemErro } from '@/lib/conversas/servidor';

const LADO = 480;
const PASTA_PUBLICA = '/storage/v1/object/public/avatares/';

/** Corta no centro em quadrado e reduz para ~480px JPEG (foto do celular tem vários MB). */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não consegui abrir essa imagem. Escolha uma foto JPG ou PNG.'));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    if (!lado) throw new Error('Imagem vazia');
    const saida = Math.min(LADO, lado);
    const canvas = document.createElement('canvas');
    canvas.width = saida;
    canvas.height = saida;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a foto');
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, saida, saida);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Seu navegador não conseguiu preparar a foto');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Caminho do arquivo antigo (só da própria pasta) para apagar depois da troca. */
function caminhoAntigo(url: string | null | undefined, uid: string): string | null {
  const i = url?.indexOf(PASTA_PUBLICA) ?? -1;
  if (!url || i < 0) return null;
  const caminho = url.slice(i + PASTA_PUBLICA.length).split('?')[0];
  return caminho.startsWith(`${uid}/`) ? caminho : null;
}

/** Foto de perfil do corretor: toque na foto para escolher da galeria, tirar uma selfie ou remover. */
export function TrocarFoto({ nome }: { nome: string }) {
  const { user, profile, definirAvatar } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const foto = profile?.avatar_url ?? null;

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo || !user) return;
    setAberto(false);
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha uma foto (JPG ou PNG).'); return; }
    setEnviando(true);
    try {
      const blob = await prepararFoto(arquivo);
      const caminho = `${user.id}/foto-${Date.now()}.jpg`;
      const { error: eUp } = await supabase.storage.from('avatares').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
      if (eUp) throw eUp;
      const { data: url, error } = await supabase.rpc('meu_avatar_definir', { p_caminho: caminho });
      if (error) throw error;
      const antigo = caminhoAntigo(foto, user.id);
      if (antigo && antigo !== caminho) void supabase.storage.from('avatares').remove([antigo]);
      definirAvatar(url as string);
      toast.success('Foto atualizada');
    } catch (err) {
      toast.error(/row-level|policy|mime|size/i.test(mensagemErro(err)) ? 'Não foi possível enviar a foto. Use JPG ou PNG de até 2 MB.' : mensagemErro(err));
    } finally {
      setEnviando(false);
      if (galeria.current) galeria.current.value = '';
      if (camera.current) camera.current.value = '';
    }
  };

  const remover = async () => {
    if (!user) return;
    setAberto(false);
    setEnviando(true);
    try {
      const { error } = await supabase.rpc('meu_avatar_definir', { p_caminho: null });
      if (error) throw error;
      const antigo = caminhoAntigo(foto, user.id);
      if (antigo) void supabase.storage.from('avatares').remove([antigo]);
      definirAvatar(null);
      toast.success('Foto removida');
    } catch (err) {
      toast.error(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const opcao = 'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] font-bold active:bg-muted';
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} disabled={enviando} aria-label={foto ? 'Trocar minha foto' : 'Adicionar minha foto'}
        className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <AvatarContato nome={nome} chave={user?.id} foto={foto} tamanho="xl" />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-mm-rosa text-white ring-2 ring-card">
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
        </span>
      </button>
      <input ref={galeria} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      <Drawer open={aberto} onOpenChange={setAberto}>
        <DrawerContent className="tema-memude bg-card px-3 pb-6">
          <DrawerTitle className="px-4 pt-3 text-lg">Sua foto de perfil</DrawerTitle>
          <DrawerDescription className="px-4 pb-2 text-[13px]">Aparece no seu app e para a equipe MeMude. Use uma foto do rosto, de frente.</DrawerDescription>
          <button type="button" className={opcao} onClick={() => galeria.current?.click()}><ImagePlus className="h-5 w-5 text-primary" aria-hidden /> Escolher da galeria</button>
          <button type="button" className={opcao} onClick={() => camera.current?.click()}><Camera className="h-5 w-5 text-primary" aria-hidden /> Tirar uma foto agora</button>
          {foto && <button type="button" className={`${opcao} text-mm-rosa-texto`} onClick={remover}><Trash2 className="h-5 w-5" aria-hidden /> Remover foto</button>}
        </DrawerContent>
      </Drawer>
    </>
  );
}
