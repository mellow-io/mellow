set TUN_GW=%1
for /f %%a in ('PowerShell -Command "& {Get-NetAdapter -InterfaceDescription *TAP* | Select-Object -ExpandProperty InterfaceAlias}"') do (set TAP=%%a)

PowerShell -Command "& {New-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %TAP% -NextHop %TUN_GW% -RouteMetric 0 -PolicyStore ActiveStore -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -InterfaceAlias * -AddressFamily IPv6 -RouterDiscovery Disabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
