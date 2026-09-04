import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const ADMIN_ACCESS = 'btmi.admin.access'
const ADMIN_REFRESH = 'btmi.admin.refresh'

const storage = Platform.OS === 'web'
  ? {
      getItemAsync: (key: string) => AsyncStorage.getItem(key),
      setItemAsync: (key: string, value: string) => AsyncStorage.setItem(key, value),
      deleteItemAsync: (key: string) => AsyncStorage.removeItem(key),
    }
  : SecureStore

export const adminTokenStore = {
  getAccess: () => storage.getItemAsync(ADMIN_ACCESS),
  getRefresh: () => storage.getItemAsync(ADMIN_REFRESH),
  set: async (access: string, refresh: string) => {
    await Promise.all([storage.setItemAsync(ADMIN_ACCESS, access), storage.setItemAsync(ADMIN_REFRESH, refresh)])
  },
  clear: async () => {
    await Promise.all([storage.deleteItemAsync(ADMIN_ACCESS), storage.deleteItemAsync(ADMIN_REFRESH)])
  },
}
