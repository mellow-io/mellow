set ORIG_GW=%1

route delete 0.0.0.0
route add 0.0.0.0 mask 0.0.0.0 %ORIG_GW% metric 200
ipconfig /flushdns
