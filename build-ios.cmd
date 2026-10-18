@echo off
rem Builds the iOS app on EAS. The Expo project lives in .\android, and EAS only
rem works from inside it, so this launcher moves there first.
cd /d "%~dp0android" || exit /b 1
call npx eas build --platform ios --profile production %*
