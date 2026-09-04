import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const ACCESS = 'btmi.access'
const REFRESH = 'btmi.refresh'

const storage = Platform.OS === 'web'
  ? {
      getItemAsync: (key: string) => AsyncStorage.getItem(key),
      setItemAsync: (key: string, value: string) => AsyncStorage.setItem(key, value),
      deleteItemAsync: (key: string) => AsyncStorage.removeItem(key),
    }
  : SecureStore

export const tokenStore = {
  getAccess: () => storage.getItemAsync(ACCESS),
  getRefresh: () => storage.getItemAsync(REFRESH),
  set: async (access: string, refresh: string) => {
    await Promise.all([storage.setItemAsync(ACCESS, access), storage.setItemAsync(REFRESH, refresh)])
  },
  clear: async () => {
    await Promise.all([storage.deleteItemAsync(ACCESS), storage.deleteItemAsync(REFRESH)])
  },
}
