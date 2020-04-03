set ORIG_GW=%1
for /f %%a in ('PowerShell -Command "& {Get-NetAdapter -InterfaceDescription *TAP* | Select-Object -ExpandProperty InterfaceAlias}"') do (set TAP=%%a)
for /f %%b in ('PowerShell -Command "& {Get-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceMetric 25 | Select-Object -ExpandProperty InterfaceAlias}"') do (set WAN=%%b)

PowerShell -Command "& {Remove-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %TAP% -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -InterfaceAlias %WAN% -AddressFamily IPv6 -RouterDiscovery Enabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
