import "server-only";
import {AttachmentError,MAX_ATTACHMENT_BYTES} from "./clamav.ts";
/** Binary upload bodies avoid multipart parsers/overhead altogether. Both the
 * announced length and actual streamed bytes are bounded before buffering. */
export async function boundedBody(request:Request,limit=MAX_ATTACHMENT_BYTES,deadline?:AbortSignal){
 const announced=request.headers.get("content-length");
 if(announced&&(!/^\d+$/.test(announced)||Number(announced)>limit))throw new AttachmentError("The upload is too large.");
 if(!request.body)throw new AttachmentError("Choose a file to upload.");
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let total=0;
 const signal=AbortSignal.any([request.signal,deadline??AbortSignal.timeout(120_000)]);
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener("abort",abort,{once:true});
 try {while(true){signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new AttachmentError("The upload is too large.");}parts.push(value);}}finally{signal.removeEventListener("abort",abort);reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;
}
export function sameOrigin(request:Request){const origin=request.headers.get("origin");return origin?origin===new URL(request.url).origin:Boolean(request.headers.get("authorization")?.startsWith("Bearer "));}
