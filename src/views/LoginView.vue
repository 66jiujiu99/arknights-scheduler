<template>
  <div class="ak-login-page">
    <section class="ak-login-hero">
      <div class="ak-kicker">ARKNIGHTS · BASE SCHEDULER</div>
      <h1>让基建<br /><span>自己运转。</span></h1>
      <p class="ak-lead">
        读取你的干员与基建，生成两套可执行方案：<b>一键换班</b>（少操作）与
        <b>效率最大</b>（按时刻表手动换）。全部计算在你的浏览器完成。
      </p>
      <ul class="ak-points">
        <li><span>01</span>森空岛凭证直连，不上传服务器</li>
        <li><span>02</span>按真实房间等级与干员练度计算</li>
        <li><span>03</span>3 个候选方案，收益 / 操作次数自己选</li>
      </ul>
      <div class="ak-hero-grid" aria-hidden="true"></div>
    </section>

    <section class="ak-login-panel">
      <div class="ak-panel-head">
        <div class="ak-panel-tag">LOGIN</div>
        <h2>连接森空岛</h2>
        <p>粘贴凭证后自动拉取干员、房间、无人机与订单数据。</p>
      </div>

      <label class="ak-label" for="pair">凭证（cred,token）</label>
      <textarea
        id="pair"
        v-model="pair"
        class="ak-textarea"
        spellcheck="false"
        placeholder="SK_OAUTH_CRED_KEY,SK_TOKEN_CACHE_KEY"
      ></textarea>
      <div class="ak-row ak-row-between">
        <span class="ak-hint">两段之间用英文逗号分隔；只保存在本地。</span>
        <button class="ak-btn ak-btn-primary" :disabled="busy || !pair.trim()" @click="submit">
          <span v-if="busy" class="ak-spinner"></span>
          <span v-else>读取账号</span>
        </button>
      </div>

      <div v-if="store.error" class="ak-alert">{{ store.error }}</div>

      <details class="ak-help">
        <summary>如何获取凭证？</summary>
        <ol>
          <li>浏览器打开 <a href="https://www.skland.com/" target="_blank" rel="noreferrer">skland.com</a> 并登录。</li>
          <li>按 F12 打开开发者工具，切到 Console。</li>
          <li>执行：
            <code>localStorage.getItem('SK_OAUTH_CRED_KEY') + ',' + localStorage.getItem('SK_TOKEN_CACHE_KEY')</code>
          </li>
          <li>复制输出的整段字符串，粘贴到上方。</li>
        </ol>
        <p class="ak-hint">凭证等价于登录态，请勿发给他人。换设备或清缓存后需要重新粘贴。</p>
      </details>

      <div class="ak-privacy">
        <span class="ak-dot"></span>
        纯静态页面 · 无后端 · 凭证与方案只存在 localStorage
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, login } from '../stores/session'

const router = useRouter()
const pair = ref('')
const busy = ref(false)

async function submit() {
  if (busy.value) return
  busy.value = true
  const ok = await login(pair.value)
  busy.value = false
  if (ok) router.push({ name: 'Setup' })
}
</script>
