const fs = require('fs/promises');
const axios = require('axios');
const Web3 = require('web3');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');

const CAPTCHA_API = "http://localhost:3000/cf-clearance-scraper";
const WEBSITE_URL = "https://klokapp.ai/";
const SITE_KEY = "0x4AAAAAABdQypM3HkDQTuaO";

const QUESTION_POOL = [
  "介绍一下 Node.js 的事件循环机制",
  "如何使用 JavaScript 实现防抖函数？",
  "写一段可以爬取网页标题的 Python 代码",
  "如何在 React 中管理状态？",
  "请列举几种常用的排序算法并说明其复杂度",
  "如何使用 Web3.js 与以太坊智能合约交互？",
  "什么是 Redis，它的常见使用场景有哪些？",
  "写一个简单的 Promise 封装的延迟函数",
  "如何使用 Tailwind CSS 快速构建响应式页面？",
  "请帮我写一个注册登录的后端接口（Node.js+Express）"
];

// 读取 txt 文件
async function readLines(path) {
  const content = await fs.readFile(path, 'utf-8');
  return content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

function getRandomQuestion() {
  return QUESTION_POOL[Math.floor(Math.random() * QUESTION_POOL.length)];
}

function getProxyAgent(proxy) {
  return proxy ? new HttpsProxyAgent(proxy) : undefined;
}

// 打码服务
async function solveCaptcha(proxy = null) {
  const res = await axios.post(
    CAPTCHA_API,
    { url: WEBSITE_URL, siteKey: SITE_KEY, mode: "turnstile-min" },
    {
      httpsAgent: getProxyAgent(proxy),
      proxy: false,
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    }
  );
  if (!res.data?.token) throw new Error("无 token: " + JSON.stringify(res.data));
  console.log("验证码token:", res.data.token);
  return res.data.token;
}

// 登录
async function signIn(privateKey, proxy = null) {
  const web3 = new Web3();
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const address = web3.utils.toChecksumAddress(account.address);
  console.log("尝试登录，钱包地址:", address);

  const nonce = web3.utils.randomHex(32).slice(2);
  const timestamp = new Date().toISOString();

  const message = `klokapp.ai wants you to sign in with your Ethereum account:
${address}


URI: https://klokapp.ai/
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${timestamp}`;

  const signedMessage = account.sign(message).signature;
  const captchaToken = await solveCaptcha(proxy);

  const payload = { message, signedMessage, referral_code: null };
  const headers = {
    'Content-Type': 'application/json',
    Origin: WEBSITE_URL,
    Referer: WEBSITE_URL,
    'User-Agent': 'Mozilla/5.0',
    'x-turnstile-token': captchaToken,
  };

  const res = await axios.post('https://api1-pp.klokapp.ai/v1/verify', payload, {
    headers,
    httpsAgent: getProxyAgent(proxy),
    proxy: false,
    timeout: 20000,
  });

  if (res.data.message === "Verification successful") {
    console.log("✅ 登录成功，session token:", res.data.session_token);
    return { address, privateKey, sessionToken: res.data.session_token };
  } else {
    throw new Error("登录失败: " + JSON.stringify(res.data));
  }
}

// 查询积分
async function getPoints(sessionToken, proxy = null) {
  const headers = {
    'x-session-token': sessionToken,
    Origin: WEBSITE_URL,
    Referer: WEBSITE_URL,
    'User-Agent': 'Mozilla/5.0',
  };
  const res = await axios.get('https://api1-pp.klokapp.ai/v1/points', {
    headers,
    httpsAgent: getProxyAgent(proxy),
    proxy: false,
    timeout: 10000,
  });
  console.log("积分信息:", res.data);
  return res.data;
}

// 聊天功能
async function chat(sessionToken, content, proxy = null) {
  const captchaToken = await solveCaptcha(proxy);
  const headers = {
    'x-session-token': sessionToken,
    'x-turnstile-token': captchaToken,
    Origin: WEBSITE_URL,
    Referer: WEBSITE_URL,
    'User-Agent': 'Mozilla/5.0',
    'Content-Type': 'application/json',
  };

  const payload = {
    id: uuidv4(),
    title: "New Chat",
    language: "english",
    messages: [{ role: "user", content }],
    model: "gpt-4o-mini",
    search: false,
    sources: [],
  };

  const res = await axios.post('https://api1-pp.klokapp.ai/v1/chat', payload, {
    headers,
    httpsAgent: getProxyAgent(proxy),
    proxy: false,
    timeout: 30000,
  });
  console.log("🗨️ 聊天回复:", res.data);
  return res.data;
}

// 封装重试逻辑
async function retry(fn, args = [], maxAttempts = 3, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn(...args);
    } catch (e) {
      console.warn(`⚠️ 第 ${i + 1} 次失败:`, e.message || e);
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  console.error("❌ 所有尝试失败");
  return null;
}

// 主流程
(async () => {
  try {
    const privateKeys = await readLines('./privateKeys.txt');
    const proxies = await readLines('./ip.txt');

    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
      console.log(`\n=== 使用私钥 ${i + 1} 代理 ${proxy || '无'} 登录 ===`);

      const loginResult = await retry(signIn, [privateKey, proxy]);
      if (!loginResult) continue;

      await retry(getPoints, [loginResult.sessionToken, proxy]);

      for (let j = 0; j < 10; j++) {
        const question = getRandomQuestion();
        console.log(`\n💬 提问 ${j + 1}: ${question}`);
        await retry(chat, [loginResult.sessionToken, question, proxy]);
      }
    }

    console.log("\n✅ 全部账户执行完毕");
  } catch (e) {
    console.error("执行错误:", e.message);
  }
})();
