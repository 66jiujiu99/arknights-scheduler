/**
 * 明日方舟官网数据导出脚本
 * 
 * 使用方式：
 * 1. 打开 https://ak.hypergryph.com/user/home 并确保已登录
 * 2. 按 F12 打开控制台(Console)
 * 3. 粘贴以下代码并回车
 * 4. 自动复制数据到剪贴板，回到排班工具粘贴即可
 */

(async () => {
  try {
    // 尝试找到游戏数据 API
    const resp = await fetch('/user/home/api', { credentials: 'include' })
    const text = await resp.text()
    let data
    try { data = JSON.parse(text) } catch { 
      // 不是JSON，试试其他路径
      const resp2 = await fetch('/api/user', { credentials: 'include' })
      data = await resp2.json()
    }
    
    // 提取干员和基建数据
    const result = {
      nickname: data?.data?.status?.name || '',
      chars: data?.data?.chars || [],
      building: data?.data?.building || {},
    }
    
    // 复制到剪贴板
    await navigator.clipboard.writeText(JSON.stringify(result))
    console.log('✅ 已复制干员数据到剪贴板！')
    console.log(`共 ${result.chars.length} 名干员`)
    console.log('回到排班工具，点击"从剪贴板导入"即可')
  } catch (e) {
    console.error('❌ 导出失败:', e)
    console.log('请确认已登录明日方舟官网')
  }
})()
