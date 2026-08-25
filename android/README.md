# BTMI Market Android

Expo SDK 54 / React Native client for the existing BTMI backend. The Web application and Android application use the same API and business data.

## Requirements

- Node.js 20.19 or newer (Node.js 22 LTS recommended)
- Android Studio emulator or an Android phone with Expo Go
- BTMI backend running on port 8080

## API configuration

Copy `.env.example` to `.env`.

Android emulator:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api/v1
```

Physical phone on the same Wi-Fi network:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8080/api/v1
```

Production must use an HTTPS API URL. Never put a token or password in `.env`.

## Run

```powershell
npm install
npm run android
```

## Verification

```powershell
npx tsc --noEmit
npm exec expo-doctor
npx expo export --platform android --output-dir dist-test
```

## Implemented

- Expo Router Buyer/Seller separation
- SecureStore access and refresh tokens
- automatic token refresh
- TanStack Query caching and reconnect behavior
- Marketplace products and backend search
- categories and category products
- Product Detail with backend `base_price`, variant `unit_price`, exact `stock_quantity`, relative media URL resolution and Shop identity
- single-Shop local cart with explicit conflict feedback
- backend cart preview
- Buyer profile contact/location
- Seller authentication guard and Business loading

## Still required

- Buyer registration, activation app links, forgot/reset password
- Shops list and Shop Detail
- persisted Favorites backend API
- checkout Delivery/Review/Place Order screens
- Buyer Orders, cash confirmation, Tracking, Points and Reviews
- editable Buyer Profile
- full Seller tab navigation and operational screens
- product image capture/upload and product creation wizard
- EAS development/production build profiles
- real emulator and physical-device interaction tests

Do not describe an item in the second list as complete until its real API flow and Android UI have both been tested.
