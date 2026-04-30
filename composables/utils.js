// 处理安装数量，如 10200 -> 10.2k, 1000 -> 1k, 1000000 -> 1M, 1000000000 -> 1B
export function formatCount(count) {
  if (count >= 1000000000000000) {
    const num = count / 1000000000000000
    return num.toFixed(num % 1 === 0 ? 0 : 1) + 'Q'
  }
  if (count >= 1000000000000) {
    const num = count / 1000000000000
    return num.toFixed(num % 1 === 0 ? 0 : 1) + 'T'
  }
  if (count >= 1000000000) {
    const num = count / 1000000000
    return num.toFixed(num % 1 === 0 ? 0 : 1) + 'B'
  }
  if (count >= 1000000) {
    const num = count / 1000000
    return num.toFixed(num % 1 === 0 ? 0 : 1) + 'M'
  }
  if (count >= 1000) {
    const num = count / 1000
    return num.toFixed(num % 1 === 0 ? 0 : 1) + 'k'
  }
  return count
}

// 日期处理只保留年月日多种格式兼容处理2025-01-01 00:00:00 2024-12-09T12:46:53.000Z ,格式化成2025-01-01
export function formatYMD(input, { pad = false } = {}) {
  if (!input) return ''

  let d

  // 1) Date 对象直接用
  if (input instanceof Date) {
    d = input
  }
  // 2) 时间戳（数字 / 数字字符串）
  else if (typeof input === 'number' || /^\d+$/.test(String(input))) {
    d = new Date(Number(input))
  }
  // 3) 字符串格式
  else if (typeof input === 'string') {
    const str = input.trim()

    // 兼容：2025-01-01 00:00:00 -> 2025-01-01T00:00:00
    // Safari 对 "YYYY-MM-DD HH:mm:ss" 解析不稳定，转成 ISO 更稳
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(str)) {
      d = new Date(str.replace(' ', 'T'))
    } else {
      d = new Date(str)
    }
  }

  if (!d || isNaN(d.getTime())) return ''

  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()

  if (!pad) return `${y}-${m}-${day}`

  const mm = String(m).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}


export function extractTextFromHtml(html, maxLength) {
  if (!html || typeof html !== 'string') return ''

  // 去除 HTML 标签
  const text = html
    // 匹配所有 HTML 标签（包括注释和CDATA）
    .replace(/<!--[\s\S]*?-->|<\s*[^>]+(\s+[^>]*)*>|<\s*\/?\s*[\w-]+[^>]*\s*\/?\s*>/gi, '')
    // 替换多个空白字符为单个空格
    .replace(/\s+/g, ' ')
    // 去除首尾空白
    .trim()

  // 截取指定长度
  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength) + '...'
  }

  return text
}

/**
 * 获取广告信息
 * @param {string} key 广告 key
 * @param {Array} adList 广告列表
 * @returns {object} { active: boolean, content: string }
 */
export function getAd(key, adList) {
  const ad = adList.find(item => item.key === key)
  if (ad && ad.status) {
    return { active: true, content: ad.content }
  }
  return { active: false, content: '' }
}


// 格式化评论日期
export function formatReviewDate(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}
