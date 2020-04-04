set TUN_GW=%1
set DEVICE_NAME=%2

PowerShell -Command "& {New-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias %DEVICE_NAME% -NextHop %TUN_GW% -RouteMetric 0 -PolicyStore ActiveStore -Confirm:$False}"
PowerShell -Command "& {Set-NetIPInterface -AddressFamily IPv6 -RouterDiscovery Disabled}"
PowerShell -Command "& {Clear-DnsClientCache}"
