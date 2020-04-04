set DEVICE_NAME=%1

PowerShell -Command "& {Remove-NetRoute -InterfaceAlias %DEVICE_NAME% -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -AddressFamily IPv6 -RouterDiscovery Enabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
