import * as SecureStore from 'expo-secure-store'

const ACCESS = 'btmi.access'
const REFRESH = 'btmi.refresh'

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync(ACCESS),
  getRefresh: () => SecureStore.getItemAsync(REFRESH),
  set: async (access: string, refresh: string) => {
    await Promise.all([SecureStore.setItemAsync(ACCESS, access), SecureStore.setItemAsync(REFRESH, refresh)])
  },
  clear: async () => {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)])
  },
}

