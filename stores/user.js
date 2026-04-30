import { defineStore } from 'pinia'

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    user: null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },
  actions: {
    hydrateFromStorage() {
      if (!import.meta.client) {
        return
      }
      const t = localStorage.getItem(TOKEN_KEY) || ''
      const raw = localStorage.getItem(USER_KEY)
      this.token = t
      if (raw) {
        try {
          this.user = JSON.parse(raw)
        }
        catch {
          this.user = null
        }
      }
      else {
        this.user = null
      }
    },
    setAuth(token, user) {
      this.token = token || ''
      this.user = user || null
      if (import.meta.client) {
        if (token) {
          localStorage.setItem(TOKEN_KEY, token)
        }
        else {
          localStorage.removeItem(TOKEN_KEY)
        }
        if (user) {
          localStorage.setItem(USER_KEY, JSON.stringify(user))
        }
        else {
          localStorage.removeItem(USER_KEY)
        }
      }
    },
    logout() {
      this.setAuth('', null)
    },
  },
})
