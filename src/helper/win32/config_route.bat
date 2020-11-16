set TUN_GW=%1
set DEVICE_NAME=%2

for /f "delims=," %%a in ('Getmac /v /nh /fo csv') do (
  netsh interface ipv6 set interface %%a routerdiscovery=disabled
)
netsh interface ip add route 0.0.0.0/0 %DEVICE_NAME% %TUN_GW% metric=0 store=active
ipconfig /flushdns
