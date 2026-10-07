import { ApiError, Challenge, ClientType, NativeCredentials, SessionItem, SessionView, TokenStorage } from './types'

function viewOf(value: unknown, client: ClientType): SessionView {
  const v=value as SessionView
  if (!v || !v.user?.id || !v.tenant?.id || !v.session?.id || v.session.client!==client || !Array.isArray(v.membership?.roles) || !Array.isArray(v.permissions) || typeof v.entitlements?.enterprise!=='boolean' || v.entitlements.paymentsEnabled!==false || (client==='web' && typeof v.csrfToken!=='string')) throw new ApiError('INVALID_SESSION_RESPONSE',502)
  // Never put native credentials in React/Redux state.
  return {user:v.user,tenant:v.tenant,membership:v.membership,session:v.session,permissions:v.permissions,entitlements:v.entitlements,csrfToken:v.csrfToken}
}
export class IdentityClient {
  private native: NativeCredentials | null=null
  private view: SessionView | null=null
  private generation=0
  private queue: Promise<unknown>=Promise.resolve()
  private listeners=new Set<(value:SessionView|null)=>void>()
  constructor(private readonly options:{baseUrl:string;client:ClientType;storage:TokenStorage;fetcher?:typeof fetch;clock?:()=>number}) {}
  subscribe(fn:(value:SessionView|null)=>void) { this.listeners.add(fn);return ()=>{this.listeners.delete(fn)} }
  snapshot() {return this.view}
  private publish(view:SessionView|null) {this.view=view;this.generation++;for(const fn of this.listeners)fn(view)}
  private now() {return (this.options.clock||Date.now)()}
  private serialized<T>(fn:()=>Promise<T>):Promise<T> {const p=this.queue.then(fn,fn);this.queue=p.catch(()=>undefined);return p}
  private async raw(path:string,method:string,body?:unknown,authorized=false):Promise<unknown> {
    const headers:Record<string,string>={'Content-Type':'application/json'}
    if(authorized) {
      if(this.options.client==='native') {
        if(!this.native)throw new ApiError('LOGIN_REQUIRED',401)
        headers.Authorization=`Bearer ${this.native.accessToken}`
      } else if(method!=='GET') {
        if(!this.view?.csrfToken)throw new ApiError('LOGIN_REQUIRED',401)
        headers['X-DARA-CSRF']=this.view.csrfToken
      }
    }
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),15000)
    try {
      const response=await (this.options.fetcher||fetch)(this.options.baseUrl+path,{method,headers,credentials:this.options.client==='web'?'include':'omit',cache:'no-store',signal:abort.signal,...(body===undefined?{}:{body:JSON.stringify(body)})})
      let value:unknown;try{value=await response.json()}catch{throw new ApiError('INVALID_SERVER_RESPONSE',502)}
      if(!response.ok)throw new ApiError(typeof (value as {error?:unknown})?.error==='string'?(value as {error:string}).error:`HTTP_${response.status}`,response.status)
      return value
    } catch(error) {if(error instanceof ApiError)throw error;throw new ApiError('NETWORK_ERROR',0)}
    finally {clearTimeout(timeout)}
  }
  async config() {return this.raw('/identity/config','GET') as Promise<{otpMode:string;maxActiveSessions:number}>}
  requestOtp(input:{phone:string;tenant:string;deviceName:string}):Promise<Challenge> {
    return this.raw('/identity/otp/request','POST',{...input,client:this.options.client}) as Promise<Challenge>
  }
  private async adopt(value:unknown) {
    const view=viewOf(value,this.options.client)
    if(this.options.client==='native') {
      const v=value as NativeCredentials
      if(typeof v.accessToken!=='string'||!v.accessToken||!/^[-_A-Za-z0-9]{43}$/.test(v.refreshToken)||!Number.isSafeInteger(v.accessExpiresAt))throw new ApiError('INVALID_TOKEN_RESPONSE',502)
      const creds={accessToken:v.accessToken,accessExpiresAt:v.accessExpiresAt,refreshToken:v.refreshToken}
      try{await this.options.storage.set(creds.refreshToken)}
      catch {
        // Best-effort revoke the newly issued session if secure storage failed.
        this.native=creds
        try{await this.raw('/identity/logout','POST',{},true)}catch{/* outcome unknown; never report server revocation */}
        this.native=null;this.publish(null)
        try{await this.options.storage.clear()}catch{/* do not fall back to plaintext */}
        throw new ApiError('SECURE_STORAGE_FAILED',0)
      }
      this.native=creds
    }
    this.publish(view);return view
  }
  verifyOtp(input:{challengeId:string;code:string;firstName:string;lastName:string}) {
    return this.serialized(async()=>this.adopt(await this.raw('/identity/otp/verify','POST',{...input,client:this.options.client})))
  }
  private async clear() {this.native=null;this.publish(null);await this.options.storage.clear()}
  private async renew() {
    const refreshToken=this.native?.refreshToken || await this.options.storage.get()
    if(!refreshToken)throw new ApiError('LOGIN_REQUIRED',401)
    try{return await this.adopt(await this.raw('/identity/refresh','POST',{refreshToken}))}
    catch(error){if(error instanceof ApiError&&error.status===401)await this.clear();throw error}
  }
  restore():Promise<SessionView|null> {
    return this.serialized(async()=>{
      try {
        if(this.options.client==='native') {const token=await this.options.storage.get();if(!token){this.publish(null);return null}return await this.renew()}
        const view=viewOf(await this.raw('/identity/me','GET'),this.options.client);this.publish(view);return view
      }catch(error){if(error instanceof ApiError&&error.status===401){await this.clear();return null}throw error}
    })
  }
  private async ensureAccess() {
    if(this.options.client==='native'&&(!this.native||this.native.accessExpiresAt<=this.now()+15000)) {
      await this.serialized(async()=>{if(!this.native||this.native.accessExpiresAt<=this.now()+15000)await this.renew()})
    }
  }
  async me():Promise<SessionView> {
    await this.ensureAccess();const generation=this.generation
    try{const view=viewOf(await this.raw('/identity/me','GET',undefined,true),this.options.client);if(generation===this.generation)this.publish(view);return view}
    catch(error){if(error instanceof ApiError&&error.status===401&&generation===this.generation)await this.serialized(async()=>{if(generation===this.generation)await this.clear()});throw error}
  }
  async sessions():Promise<SessionItem[]> {await this.ensureAccess();return this.raw('/identity/sessions','GET',undefined,true) as Promise<SessionItem[]>}
  revokeSession(id:string) {
    return this.serialized(async()=>{
      if(!/^[a-f0-9-]{36}$/i.test(id))throw new ApiError('INVALID_IDENTIFIER',400)
      if(this.options.client==='native'&&(!this.native||this.native.accessExpiresAt<=this.now()+15000))await this.renew()
      await this.raw(`/identity/sessions/${id}`,'DELETE',undefined,true)
      if(id===this.view?.session.id)await this.clear()
    })
  }
  logout(all=false) {
    return this.serialized(async()=>{
      if(this.options.client==='native'&&(!this.native||this.native.accessExpiresAt<=this.now()+15000))await this.renew()
      try {await this.raw(all?'/identity/logout-all':'/identity/logout','POST',{},true)}
      catch(error){if(!(error instanceof ApiError&&error.status===401))throw error}
      await this.clear()
    })
  }
}
