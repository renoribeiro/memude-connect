// Normalize only known provider envelopes; never treat message content as instructions.
export function visitMessage(message: any): { text: string; quoted?: string } {
  let m = message || {};
  let quoted: string | undefined;
  for (let i=0;i<4;i++) {
    quoted = m.contextInfo?.stanzaId || m.messageContextInfo?.stanzaId || quoted;
    const nested=m.message||m.ephemeralMessage?.message||m.viewOnceMessage?.message||m.viewOnceMessageV2?.message;
    if(!nested)break; m=nested;
  }
  let interactive='';
  try { const p=JSON.parse(m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson||'{}'); interactive=p.id||p.selectedId||''; } catch { /* Unknown native payload: do not guess. */ }
  return {text:m.conversation||m.extendedTextMessage?.text||m.buttonsResponseMessage?.selectedButtonId||m.listResponseMessage?.singleSelectReply?.selectedRowId||m.templateButtonReplyMessage?.selectedId||interactive||'',quoted:m.extendedTextMessage?.contextInfo?.stanzaId||m.interactiveResponseMessage?.contextInfo?.stanzaId||m.buttonsResponseMessage?.contextInfo?.stanzaId||m.listResponseMessage?.contextInfo?.stanzaId||m.templateButtonReplyMessage?.contextInfo?.stanzaId||quoted};
}
export function visitReceiptState(status: unknown): string | null {
  const value=String(status).toUpperCase();
  return ({'0':'failed','1':'accepted','2':'delivered','3':'read','4':'read',ERROR:'failed',FAILED:'failed',SERVER_ACK:'accepted',DELIVERY_ACK:'delivered',READ:'read',PLAYED:'read'} as Record<string,string>)[value]||null;
}
export function deliveryUncertain(error: unknown): boolean {
  return !/\((400|401|403|404|405|422|429|501)\)/.test((error as Error).message||'');
}
