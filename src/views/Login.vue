<template>
  <div class="ak-login-page">
    <div class="ak-login-box">
      <div class="ak-login-title">罗德岛智能排班</div>
      <div class="ak-login-subtitle">登录森空岛账号以同步干员数据</div>

      <div class="ak-tab-bar">
        <div class="ak-tab" :class="{ active: tab === 'cred' }" @click="tab='cred'">Skland凭证</div>
        <div class="ak-tab" :class="{ active: tab === 'akcenter' }" @click="tab='akcenter'">官网Cookie</div>
        <div class="ak-tab" :class="{ active: tab === 'password' }" @click="tab='password'">账号密码</div>
        <div class="ak-tab" :class="{ active: tab === 'sms' }" @click="tab='sms'">验证码</div>
      </div>

      <!-- Tab: 手动输入 Credential -->
      <div v-if="tab === 'cred'">
        <ak-alert type="info">
          <strong>一步获取凭证</strong><br>
          1. 打开 <a href="https://www.skland.com" target="_blank" style="color:#5398ff">森空岛官网</a> 并登录<br>
          2. 按 F12 → Console（控制台）<br>
          3. 粘贴以下命令并回车：<br>
          <code style="display:block; padding:8px; margin:8px 0; background:var(--ak-bg-dark); border-radius:4px; font-size:12px; word-break:break-all">
            copy(localStorage.getItem('SK_OAUTH_CRED_KEY'))
          </code>
          4. 自动复制到剪贴板，回到本页粘贴即可
        </ak-alert>
        <div class="ak-form-group">
          <label class="ak-label">Credential</label>
          <input v-model="credInput" class="ak-input" placeholder="粘贴从森空岛复制的cred" />
        </div>
        <button class="ak-btn ak-btn-primary" style="width:100%; justify-content:center" @click="loginWithCred" :disabled="loading">
          <span v-if="loading" class="ak-spinner"></span>
          <span v-else>获取干员数据</span>
        </button>
      </div>

      <!-- Tab: 官网Cookie -->
      <div v-if="tab === 'akcenter'">
        <ak-alert type="info">
          <strong>使用明日方舟官网的登录状态</strong><br>
          1. 打开 <a href="https://ak.hypergryph.com/user/home" target="_blank" style="color:#5398ff">明日方舟官网个人中心</a> 并确保已登录<br>
          2. 按 F12 打开开发者工具 → Application → Cookies<br>
          3. 找到 <code>ak.hypergryph.com</code> 下的 <code>ak-user-center</code>，复制值粘贴到下方
        </ak-alert>
        <div class="ak-form-group">
          <label class="ak-label">ak-user-center 值</label>
          <input v-model="akCookieInput" class="ak-input" placeholder="粘贴ak-user-center的值" />
        </div>
        <button class="ak-btn ak-btn-primary" style="width:100%; justify-content:center" @click="loginWithAkCookie" :disabled="loading">
          <span v-if="loading" class="ak-spinner"></span>
          <span v-else>获取干员数据</span>
        </button>
      </div>

      <!-- Tab: 账号密码 -->
      <div v-if="tab === 'password'">
        <ak-alert type="warning">
          账号密码通过鹰角官方API直接验证，凭证仅用于获取干员数据，<strong>不会上传到任何第三方</strong>。
        </ak-alert>
        <div class="ak-form-group">
          <label class="ak-label">手机号</label>
          <input v-model="phone" class="ak-input" placeholder="输入手机号" maxlength="11" />
        </div>
        <div class="ak-form-group">
          <label class="ak-label">密码</label>
          <input v-model="password" class="ak-input" type="password" placeholder="输入密码" />
        </div>
        <ak-alert type="info" v-if="needProxy">
          如果直接登录失败，请尝试在下方配置 CORS 代理地址
        </ak-alert>
        <button class="ak-btn ak-btn-primary" style="width:100%; justify-content:center" @click="loginWithPassword" :disabled="loading">
          <span v-if="loading" class="ak-spinner"></span>
          <span v-else>登录</span>
        </button>
      </div>

      <!-- Tab: 手机验证码 -->
      <div v-if="tab === 'sms'">
        <ak-alert type="info">
          验证码将发送到你绑定的手机号，请注意查收。
        </ak-alert>
        <div class="ak-form-group">
          <label class="ak-label">手机号</label>
          <input v-model="phone" class="ak-input" placeholder="输入手机号" maxlength="11" />
        </div>
        <div class="ak-form-group">
          <label class="ak-label">验证码</label>
          <div style="display:flex; gap:8px">
            <input v-model="smsCode" class="ak-input" placeholder="6位验证码" maxlength="6" style="flex:1" />
            <button class="ak-btn ak-btn-secondary" @click="sendCode" :disabled="codeSending || codeCooldown > 0">
              {{ codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码' }}
            </button>
          </div>
        </div>
        <button class="ak-btn ak-btn-primary" style="width:100%; justify-content:center" @click="loginWithSms" :disabled="loading">
          <span v-if="loading" class="ak-spinner"></span>
          <span v-else>登录</span>
        </button>
      </div>

      <div v-if="error" style="margin-top:16px">
        <ak-alert type="error">{{ error }}</ak-alert>
      </div>

      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--ak-border)">
        <details style="font-size:13px; color:var(--ak-text-dim); cursor:pointer">
          <summary>CORS 代理配置 — 启用账号密码/验证码登录</summary>
          <div style="margin-top:8px">
            <p style="margin-bottom:8px">账号密码和验证码登录需要解决跨域问题。部署一个 Cloudflare Worker 做登录代理：</p>
            <ol style="margin:8px 0 8px 20px; line-height:1.8">
              <li>打开 <a href="https://dash.cloudflare.com/" target="_blank" style="color:#5398ff">Cloudflare Dashboard</a> → Workers & Pages</li>
              <li>创建一个新的 Worker，代码用仓库中 <code>login-proxy/worker.js</code> 的内容</li>
              <li>部署后把 Worker 地址粘贴到下方</li>
            </ol>
            <input v-model="proxyUrl" class="ak-input" placeholder="https://你的worker名.workers.dev/" style="font-size:12px" />
            <button class="ak-btn ak-btn-secondary" style="margin-top:8px; font-size:12px; padding:6px 12px" @click="saveProxy">保存代理地址</button>
            <p style="margin-top:8px; color:var(--ak-text-dim)">或用 <strong>Credential 方式</strong>登录（无需配置，从森空岛网站复制粘贴即可）</p>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginByPassword, loginBySmsCode, sendSmsCode, exchangeCredential, fetchGameData, saveCredential, setCorsProxy } from '../api/skyland.js'
