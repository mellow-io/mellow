for /f %%a in ('PowerShell -Command "& {Get-NetAdapter -InterfaceDescription *TAP* | Select-Object -ExpandProperty InterfaceAlias}"') do (set TAP=%%a)

PowerShell -Command "& {Remove-NetRoute -InterfaceAlias %TAP% -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -InterfaceAlias * -AddressFamily IPv6 -RouterDiscovery Enabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
