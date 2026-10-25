export const SOVSI_URL:string;
export const SOVSI_ISSUER:string;
export const SOVSI_HOME:string;
export const SOVSI_PUBLIC_KEY:string;
export interface SovsiPortalUser {id:string;email?:string;email_confirmed_at?:string;factors?:Array<{id:string;factor_type:string;status:string}>;[key:string]:unknown}
export interface SovsiPortalSession {access_token:string;refresh_token:string;user:SovsiPortalUser;identitySubject:string;expires_at:number;client_id:string;session_id:string}
export interface SovsiPortalVerified {kind:'verified';session:SovsiPortalSession;returnTo:string}
export interface SovsiPortalChallenge {kind:'challenge';email:string;verify(code:string):Promise<SovsiPortalVerified>;cancel():void}
export interface SovsiPortalOptions {portalKey:string;canonicalOrigin:string;defaultReturnTo?:string;allowedReturnPaths?:string[];authorize?:(session:SovsiPortalSession)=>Promise<SovsiPortalSession>;fetch?:typeof fetch;crypto?:Crypto;storage?:Storage;environment?:{location:Pick<Location,'origin'|'pathname'|'search'|'assign'>;history?:Pick<History,'replaceState'>;sessionStorage?:Storage};now?:()=>number}
export interface SovsiPortal {configuration():Promise<{clientId:string;redirectUri:string;canonicalOrigin:string}>;begin(returnTo?:string):Promise<void>;complete(params?:URLSearchParams):Promise<SovsiPortalVerified|SovsiPortalChallenge>;getSession(forceRefresh?:boolean):Promise<SovsiPortalSession|null>;getAccessToken():Promise<string|null>;signOut():Promise<void>;subscribe(listener:(event:'SIGNED_IN'|'SIGNED_OUT'|'TOKEN_REFRESHED',session:SovsiPortalSession|null)=>void):()=>void}
export function createSovsiPortal(options:SovsiPortalOptions):SovsiPortal;
