import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { useIdentity } from '@/auth/provider'
import { SessionItem } from '@/auth/types'
import { errorMessage, styles as s } from '@/auth/ui'
export default function Account() {
  const {client,session}=useIdentity()
  const [items,setItems]=useState<SessionItem[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [confirm,setConfirm]=useState<string|null>(null)
  const reload=useCallback(async()=>{setError('');try{await client.me();setItems(await client.sessions())}catch(e){setError(errorMessage(e))}},[client])
  useEffect(()=>{void reload()},[reload])
  const act=async(id:string)=>{setBusy(true);setError('');try{if(id==='all')await client.logout(true);else if(id==='current')await client.logout();else await client.revokeSession(id);setConfirm(null);if(client.snapshot())await reload()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
  if(!session)return null
  return <ScrollView style={s.page} contentContainerStyle={s.body}>
    <Text style={s.title}>حساب و نشست‌ها</Text>
    <Text style={s.text}>{session.user.firstName} {session.user.lastName}</Text>
    <Text style={s.muted}>{session.tenant.name} · {session.membership.roles.join(' / ')}</Text>
    <Text style={s.muted}>{session.entitlements.enterprise?'Enterprise فعال از سمت سرور':'Enterprise فعال نیست'} · پرداخت غیرفعال</Text>
    <Text style={s.warning}>{session.session.assurance==='development_test'?'ورود آزمایشی؛ نه تأیید شمارهٔ واقعی.':'نشست با تأیید پیامکی؛ MFA قوی در این مرحله پیاده نشده است.'}</Text>
    <Pressable style={s.button} disabled={busy} onPress={()=>void reload()}><Text style={s.buttonText}>بررسی دوبارهٔ نشست‌ها</Text></Pressable>
    {items.map(item=><View style={s.card} key={item.id}>
      <Text style={s.text}>{item.deviceName}{item.current?' — همین نشست':''}</Text>
      <Text style={s.muted}>{item.client} · آخرین مشاهده: {new Date(item.lastSeenAt).toLocaleString()}</Text>
      <Text style={s.muted}>انقضای نهایی: {new Date(item.expiresAt).toLocaleString()}</Text>
      <Pressable disabled={busy} onPress={()=>setConfirm(item.id)}><Text style={s.warning}>بستن این نشست</Text></Pressable>
    </View>)}
    <Pressable style={s.button} disabled={busy} onPress={()=>setConfirm('current')}><Text style={s.buttonText}>خروج از این نشست</Text></Pressable>
    <Pressable style={s.button} disabled={busy} onPress={()=>setConfirm('all')}><Text style={s.buttonText}>خروج از همهٔ دستگاه‌ها</Text></Pressable>
    {confirm&&<View style={s.card}><Text style={s.warning}>بستن نشست، دسترسیِ درخواست‌های بعدی را قطع می‌کند؛ اثر عملیاتِ قبلاً انجام‌شده را برنمی‌گرداند.</Text><Pressable style={s.button} disabled={busy} onPress={()=>void act(confirm)}><Text style={s.buttonText}>{busy?'در حال بررسی…':'تأیید بستن نشست'}</Text></Pressable><Pressable disabled={busy} onPress={()=>setConfirm(null)}><Text style={s.text}>انصراف</Text></Pressable></View>}
    {!!error&&<Text accessibilityRole='alert' style={s.error}>{error}</Text>}
    <Link href='/' style={s.text}>بازگشت</Link>
  </ScrollView>
}
