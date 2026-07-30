import {
  authorize,
  handleOptions,
  jsonResponse,
} from '../_shared/security.ts';

// Endpoint legado mantido temporariamente para responder de forma previsível.
// A criação de qualquer papel agora usa create-user e convite de uso único,
// sem senhas temporárias transmitidas ou armazenadas.
Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const access = await authorize(req, 'admin');
  if (access instanceof Response) return access;

  return jsonResponse(req, {
    error: 'Endpoint descontinuado',
    replacement: 'create-user',
  }, 410);
});
