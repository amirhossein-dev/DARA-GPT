import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useIdentity } from '@/auth/provider'
import { Challenge } from '@/auth/types'
import { errorMessage, styles as s } from '@/auth/ui'

export default function SignIn() {
  const {client}=useIdentity()
  const [tenant,setTenant]=useState(process.env.EXPO_PUBLIC_TENANT_SLUG||'enterprise-pilot')
  const [phone,setPhone]=useState('')
  const [firstName,setFirst]=useState(''),[lastName,setLast]=useState('')
  const [otp,setOtp]=useState(''),[challenge,setChallenge]=useState<Challenge|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState('unknown')
  const [retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now())
  useEffect(()=>{void client.config().then(v=>setMode(v.otpMode)).catch(()=>setError('تنظیمات ورود از سرور دریافت نشد.'));const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[client])
  const send=async()=>{
    setBusy(true);setError('')
    try{const c=await client.requestOtp({phone,tenant,deviceName:Platform.OS==='web'?'Web browser':`DARA ${Platform.OS}`});setChallenge(c);setOtp('');setRetryAt(Date.now()+c.resendAfterSeconds*1000)}catch(e){setError(errorMessage(e))}finally{setBusy(false)}
  }
  const verify=async()=>{
    if(!challenge)return
    setBusy(true);setError('')
    try{await client.verifyOtp({challengeId:challenge.challengeId,code:otp,firstName:firstName.trim(),lastName:lastName.trim()})}catch(e){setError(errorMessage(e))}finally{setBusy(false)}
  }
  const waiting=Math.max(0,Math.ceil((retryAt-now)/1000))
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps='handled'>
    <Text style={s.title}>DARA · ورود سازمانی</Text>
    <Text style={s.muted}>ورود فقط برای عضویتِ فعالِ ثبت‌شده در سرور است. نام و شمارهٔ واردشده به‌تنهایی طرح یا نقش سازمانی ایجاد نمی‌کنند.</Text>
    {mode==='development_test'&&<View style={s.card}><Text style={s.warning}>حالت آزمایش توسعه: پیامک واقعی ارسال نمی‌شود. کد را از تنظیم محلی AUTH_DEV_OTP دریافت کنید. این ورود تأیید مالکیت شمارهٔ واقعی نیست.</Text></View>}
    <Text style={s.text}>شناسهٔ سازمان</Text>
    <TextInput accessibilityLabel='شناسه سازمان' style={s.input} value={tenant} onChangeText={setTenant} editable={!challenge&&!busy} autoCapitalize='none' autoCorrect={false} maxLength={64}/>
    <Text style={s.text}>شماره با کد کشور</Text>
    <TextInput accessibilityLabel='شماره تلفن' style={[s.input,{textAlign:'left'}]} value={phone} onChangeText={setPhone} editable={!challenge&&!busy} keyboardType='phone-pad' autoComplete='tel' placeholder='+98…' placeholderTextColor='#8492A8' maxLength={20}/>
    {!challenge?<Pressable accessibilityRole='button' disabled={busy||!phone.trim()||mode==='disabled'} onPress={()=>void send()} style={[s.button,(busy||!phone.trim())&&s.disabled]}><Text style={s.buttonText}>{busy?'در حال درخواست…':'درخواست کد'}</Text></Pressable>:<>
      <Text style={s.text}>نام</Text><TextInput style={s.input} accessibilityLabel='نام' value={firstName} onChangeText={setFirst} editable={!busy} maxLength={80} autoComplete='given-name'/>
      <Text style={s.text}>نام خانوادگی</Text><TextInput style={s.input} accessibilityLabel='نام خانوادگی' value={lastName} onChangeText={setLast} editable={!busy} maxLength={80} autoComplete='family-name'/>
      <Text style={s.text}>کد ۶ رقمی</Text><TextInput style={[s.input,{textAlign:'center',letterSpacing:6}]} accessibilityLabel='کد تأیید' value={otp} onChangeText={setOtp} editable={!busy} keyboardType='number-pad' autoComplete='one-time-code' maxLength={6}/>
      <Text style={s.muted}>کد سه دقیقه اعتبار دارد. با ورود در دستگاه سوم، قدیمی‌ترین نشست فعال بسته می‌شود. تأیید در دستگاه فعلی، نشست هفت‌روزه با سقف بیکاری دوازده‌ساعته می‌سازد.</Text>
      <Pressable accessibilityRole='button' disabled={busy||otp.length!==6||!firstName.trim()||!lastName.trim()} onPress={()=>void verify()} style={[s.button,(busy||otp.length!==6||!firstName.trim()||!lastName.trim())&&s.disabled]}><Text style={s.buttonText}>{busy?'در حال بررسی…':'تأیید و ورود'}</Text></Pressable>
      <Pressable disabled={busy||waiting>0} onPress={()=>void send()} style={[s.button,(busy||waiting>0)&&s.disabled]}><Text style={s.buttonText}>{waiting?`ارسال مجدد پس از ${waiting} ثانیه`:'ارسال مجدد'}</Text></Pressable>
      <Pressable disabled={busy} onPress={()=>{setChallenge(null);setOtp('');setError('')}}><Text style={s.muted}>تغییر شماره یا سازمان</Text></Pressable>
    </>}
    {!!error&&<Text accessibilityRole='alert' style={s.error}>{error}</Text>}
    <Text style={s.muted}>اطلاعات ورود و کد را در گفتگو با مدل یا اسکرین‌شات عمومی منتشر نکنید.</Text>
  </ScrollView></KeyboardAvoidingView>
}
