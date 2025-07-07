# 🤖KLOK 自动化打码登录与提问脚本

该项目用于自动打码、登录 [klokapp.ai](https://klokapp.ai) 平台，自动进行积分查询和多轮提问对话。

---

# 📦 功能说明

- 支持读取本地私钥列表和代理池。
- 自动调用 Cloudflare Turnstile 验证码打码服务（自建）。
- 自动登录 klokapp.ai 并获取 Session Token。
- 自动查询用户积分信息。
- 支持随机从题库中抽取 10 个问题自动提交对话。
- 提供失败重试机制（最多 3 次）。


# ✅ 环境要求  
- Node.js >= 20  
- 本地打码服务（支持 Turnstile，例如自行部署 Cloudflare 解码器）

---

# 📦 安装步骤

克隆仓库：

```bash
git clone https://github.com/你的仓库/klok_auto_ask_bot.git
cd klok_auto_ask_bot
```

安装依赖：

```bash
npm install
```

# 📂 文件说明

main.js 主脚本文件

privateKeys.txt 钱包私钥列表（每行一个 0x 开头的私钥）

ip.txt 代理池地址（每行一个代理，如 http://用户名:密码@ip:端口）


# 💻 运行方式
```bash
npm start
```
会自动执行：

使用代理 + 打码服务登录 klokapp.ai

获取账号积分信息

自动发送 10 个随机提问并输出回答结果
