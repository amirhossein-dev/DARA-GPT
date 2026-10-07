import { TokenStorage } from './types'
// Browser sessions are HttpOnly cookies. No localStorage/sessionStorage token fallback.
export const tokenStorage:TokenStorage={get:async()=>null,set:async()=>{throw new Error('WEB_TOKEN_STORAGE_FORBIDDEN')},clear:async()=>{}}
