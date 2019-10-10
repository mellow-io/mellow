set TUN_GW=%1
set ORIG_GW=%2

route delete 0.0.0.0
route add 0.0.0.0 mask 0.0.0.0 %TUN_GW% metric 2
route add 0.0.0.0 mask 0.0.0.0 %ORIG_GW% metric 200
ipconfig /flushdns