import { loginWithAkcookie } from '../api/akcenter.js'

const router = useRouter()
const tab = ref('cred')
const phone = ref('')
const password = ref('')
const smsCode = ref('')
const credInput = ref('')
const akCookieInput = ref('')
const proxyUrl = ref(localStorage.getItem('ak_cors_proxy') || '')
const loading = ref(false)
const error = ref('')
const codeSending = ref(false)
const codeCooldown = ref(0)
const needProxy = ref(false)

async function processGameData(gameData) {
  // 提取干员列表
  const chars = gameData?.chars || []
  const building = gameData?.building || {}
  
  const userData = {
    nickname: gameData?.status?.name || '博士',
    level: gameData?.status?.level || 0,
    chars: chars.map(c => ({
      id: c.charId,
      name: c.name || c.charId,
      rarity: c.rarity || 1,
      level: c.level || 1,
      potential: c.potential || 1,
      evolve: c.evolvePhase || 0,
    })),
    building: {
      tradings: building.tradings || [],
      manufactures: building.manufactures || [],
      dormitories: building.dormitories || [],
      power: building.power || {},
      meeting: building.meeting || {},
      training: building.training || {},
      tiredChars: building.tiredChars || [],
      labor: building.labor || {},
    },
  }
  
  localStorage.setItem('ak_user_data', JSON.stringify(userData))
  return userData
}

async function loginWithAkCookie() {
  error.value = ''
  if (!akCookieInput.value.trim()) { error.value = '请粘贴 ak-user-center 的值'; return }
  loading.value = true
  try {
    const result = await loginWithAkcookie(akCookieInput.value.trim())
    saveCredential(result.cred)
    const userData = await processGameData(result.data)
    router.push({ name: 'Dashboard' })
  } catch (e) {
    error.value = e.message || '获取数据失败'
  } finally {
    loading.value = false
  }
}

async function loginWithCred() {
  error.value = ''
  if (!credInput.value.trim()) { error.value = '请输入 credential'; return }
  loading.value = true
  try {
    saveCredential(credInput.value.trim())
    const gameData = await fetchGameData(credInput.value.trim())
    await processGameData(gameData)
    router.push({ name: 'Dashboard' })
  } catch (e) {
    error.value = e.message || '获取数据失败，请检查credential是否有效'
  } finally {
    loading.value = false
  }
}

async function loginWithPassword() {
  error.value = ''
  if (!phone.value || !password.value) { error.value = '请输入手机号和密码'; return }
  loading.value = true
  try {
    const token = await loginByPassword(phone.value, password.value)
    const cred = await exchangeCredential(token)
    saveCredential(cred)
    const gameData = await fetchGameData(cred)
    await processGameData(gameData)
    router.push({ name: 'Dashboard' })
  } catch (e) {
    if (e.message?.includes('Failed to fetch') || e.message?.includes('CORS')) {
      needProxy.value = true
      error.value = '跨域请求被拦截，请配置 CORS 代理或在浏览器中安装跨域插件'
    } else {
      error.value = e.message || '登录失败'
    }
  } finally {
    loading.value = false
  }
}

async function loginWithSms() {
  error.value = ''
  if (!phone.value || smsCode.value.length < 4) { error.value = '请填写手机号和验证码'; return }
  loading.value = true
  try {
    const token = await loginBySmsCode(phone.value, smsCode.value)
    const cred = await exchangeCredential(token)
    saveCredential(cred)
    const gameData = await fetchGameData(cred)
    await processGameData(gameData)
    router.push({ name: 'Dashboard' })
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function sendCode() {
  if (!phone.value) { error.value = '请先输入手机号'; return }
  codeSending.value = true
  error.value = ''
  try {
    await sendSmsCode(phone.value)
    codeCooldown.value = 60
    const timer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (e) {
    error.value = e.message || '发送验证码失败'
  } finally {
    codeSending.value = false
  }
}

function saveProxy() {
  setCorsProxy(proxyUrl.value)
  alert('代理地址已保存')
}
</script>
