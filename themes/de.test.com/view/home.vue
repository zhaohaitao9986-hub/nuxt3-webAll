<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] antialiased">
    <TheHeader />
    <HomeLanding />
    <TheFooter />
  </div>
</template>

<script setup>
import TheHeader from '../components/TheHeader.vue'
import HomeLanding from '../components/HomeLanding.vue'
import TheFooter from '../components/TheFooter.vue'
</script>
