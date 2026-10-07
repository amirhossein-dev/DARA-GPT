import { StyleSheet } from 'react-native'
export const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#0B0F1A'},body:{padding:24,gap:14,width:'100%',maxWidth:620,alignSelf:'center'},
  title:{color:'#E6E8F0',fontSize:25,fontWeight:'700',textAlign:'right'},
  text:{color:'#CED3E2',lineHeight:25,textAlign:'right'},muted:{color:'#9CA3AF',lineHeight:23,textAlign:'right'},
  input:{backgroundColor:'#171E2D',borderColor:'#36415A',borderWidth:1,borderRadius:10,padding:14,color:'#E6E8F0',fontSize:16,minHeight:50,textAlign:'right'},
  button:{backgroundColor:'#12685D',borderRadius:10,padding:15,alignItems:'center'},
  buttonText:{color:'#FFFFFF',fontSize:16,fontWeight:'600'},disabled:{opacity:0.45},
  card:{backgroundColor:'#141C2A',borderColor:'#304156',borderWidth:1,borderRadius:12,padding:16,gap:8},
  warning:{color:'#F2C981',lineHeight:24,textAlign:'right'},error:{color:'#FFB0B0',lineHeight:24,textAlign:'right'},
})
export function errorMessage(error:unknown):string {
  const code=error instanceof Error?error.message:''
  const messages:Record<string,string>={
    PHONE_MUST_BE_E164:'شماره را با کد کشور و + وارد کنید؛ برای مثال +98… .',
    OTP_INVALID_OR_EXPIRED:'کد معتبر نیست، منقضی شده یا عضویت فعال وجود ندارد.',
    OTP_RATE_LIMIT:'تعداد تلاش یا ارسال مجدد زیاد است. کمی بعد تلاش کنید.',
    OTP_DELIVERY_NOT_CONFIGURED:'سرویس تأیید هنوز در سرور پیکربندی نشده است.',
    OTP_DELIVERY_UNAVAILABLE:'ارسال کد در دسترس نیست. کد قبلی را موفق فرض نکنید.',
    ORIGIN_DENIED:'Origin این نسخهٔ وب در سرور مجاز نیست.',
    NETWORK_ERROR:'پاسخ قطعی از سرور نرسید. وضعیت عملیات را دوباره بررسی کنید.',
    SECURE_STORAGE_FAILED:'ذخیرهٔ امنِ نشست روی دستگاه انجام نشد؛ از ذخیرهٔ متنی استفاده نشده است.',
    REFRESH_REUSE_DETECTED:'نشست به دلیل استفادهٔ دوباره از توکن تمدید بسته شد؛ دوباره وارد شوید.',
    CSRF_DENIED:'اعتبار درخواست وب کافی نیست. وضعیت نشست را تازه‌سازی کنید.',
  }
  return messages[code]||'عملیات کامل نشد. تنظیمات و وضعیت نشست را بررسی کنید.'
}
