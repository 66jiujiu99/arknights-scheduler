/**
 * 明日方舟官网登录 — 使用 ak-user-center cookie（鹰角通行证登录凭证）
 *
 * 流程：ak-user-center(token) → OAuth2 grant → generate_cred_by_code → cred → 游戏数据
 * 说明：as.hypergryph.com 不带 CORS 头，在 CF Pages / 本地开发（走 functions 代理）或配置了
 *       CORS 代理地址时可用；GitHub Pages 直连会被浏览器拦截，请改用森空岛 Credential 登录。
 */
import { fetchGameData, exchangeCredential, saveCredential } from './skyland.js'

/**
 * 使用 ak-user-center cookie 获取游戏数据
 */
export async function loginWithAkcookie(cookieValue) {
  if (!cookieValue) throw new Error('请粘贴 ak-user-center 的值')
  // ak-user-center 即鹰角通行证登录凭证（token），先换取森空岛 cred
  const cred = await exchangeCredential(cookieValue)
  saveCredential(cred)
  const data = await fetchGameData(cred)
  return { cred, data }
}
