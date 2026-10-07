import * as SecureStore from 'expo-secure-store'
import { TokenStorage } from './types'
const KEY='dara.identity.refresh.v1'
export const tokenStorage:TokenStorage={
  get:()=>SecureStore.getItemAsync(KEY),
  set:value=>SecureStore.setItemAsync(KEY,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
  clear:()=>SecureStore.deleteItemAsync(KEY)
}
