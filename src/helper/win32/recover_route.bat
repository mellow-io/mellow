set ORIG_GW=%1
for /f %%a in ('PowerShell -Command "& {Get-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceMetric 25 | Select-Object -ExpandProperty InterfaceAlias}"') do (set WAN=%%a)

PowerShell -Command "& {Remove-NetRoute -DestinationPrefix 0.0.0.0/0 -Confirm:$False}"
PowerShell -Command "& {New-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %WAN% -NextHop %ORIG_GW% -RouteMetric 0 -PolicyStore ActiveStore -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -InterfaceAlias %WAN% -AddressFamily IPv6 -RouterDiscovery Enabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
