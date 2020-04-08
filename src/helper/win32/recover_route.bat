set DEVICE_NAME=%1

for /f "skip=3 tokens=4" %%a in ('netsh interface show interface') do (
  netsh interface ipv6 set interface %%a routerdiscovery=enabled
)
netsh interface ip delete route 0.0.0.0/0 %DEVICE_NAME%
ipconfig /flushdns
