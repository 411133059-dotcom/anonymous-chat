export const NICKNAME_MAX = 12

// 只允許中文、英文、數字，長度 1–12
const NICKNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9]{1,12}$/u

export function isValidNickname(value: string): boolean {
  return NICKNAME_PATTERN.test(value)
}
