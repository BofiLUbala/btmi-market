@echo off
setlocal enabledelayedexpansion
set BASE=http://localhost:8080/api/v1
set PASS=0
set FAIL=0

echo === SELLER SETUP ===
for /f "delims=" %%i in ('curl -s -X POST %BASE%/auth/login -H "Content-Type: application/json" --data-binary @login.json') do set LOGIN_RESP=%%i
for /f "tokens=2 delims=:," %%a in ("%LOGIN_RESP%") do (
    for /f "tokens=1 delims=}" %%b in ("%%a") do set TOKEN=%%b
)
set TOKEN=%TOKEN:"=%
set TOKEN=%TOKEN: =%
echo Token OK

for /f "delims=" %%i in ('curl -s -X POST %BASE%/businesses -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" --data-binary @biz.json') do set BIZ_RESP=%%i
echo Business response: %BIZ_RESP:~0,80%

REM Just use powershell for JSON parsing
echo Done
