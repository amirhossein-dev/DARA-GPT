import test from 'node:test'
import assert from 'node:assert/strict'
import { IdentityClient } from '../auth/client'
import { TokenStorage } from '../auth/types'
const TOKEN='x'.repeat(43),NEXT='y'.repeat(43)
const sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function session(client:'web'|'native'='native') {return {user:{id:'user',phone:'+15550001001',firstName:'Test',lastName:'Only'},tenant:{id:'tenant',slug:'enterprise-pilot',name:'Test'},membership:{id:'member',roles:['operator'],revision:1},entitlements:{enterprise:true,paymentsEnabled:false},session:{id:sid,client,assurance:'development_test',expiresAt:900000,idleTimeoutMs:43200000,maxActiveSessions:2},permissions:[],csrfToken:client==='web'?'csrf-value':null}}
function fixture(clientType:'web'|'native'='native') {
  let stored:string|null=null;let now=1000;let refreshCalls=0;let expired=false
  const calls:{url:string;init:RequestInit}[]=[]
  const storage:TokenStorage={get:async()=>stored,set:async v=>{stored=v},clear:async()=>{stored=null}}
  const fetcher=async(url:string|URL|Request,init?:RequestInit)=>{
    calls.push({url:String(url),init:init||{}})
    const path=String(url).split('example.test')[1];let value:unknown=session(clientType);let status=200
    if(path==='/identity/otp/verify')value={...session(clientType),...(clientType==='native'?{accessToken:'access',refreshToken:TOKEN,accessExpiresAt:now+300000}:{})}
    if(path==='/identity/refresh'){refreshCalls++;value={...session(),accessToken:'next-access',refreshToken:NEXT,accessExpiresAt:now+300000}}
    if(path==='/identity/me'&&expired){status=401;value={error:'SESSION_INVALID'}}
    if(path==='/identity/sessions')value=[]
    if(path?.startsWith('/identity/logout'))value={revoked:true}
    return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
  }
  const client=new IdentityClient({baseUrl:'https://example.test',client:clientType,storage,fetcher,clock:()=>now})
  return {client,storage,calls,getStored:()=>stored,setStored:(v:string)=>{stored=v},advance:()=>{now+=301000},count:()=>refreshCalls,expire:()=>{expired=true}}
}
const credentials={challengeId:sid,code:'123456',firstName:'Name',lastName:'Test'}
test('native keeps only refresh token in secure-store port; public state has no tokens',async()=>{
  const f=fixture();await f.client.verifyOtp(credentials);assert.equal(f.getStored(),TOKEN);assert.equal('accessToken' in f.client.snapshot()!,false);await f.client.me();assert.equal((f.calls.at(-1)!.init.headers as Record<string,string>).Authorization,'Bearer access')
})
test('web uses cookies and CSRF; token storage is unused',async()=>{
  const f=fixture('web');await f.client.verifyOtp(credentials);assert.equal(f.getStored(),null);await f.client.logout();const call=f.calls.at(-1)!;assert.equal(call.init.credentials,'include');assert.equal((call.init.headers as Record<string,string>)['X-DARA-CSRF'],'csrf-value');assert.equal('Authorization' in (call.init.headers as object),false)
})
test('parallel protected reads coalesce native refresh',async()=>{
  const f=fixture();await f.client.verifyOtp(credentials);f.advance();await Promise.all([f.client.me(),f.client.sessions(),f.client.me()]);assert.equal(f.count(),1);assert.equal(f.getStored(),NEXT)
})
test('logout removes credentials and public state only after server result',async()=>{
  const f=fixture();await f.client.verifyOtp(credentials);await f.client.logout();assert.equal(f.client.snapshot(),null);assert.equal(f.getStored(),null)
})
test('revoked server session clears local credentials',async()=>{
  const f=fixture();await f.client.verifyOtp(credentials);f.expire();await assert.rejects(()=>f.client.me());assert.equal(f.getStored(),null);assert.equal(f.client.snapshot(),null)
})
test('cold native restore obtains fresh access from secure refresh token',async()=>{
  const f=fixture();f.setStored(TOKEN);await f.client.restore();assert.equal(f.count(),1);assert.equal(f.client.snapshot()?.user.id,'user')
})
test('network failure does not claim logout succeeded or retry mutations',async()=>{
  let fail=false,count=0
  const storage:TokenStorage={get:async()=>null,set:async()=>{},clear:async()=>{}}
  const client=new IdentityClient({baseUrl:'https://example.test',client:'web',storage,fetcher:async()=>{count++;if(fail)throw new Error('network');return new Response(JSON.stringify(session('web')))}})
  await client.verifyOtp(credentials);fail=true;await assert.rejects(()=>client.logout(),/NETWORK_ERROR/);assert.equal(count,2);assert.ok(client.snapshot())
})
test('a stale me response cannot resurrect state after logout',async()=>{
  let finish:((value:Response)=>void)|undefined
  const storage:TokenStorage={get:async()=>null,set:async()=>{},clear:async()=>{}}
  const client=new IdentityClient({baseUrl:'https://example.test',client:'web',storage,fetcher:async url=>{
    if(String(url).endsWith('/me'))return new Promise(resolve=>{finish=resolve})
    return new Response(JSON.stringify(session('web')))
  }})
  await client.verifyOtp(credentials);const pending=client.me();await new Promise(resolve=>setTimeout(resolve,0));await client.logout();finish!(new Response(JSON.stringify(session('web'))));await pending;assert.equal(client.snapshot(),null)
})
test('storage failure has no plaintext fallback and does not keep signed-in state',async()=>{
  const client=new IdentityClient({baseUrl:'https://example.test',client:'native',storage:{get:async()=>null,set:async()=>{throw new Error('locked')},clear:async()=>{}},fetcher:async()=>new Response(JSON.stringify({...session(),accessToken:'a',refreshToken:TOKEN,accessExpiresAt:999999}))})
  await assert.rejects(()=>client.verifyOtp(credentials),/SECURE_STORAGE_FAILED/);assert.equal(client.snapshot(),null)
})
