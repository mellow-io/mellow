set DEVICE_NAME=%1

for /f "delims=," %%a in ('Getmac /v /nh /fo csv') do (
  netsh interface ipv6 set interface %%a routerdiscovery=enabled
)
netsh interface ip delete route 0.0.0.0/0 %DEVICE_NAME%
ipconfig /flushdns
