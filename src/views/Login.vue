<template>
  <div class="ak-login-page">
    <div class="ak-login-box">
      <div class="ak-login-title">罗德岛智能排班</div>
      <div class="ak-login-subtitle">登录森空岛账号以同步干员数据</div>

      <div class="ak-tab-bar">
        <div class="ak-tab" :class="{ active: tab === 'cred' }" @click="tab='cred'">Credential</div>
        <div class="ak-tab" :class="{ active: tab === 'password' }" @click="tab='password'">账号密码</div>
        <div class="ak-tab" :class="{ active: tab === 'sms' }" @click="tab='sms'">验证码</div>
      </div>

      <!-- Tab: 手动输入 Credential -->
      <div v-if="tab === 'cred'">
        <ak-alert type="info">
          <strong>如何获取 Credential？</strong><br>
          1. 打开 <a href="https://www.skland.com" target="_blank" style="color:#5398ff">森空岛官网</a> 并登录<br>
          2. 按 F12 打开开发者工具 → Application → Local Storage<br>
          3. 找到 <code>skland.com</code> 下的 <code>cred</code> 值，复制粘贴到下方
        </ak-alert>
        <div class="ak-form-group">
          <label class="ak-label">Credential</label>
          <input v-model="credInput" class="ak-input" placeholder="粘贴你的cred凭证" />
        </div>
        <button class="ak-btn ak-btn-primary" style="width:100%; justify-content:center" @click="loginWithCred" :disabled="loading">
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
          <summary>CORS 代理配置（仅登录需要）</summary>
          <div style="margin-top:8px">
            <p style="margin-bottom:8px">如果登录请求被浏览器跨域拦截，可以配置一个 CORS 代理：</p>
            <input v-model="proxyUrl" class="ak-input" placeholder="https://你的cors-proxy.workers.dev/" style="font-size:12px" />
            <button class="ak-btn ak-btn-secondary" style="margin-top:8px; font-size:12px; padding:6px 12px" @click="saveProxy">保存代理配置</button>
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

const router = useRouter()
const tab = ref('cred')
const phone = ref('')
const password = ref('')
const smsCode = ref('')
const credInput = ref('')
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
