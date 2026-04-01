<template>
  <div class="error-page">
    <div class="error-container">
      <div class="error-icon">
        <svg v-if="error.statusCode === 404" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="90" fill="#E8F4FD" />
          <path d="M70 85C70 70 82 60 100 60C118 60 130 70 130 85C130 100 118 110 100 110C95 110 90 108 85 105"
            stroke="#5B8DEF" stroke-width="6" stroke-linecap="round" />
          <circle cx="80" cy="80" r="6" fill="#5B8DEF" />
          <circle cx="120" cy="80" r="6" fill="#5B8DEF" />
          <path d="M100 140L90 130M100 140L110 130" stroke="#5B8DEF" stroke-width="4" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="90" fill="#FEF2F2" />
          <circle cx="100" cy="70" r="30" stroke="#EF4444" stroke-width="6" fill="none" />
          <path d="M100 115V135" stroke="#EF4444" stroke-width="6" stroke-linecap="round" />
          <circle cx="100" cy="150" r="4" fill="#EF4444" />
          <circle cx="80" cy="95" r="4" fill="#EF4444" />
          <circle cx="120" cy="95" r="4" fill="#EF4444" />
        </svg>
      </div>

      <h1 class="error-code">{{ error.statusCode }}</h1>
      <h2 class="error-title">{{ errorTitle }}</h2>
      <p class="error-message">{{ error.message }}</p>

      <div class="error-actions">
        <button class="btn btn-primary" @click="goHome">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Back to Home
        </button>
        <button class="btn btn-secondary" @click="reloadPage">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  error: Object
})

const errorTitle = computed(() => {
  if (props.error.statusCode === 404) {
    return 'Page Not Found'
  }
  return 'Server Error'
})

const goHome = () => {
  clearError({ redirect: '/' })
}

const reloadPage = () => {
  window.location.reload()
}

useHead({
  title: `Error - ${props.error.statusCode}`,
  script: [
    {
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=G-Q07QBT75PN'
    },
    {
      innerHTML: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-Q07QBT75PN');
      `
    }
  ]
})
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.error-container {
  background: white;
  border-radius: 24px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 480px;
  width: 100%;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-icon {
  width: 160px;
  height: 160px;
  margin: 0 auto 30px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

.error-code {
  font-size: 72px;
  font-weight: 800;
  color: #1f2937;
  margin: 0;
  line-height: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #374151;
  margin: 16px 0;
}

.error-message {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 40px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5);
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
  transform: translateY(-2px);
}

@media (max-width: 480px) {
  .error-container {
    padding: 40px 24px;
  }

  .error-code {
    font-size: 56px;
  }

  .error-title {
    font-size: 20px;
  }

  .error-icon {
    width: 120px;
    height: 120px;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>