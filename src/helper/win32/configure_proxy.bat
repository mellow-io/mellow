set STATE=%1
set PORT=%2
set PAC_URL="http://127.0.0.1:%PORT%/proxy.pac"

if %STATE% == "on" (
  reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL /t REG_SZ /d %PAC_URL% /f
)

if %STATE% == "off" (
  reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL /t REG_SZ /d "" /f
)
