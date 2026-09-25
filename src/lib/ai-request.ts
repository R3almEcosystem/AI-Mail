export type AiRequest = { action:'summarize'|'draft'|'prioritize'|'extract'; uid:number; instructions?:string };
export function parseAiRequest(value:unknown):AiRequest|null {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const input=value as Record<string,unknown>;
  if (Object.keys(input).some(key=>!['action','uid','instructions'].includes(key))
    || typeof input.action!=='string' || !['summarize','draft','prioritize','extract'].includes(input.action)
    || typeof input.uid!=='number' || !Number.isSafeInteger(input.uid) || input.uid<1 || input.uid>4294967295
    || (input.instructions!==undefined && (typeof input.instructions!=='string' || input.instructions.length>1000))) return null;
  return {action:input.action as AiRequest['action'],uid:input.uid,...(input.instructions===undefined?{}:{instructions:input.instructions as string})};
}
export async function readAiRequest(request:Request):Promise<AiRequest> {
  const invalid=()=>new Error('INVALID_AI_REQUEST');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')
    || !/^(?:identity)?$/i.test(request.headers.get('content-encoding') ?? '') || !request.body || request.bodyUsed || request.signal.aborted) throw invalid();
  const length=request.headers.get('content-length');
  if (length!==null && (!/^\d{1,5}$/.test(length) || Number(length)>8192)) throw invalid();
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;let cancel!:()=>void;
  const stopped=new Promise<never>((_,reject)=>{cancel=()=>{reject(invalid());void reader.cancel().catch(()=>{});};});
  const timer=setTimeout(cancel,5000);request.signal.addEventListener('abort',cancel,{once:true});
  try {
    while(true){
      const {value,done}=await Promise.race([reader.read(),stopped]);if(done)break;
      size+=value.byteLength;if(size>8192)throw invalid();chunks.push(value);
    }
    if(length!==null && Number(length)!==size)throw invalid();
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const parsed=parseAiRequest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    if(!parsed)throw invalid();return parsed;
  } catch {throw invalid();}
  finally {clearTimeout(timer);request.signal.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
