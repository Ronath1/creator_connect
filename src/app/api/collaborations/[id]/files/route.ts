import {unstable_rethrow} from "next/navigation";
import {z} from "zod";
import {boundedBody,sameOrigin} from "@/server/attachments/body";
import {attachmentRequestContext,fileHeaders} from "@/server/attachments/request-context";
import {uploadAttachment,discardAttachment} from "@/server/attachments/worker-client";
import {AttachmentError} from "@/server/attachments/clamav";
export const runtime="nodejs",dynamic="force-dynamic";
function response(message:string,status:number){return Response.json({message},{status,headers:fileHeaders});}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const lifetime=AbortSignal.any([request.signal,AbortSignal.timeout(120_000)]);
 try{
  if(!sameOrigin(request))return response("Upload request unavailable.",403);
  const context=await attachmentRequestContext();if(context.status!==200)return response("File access unavailable.",context.status);
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)return response("Collaboration unavailable.",404);
  const header=request.headers.get("x-file-name")??"attachment";if(header.length>2048)return response("File name is too long.",400);
  const filename=decodeURIComponent(header),bytes=await boundedBody(request,undefined,lifetime);
  const file=await uploadAttachment(context.client,id,filename,bytes,lifetime);
  return Response.json({file},{status:201,headers:fileHeaders});
 }catch(error){unstable_rethrow(error);return response(error instanceof AttachmentError?error.message:"We couldn’t confirm the upload. Refresh before trying again.",error instanceof AttachmentError?400:503);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  if(!sameOrigin(request))return response("File request unavailable.",403);
  const context=await attachmentRequestContext();if(context.status!==200)return response("File access unavailable.",context.status);
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)return response("Collaboration unavailable.",404);
  const body=z.object({id:z.string().uuid()}).parse(JSON.parse(new TextDecoder().decode(await boundedBody(request,2048))));
  await discardAttachment(context.client,id,body.id);return response("File discarded.",200);
 }catch(error){unstable_rethrow(error);return response(error instanceof AttachmentError?error.message:"We couldn’t confirm cleanup. Refresh before trying again.",400);}
}
