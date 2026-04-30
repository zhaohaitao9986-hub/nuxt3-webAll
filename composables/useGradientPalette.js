const PALETTE = [
  ['#7C5CFF', '#22D3EE'], // primary → accent
  ['#F472B6', '#7C5CFF'], // signal → primary
  ['#0EA5E9', '#6366F1'],
  ['#22C55E', '#22D3EE'],
  ['#F59E0B', '#F472B6'],
  ['#8B5CF6', '#EC4899'],
  ['#06B6D4', '#8B5CF6'],
  ['#10B981', '#06B6D4'],
]

// 简单字符串哈希 —— 保证同一 id/name 每次落到同一配色
const hashCode = (str) => {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function useGradientPalette() {
  const pickByKey = (key) => {
    const i = hashCode(key) % PALETTE.length
    return PALETTE[i]
  }
  const gradientByKey = (key) => {
    const [a, b] = pickByKey(key)
    return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
  }
  return { pickByKey, gradientByKey, PALETTE }
}
