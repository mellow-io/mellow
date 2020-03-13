# Mellow
Mellow 是一个基于规则的全局透明代理工具，可以运行在 Windows、macOS 和 Linux 上，也可以配置成路由器透明代理或代理网关，支持 SOCKS、HTTP、Shadowsocks、VMess 等多种代理协议。

## 下载安装

### Windows、macOS 和 Linux 安装文件下载

https://github.com/mellow-io/mellow/releases

### Homebrew 安装 (适用于 macOS)

```
brew cask install mellow
```

## 配置

### 全局代理配置

```ini
[Endpoint]
MyProxyServer, ss, ss://aes-128-gcm:pass@192.168.100.1:8888
Dns-Out, builtin, dns

[RoutingRule]
FINAL, MyProxyServer

[Dns]
hijack = Dns-Out

[DnsServer]
8.8.8.8
8.8.4.4
```

### 简单配置

绕过 cn 和 private。

```ini
[Endpoint]
MyProxyServer, ss, ss://aes-128-gcm:pass@192.168.100.1:8888
Direct, builtin, freedom, domainStrategy=UseIP
Dns-Out, builtin, dns

[RoutingRule]
DOMAIN-KEYWORD, geosite:cn, Direct
GEOIP, cn, Direct
GEOIP, private, Direct
FINAL, MyProxyServer

[Dns]
hijack = Dns-Out

[DnsServer]
localhost
8.8.8.8
```

### 更多配置

```ini
[Endpoint]
; tag, parser, parser-specific params...
Direct, builtin, freedom, domainStrategy=UseIP
Reject, builtin, blackhole
Dns-Out, builtin, dns
Http-Out, builtin, http, address=192.168.100.1, port=1087, user=myuser, pass=mypass
Socks-Out, builtin, socks, address=192.168.100.1, port=1080, user=myuser, pass=mypass
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/path?network=ws&tls=true&ws.host=example.com
Proxy-2, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp
Proxy-3, ss, ss://aes-128-gcm:pass@192.168.100.1:8888
Proxy-4, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/path?network=http&http.host=example.com%2Cexample1.com&tls=true&tls.allowinsecure=true
Proxy-7, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=kcp&kcp.mtu=1350&kcp.tti=20&kcp.uplinkcapacity=1&kcp.downlinkcapacity=2&kcp.congestion=false&header=none&sockopt.tos=184
Proxy-8, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=quic&quic.security=none&quic.key=&header=none&tls=false&sockopt.tos=184

[EndpointGroup]
; tag, colon-seperated list of selectors or endpoint tags, strategy, strategy-specific params...
Group-1, Proxy-1:Proxy-2:Proxy-3, latency, interval=300, timeout=6

[Routing]
domainStrategy = IPIfNonMatch

[RoutingRule]
; type, filter, endpoint tag or enpoint group tag
DOMAIN-KEYWORD, geosite:category-ads-all, Reject
IP-CIDR, 223.5.5.5/32, Direct
IP-CIDR, 8.8.8.8/32, Group-1
IP-CIDR, 8.8.4.4/32, Group-1
PROCESS-NAME, cloudmusic.exe, Direct
PROCESS-NAME, NeteaseMusic, Direct
GEOIP, cn, Direct
GEOIP, private, Direct
PORT, 123, Direct
DOMAIN-KEYWORD, geosite:cn, Direct
DOMAIN, www.google.com, Group-1
DOMAIN-FULL, www.google.com, Group-1
DOMAIN-SUFFIX, google.com, Group-1
FINAL, Group-1

[Dns]
; hijack = dns endpoint tag
hijack = Dns-Out
; cliengIp = ip
clientIp = 114.114.114.114

[DnsServer]
; address, port, tag
localhost
223.5.5.5
8.8.8.8, 53, Remote
8.8.4.4

[DnsRule]
; type, filter, dns server tag
DOMAIN-KEYWORD, geosite:geolocation-!cn, Remote
DOMAIN-SUFFIX, google.com, Remote

[DnsHost]
; domain = ip
doubleclick.net = 127.0.0.1

[Log]
loglevel = warning
```

