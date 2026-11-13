import "server-only";
import {auth} from "@clerk/nextjs/server";
import {getIntegrationConfig} from "@/server/config";
import {loadMembership} from "@/server/services/membership";
import {getOwnProfile} from "@/server/services/profile";
export async function attachmentRequestContext(){
 if(!getIntegrationConfig())return {status:503 as const};
 if(!(await auth()).userId)return {status:401 as const};
 const context=await loadMembership();if(!context.member||context.member.status!=="active")return {status:403 as const};
 if(!(await getOwnProfile()).complete)return {status:403 as const};
 return {...context,status:200 as const};
}
export const fileHeaders={"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie, Authorization","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"};
