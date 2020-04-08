set TUN_GW=%1
set DEVICE_NAME=%2

for /f "skip=3 tokens=4" %%a in ('netsh interface show interface') do (
  netsh interface ipv6 set interface %%a routerdiscovery=disabled
)
netsh interface ip add route 0.0.0.0/0 %DEVICE_NAME% %TUN_GW% metric=0 store=active
ipconfig /flushdns
