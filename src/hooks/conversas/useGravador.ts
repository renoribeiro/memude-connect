import { useCallback, useEffect, useRef, useState } from 'react';

const TIPOS = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

/** Gravação de áudio no navegador (voz do corretor) com cronômetro e cancelamento. */
export function useGravador(limiteSeg = 300) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  /** Áudio que parou sozinho no limite de tempo (quem usa o gravador envia). */
  const [noLimite, setNoLimite] = useState<File | null>(null);
  const iniciando = useRef(false);
  const rec = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicio = useRef(0);
  const finalizar = useRef<((a: File | null) => void) | null>(null);

  const limpar = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
    setGravando(false);
  }, []);

  useEffect(() => limpar, [limpar]);

  const parar = useCallback((enviar: boolean) => new Promise<File | null>((resolve) => {
    const r = rec.current;
    if (!r) { resolve(null); return; }
    finalizar.current = enviar ? resolve : () => resolve(null);
    if (!enviar) partes.current = [];
    if (r.state !== 'inactive') r.stop(); else resolve(null);
  }), []);

  const comecar = useCallback(async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErro('Este navegador não grava áudio. Use o Chrome ou o app instalado.');
      return false;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setErro('Permita o uso do microfone para gravar áudio.');
      return false;
    }
    const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const r = new MediaRecorder(stream.current, tipo ? { mimeType: tipo, audioBitsPerSecond: 32_000 } : undefined);
    partes.current = [];
    r.ondataavailable = (e) => { if (e.data.size) partes.current.push(e.data); };
    r.onstop = () => {
      const mime = (r.mimeType || 'audio/webm').split(';')[0];
      const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
      const blob = new Blob(partes.current, { type: mime });
      const dur = Math.round((Date.now() - inicio.current) / 1000);
      limpar();
      const cb = finalizar.current;
      finalizar.current = null;
      cb?.(blob.size > 0 && dur >= 1 ? Object.assign(new File([blob], `audio-${Date.now()}.${ext}`, { type: mime }), { duracao: dur }) : null);
    };
    rec.current = r;
    inicio.current = Date.now();
    setSegundos(0);
    r.start(250);
    setGravando(true);
    navigator.vibrate?.(30);
    relogio.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicio.current) / 1000);
      setSegundos(s);
      if (s >= limiteSeg && r.state !== 'inactive') {
        finalizar.current = (f) => setNoLimite(f);
        r.stop();
      }
    }, 250);
    return true;
  }, [limiteSeg, limpar]);

  const iniciar = useCallback(async () => {
    if (iniciando.current || rec.current) return false; // toque duplo no microfone
    iniciando.current = true;
    try {
      return await comecar();
    } finally {
      iniciando.current = false;
    }
  }, [comecar]);

  return { gravando, segundos, erro, iniciar, parar, noLimite, limparNoLimite: () => setNoLimite(null) };
}
