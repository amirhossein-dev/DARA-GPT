import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { useIdentity } from '@/auth/provider'
import { styles as s } from '@/auth/ui'
export default function PlansScreen() {
  const {session}=useIdentity()
  if(!session)return null
  return <ScrollView style={s.page} contentContainerStyle={s.body}>
    <Text style={s.title}>عضویت سازمانی</Text>
    <View style={s.card}>
      <Text style={s.text}>{session.tenant.name}</Text>
      <Text style={s.title}>{session.entitlements.enterprise?'Enterprise · فعال':'بدون طرح Enterprise'}</Text>
      <Text style={s.muted}>وضعیت از سرور و عضویت سازمانی دریافت شده است؛ انتخاب رابط، طرح را فعال نمی‌کند.</Text>
      <Text style={s.muted}>نقش‌ها: {session.membership.roles.join(' / ')}</Text>
      <Text style={s.warning}>پرداخت و خرید عمومی در این فاز فعال نیست.</Text>
    </View>
    <Link href='/account' style={s.button}><Text style={s.buttonText}>حساب و مدیریت نشست‌ها</Text></Link>
  </ScrollView>
}