更详细的 conf 配置，以及所对应的 JSON 配置可以[查看这里](https://github.com/mellow-io/mellow/blob/master/src/spec/conf_to_json.spec.js)。

## 开发运行和构建

```sh
git clone https://github.com/mellow-io/mellow.git
cd mellow

# 安装依赖
yarn

# 下载数据文件
yarn dlgeo

# 下载核心
# 默认只下载本系统对应的核心文件，如果要为其它系统构建，加 `--all` 下载其它系统对应的文件
yarn dlcore [--all]

# 运行
yarn start

# 构建 macOS 安装文件
yarn distmac

# 构建 Windows 安装文件
yarn distwin

# 构建 Linux 安装文件
yarn distlinux
```

## 一些说明

### 要不要使用 Mellow？
Mellow 是一个透明代理客户端，如果不理解，那说得实际点，就是不仅可以代理浏览器的请求，还可以代理微信、QQ、Telegram 客户端、Instagram 客户端、网易云音乐、各种命令行工具、Docker 容器、虚拟机、WSL、各种 IDE、各种游戏等等的网络请求，不需要任何额外的代理设置。

所以也很清楚的是，如果仅需要代理浏览器的请求，或者也不嫌麻烦为个别程序单独设置代理的话，是没必要使用 Mellow 的。

### 关于配置和启动
支持两种配置文件格式，一个是类 ini 的 conf 格式，另一个是 V2Ray JSON 格式，两种格式的配置可以同时存在。

可以在 Tray 菜单 Config Template 中创建对应的配置模板，创建后就是一个纯文本文件，自行打开目录去编辑完善配置，编辑好后保存，即可启动代理，待图标变色后，就表示代理已经启动。

macOS 客户端在初次和每次升级后启动时，都可能会弹框请求管理权限。

Windows 客户端在每次启动时都会弹框请求管理权限，如果不希望看到弹框，可以改变 UAC（用户帐户控制设置） 的通知等级。

如果启动代理后有任何问题，比如弹出错误，比如无法连接，要反馈的话，请附上必要的截图（错误弹框等）、配置和日志。

任何配置改动都需要重连生效。

### 关于 DNS
因为系统 DNS 很不好控制，推荐 Freedom Outbound 使用 UseIP 策略，再配置好内建 DNS 服务器，这样可以避免一些奇怪问题，也增加 DNS 缓存的利用效率。

**macOS 和 Linux 用户可能需要检查下系统 DNS 配置，勿用路由器网关地址或私有地址作 DNS**，因为那样流量就不会被路由到 TUN 接口，从而完全摆脱了 Mellow 控制，然后会导致一些 DNS 解析异常以及导致 DNS 分流完全失效。

DNS 的处理方面基本上和 [这篇文章](https://medium.com/@TachyonDevel/%E6%BC%AB%E8%B0%88%E5%90%84%E7%A7%8D%E9%BB%91%E7%A7%91%E6%8A%80%E5%BC%8F-dns-%E6%8A%80%E6%9C%AF%E5%9C%A8%E4%BB%A3%E7%90%86%E7%8E%AF%E5%A2%83%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8-62c50e58cbd0) 中介绍的没什么出入，默认使用 Sniffing 来处理 DNS 染污，建议再配置一下 DNS 分流，就是 conf 配置中的 DNS Hijack + DNS Outbound（Endpoint） + DNS Server + DNS Rule。

### 关于 NAT 类型
使用 SOCKS 或 Shadowsocks 协议的话支持 Full Cone NAT，注意服务器也要是支持 Full Cone NAT 的，如果要代理游戏，服务端可以考虑用 shadowsocks-libev、go-shadowsocks2 等。

### 关于 JSON 配置的 Inbound
JSON 配置文件中不需要有 Inbound，但也可以自行配置 Inbound 作其它用途，例如可以像其它非透明代理客户端一样，配置文件中写上 SOCKS/HTTP Inbound，再手动配置到系统或浏览器的代理设置中，那样浏览器的请求就会从 SOCKS/HTTP Inbound 过来，而不经过 TUN 接口，相当于 “系统代理” 模式（现在默认开启）。注意目前所有类型 Inbound 的 UDP 都不能用，因为我没见过哪个操作系统或浏览器真正地使用 SOCKS 的 UDP，所以也不会去修复它。

### 关于日志
日志有两份，一份是 Mellow 的日志，一份是 V2Ray 的日志，V2Ray 日志如果输出到 stdout/stderr，那 V2Ray 的日志会被打印到 Mellow 的日志里。

### 关于 GUI
目前没有任何计划做成 UI 配置的方式。

## FAQ

### 为什么在 Sessions 中有些请求显示进程名称为 `unknown process`？

1. 某些 UDP 会话如果持续时间过短，则会无法获取其发送进程。
2. 在 Windows 上，会看到较多的 `unknown process`，这是因为 Mellow 没有权限访问系统进程的信息，特别是 DNS 请求，因为发送 DNS 请求的通常是一个名为 svchost.exe 的系统进程。

### “系统代理” 选项的作用是什么？

Mellow 目前提供两种流量接管方式，一是 TUN 模式（某些软件中所指的 Enhanced Mode 就是这个），二是系统代理（常见的代理软件都用这个，不严谨地说就是只代理浏览器请求那类），与其它软件不同，Mellow 默认强制开启 TUN 模式，可选开启 “系统代理” 模式。

TUN 模式已经可以接管全部流量了，为什么还需要 “系统代理” 模式？

1. TUN 模式有性能瓶颈。
2. “系统代理” 模式不会有太多 DNS 相关的问题，代理浏览器请求也快。

开启 “代理代理” 模式后，两种模式是并存的，可以走系统代理的请求优先走系统代理，剩下的走 TUN。

### 可以在 Linux 上以命令行方式运行吗？

可以的，只需要把 [这](https://github.com/mellow-io/mellow-core/releases/download/v1.0.2/core-linux-amd64) [四](https://github.com/v2ray/domain-list-community/releases/latest/download/dlc.dat) [个](https://web.archive.org/web/20191227182412/https://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz) [文件](https://github.com/mellow-io/mellow/blob/master/scripts/run_linux.sh) 下载到同一个目录，把 `dlc.dat` 改名为 `geosite.dat`，把 `GeoLite2-Country.tar.gz` 解压后改名为 `geo.mmdb`，再自行创建一个叫 `cfg.json` 的 V2Ray 配置文件，然后运行 `run_linux.sh` 脚本（需要 root 权限）。

### 可以用作网关吗？

在 macOS 上，开启 Mellow 后，再开启 IP Forwarding 就行：

```sh
sudo sysctl -w net.inet.ip.forwarding=1
```

同样在 Linux 上，开启 IP Forwarding：

```sh
sudo sysctl -w net.ipv4.ip_forward=1
```

注意这种网关形式上有别于一般的路由器透明代理设置，这里的 “网关” 是局域网里另一台普通的局域网设备，它本身需要路由器作网关。

### 怎么把 conf 配置转换成 JSON 配置？

把 conf 配置运行起来，然后打开 Running Config 就是了，其实配置最终都是转成 JSON 再运行的。

不依赖 UI 的话可以用这条命令来转换：

```sh
cat config.conf | node src/config/convert.js > config.json
```

### 可以运行在路由器上做透明代理吗？
可以的：

1. 首先保证路由器处于一个正常状态，它本身也可以正常访问网络。（在路由器的 ssh shell 里可以 ping 通外网）
2. 把所需文件下载下来放到路由器上某一个目录里面，有些文件需要改下名字，具体参考上面的 “在 Linux 上运行”。（你需要到 [Releases](https://github.com/mellow-io/mellow-core/releases) 页面找对应系统架构的 core）
3. 同一目录里，创建一个叫 `cfg.json` 的 V2Ray 配置文件，不需要有 Inbound，其它配置按正常来，但建议参考 Mellow 所推荐的配置方式。
4. 检查路由器的系统 DNS，保证不是 127.0.0.1 或任何私有地址，如果有必要，自己填两个上去。（/etc/resolv.conf）
5. 然后运行 `run_linux.sh`（不是后台运行，你需要保留这个窗口）。
6. 然后用 `ip addr show` 查看 TUN 接口的名字，比如是 `tun1`，那么运行下面这条 iptables 命令就 OK 啦：

```sh
iptables -I FORWARD -o tun1 -j ACCEPT
```

在典型 OpenWrt 系统上流量**大概可能**是这么走的：
```
// 局域网其它设备的流量
wlan0/eth0 -> br-lan -> FORWARD (iptables) -> tun1 -> tun2socks (Mellow) -> ROUTING -> pppoe-wan
```

```
// 运行在路由器上的进程的流量（比如 dnsmasq）
local process -> ROUTING -> tun1 -> tun2socks (Mellow) -> ROUTING -> pppoe-wan
```

上面提到系统 DNS (/etc/resolv.conf) 中不能是 127.0.0.1、search lan、localhost 之类的原因是，假如路由器本地跑的是 dnsmasq 作 DNS 服务器，那么如果系统 DNS 是 127.0.0.1，Mellow 发的某些 DNS 请求就会给到 dnsmasq，而从上面第二个过程来看，dnsmasq (local process) 发出去的流量又会再次给到 Mellow，这其中如果处理不好就可能会出现死循环，这种情况一般都比较难处理，所以最直接的方法就是不让 DNS 流量经过本地的 dnsmasq。

因为 `Sessions` 的地址是 127.0.0.1，所以如果想查看请求记录，可以做下 SSH Port Forwarding：

```sh
# 在本地机器上运行，192.168.1.1 是路由器地址，
# 然后访问：http://localhost:6002/stats/session/plain
ssh -NL 6002:localhost:6001 root@192.168.1.1
```

### 如何配合其它代理软件使用？

参考 https://github.com/mellow-io/mellow/issues/3 和 https://github.com/mellow-io/mellow/issues/52

总的来说，需要处理好两点，一是把相应的代理软件流量用 PROCESS-NAME 规则排除掉，二是（有必要的话）对用到伪装域名的代理协议做额外处理。

## JSON 配置的扩展功能说明

### 自动选择最优线路
就是 conf 配置中的 Endpoint Group 使用 latency 作策略，可根据代理请求的 RTT（即实际向 outbound 发送一个代理请求，记录返回非空数据所使用的时间），自动选择负载均衡组中最优线路来转发请求。

```json
"routing": {
    "balancers": [
        {
            "tag": "server_lb",
            "selector": [
                "server_1",
                "server_2"
            ],
            "strategy": "latency",
            "interval": 60, // 秒，每次测速之间的最少时间间隔
            "totalMeasures": 2, // 每次测速中对每个 outbound 所做的请求次数
            "delay": 1, // 秒，每个测速请求之间的时间间隔
            "timeout": 6, // 秒，测速请求的超时时间
            "tolerance": 300, // 毫秒，可接受的延迟波动范围，切换最佳节点会将此波动范围考虑进去
            "probeTarget": "tls:www.google.com:443", // 测速请求发送的目的地
            "probeContent": "HEAD / HTTP/1.1\r\n\r\n" // 测速请求内容
        }
    ]
}
```

### 应用进程规则
就是 conf 配置中的 PROCESS-NAME 规则，支持 `*` 和 `?` 通配符匹配，匹配内容为进程名称，包括所有直接或非直接的父进程。

在 Windows 上，进程名称通常为 `xxx.exe`，例如 `chrome.exe`，在 Mellow 的 `Sessions` 中可方便查看。

在 macOS 上也可以通过 Mellow 的 `Sessions` 查看，也可以通过 `ps` 命令查看进程。

```json
"routing": {
    "rules": [
        {
            "app": [
                "git*",
                "chrome.exe"
            ],
            "type": "field",
            "outboundTag": "proxy"
        }
    ]
}
```

### QoS 设置

在 Outbound 的 streamSettings 中设置，仅支持 macOS 和 Linux。

```json
"streamSettings": {
  "sockopt": {
    "tos": 184
  }
}
```
