import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, AppState, Platform, Pressable, Text, View } from 'react-native'
import { IdentityClient } from './client'
import { tokenStorage } from './token-storage'
import { SessionView } from './types'
import { store } from '@/redux/store'

type State={client:IdentityClient;session:SessionView|null}
const Context=createContext<State|null>(null)
export function useIdentity() {const value=useContext(Context);if(!value)throw new Error('IDENTITY_PROVIDER_MISSING');return value}
function baseUrl() {
  const raw=process.env.EXPO_PUBLIC_API_BASE_URL
  if(!raw)throw new Error('EXPO_PUBLIC_API_BASE_URL را تنظیم کنید.')
  const u=new URL(raw)
  if(u.username||u.password||u.search||u.hash||(!__DEV__&&u.protocol!=='https:')||!['https:','http:'].includes(u.protocol))throw new Error('API URL نامعتبر است؛ در نسخهٔ انتشار HTTPS لازم است.')
  return raw.replace(/\/$/,'')
}
export function IdentityProvider({children}:{children:React.ReactNode}) {
  const configured=useMemo(()=>{try{return {client:new IdentityClient({baseUrl:baseUrl(),client:Platform.OS==='web'?'web':'native',storage:tokenStorage}),error:''}}catch(e){return {client:null,error:e instanceof Error?e.message:'تنظیمات نامعتبر'}}},[])
  const [session,setSession]=useState<SessionView|null>(null)
  const [loading,setLoading]=useState(true)
  const [problem,setProblem]=useState(configured.error)
  const restore=async()=>{
    if(!configured.client){setLoading(false);return}
    setLoading(true);setProblem('')
    try{await configured.client.restore()}catch{setProblem('وضعیت نشست تأیید نشد. شبکه یا دسترسی امنِ دستگاه را بررسی و دوباره تلاش کنید.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{
    if(!configured.client){setLoading(false);return}
    let previous=''
    const unsubscribe=configured.client.subscribe(next=>{
      const key=next?`${next.user.id}:${next.tenant.id}:${next.session.id}`:''
      if(key!==previous){store.dispatch({type:'identity/resetPrivateState'});previous=key}
      setSession(next)
    })
    void restore()
    const revalidate=(message:string)=>{
      const client=configured.client
      const sessionId=client?.snapshot()?.session.id
      if(!client||!sessionId)return
      void client.me().catch(()=>{
        // A response from a previous session must not hide the current identity.
        if(client.snapshot()?.session.id===sessionId)setProblem(message)
      })
    }
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')revalidate('وضعیت نشست نیاز به بررسی دوباره دارد.')
    })
    // Periodic revalidation bounds stale role/membership UI while foregrounded.
    const timer=setInterval(()=>{if(AppState.currentState==='active')revalidate('وضعیت نشست تأیید نشد.')},60000)
    return ()=>{unsubscribe();subscription.remove();clearInterval(timer)}
  },[configured.client])
  if(loading)return <View style={{flex:1,backgroundColor:'#0B0F1A',justifyContent:'center'}}><ActivityIndicator color='#46DCC5'/></View>
  if(problem||!configured.client)return <View style={{flex:1,backgroundColor:'#0B0F1A',padding:28,justifyContent:'center'}}><Text style={{color:'#E6E8F0',textAlign:'right'}}>{problem||configured.error}</Text><Pressable onPress={()=>void restore()} style={{padding:18}}><Text style={{color:'#46DCC5',textAlign:'center'}}>بررسی دوباره</Text></Pressable></View>
  return <Context.Provider value={{client:configured.client,session}}>{children}</Context.Provider>
}
