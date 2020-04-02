set TUN_GW=%1
set ORIG_GW=%2
for /f %%a in ('PowerShell -Command "& {Get-NetAdapter -InterfaceDescription *TAP* | Select-Object -ExpandProperty InterfaceAlias}"') do (set TAP=%%a)
for /f %%b in ('PowerShell -Command "& {Get-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceMetric 25 | Select-Object -ExpandProperty InterfaceAlias}"') do (set WAN=%%b)

PowerShell -Command "& {Remove-NetRoute -DestinationPrefix 0.0.0.0/0 -Confirm:$False}"
PowerShell -Command "& {New-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %TAP% -NextHop %TUN_GW% -RouteMetric 0 -PolicyStore ActiveStore -Confirm:$False}"
PowerShell -Command "& {New-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %WAN% -NextHop %ORIG_GW% -RouteMetric 0 -PolicyStore ActiveStore -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -InterfaceAlias %WAN% -AddressFamily IPv6 -RouterDiscovery Disabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
