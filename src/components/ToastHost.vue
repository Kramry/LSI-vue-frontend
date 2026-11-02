<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const message = ref('')
let timeout: ReturnType<typeof setTimeout> | undefined

function showToast(event: Event) {
  const detail = (event as CustomEvent<{ message?: string }>).detail
  message.value = detail?.message || 'Something went wrong.'
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => {
    message.value = ''
  }, 4500)
}

onMounted(() => window.addEventListener('app-toast', showToast))
onUnmounted(() => {
  window.removeEventListener('app-toast', showToast)
  if (timeout) clearTimeout(timeout)
})
</script>

<template>
  <div v-if="message" class="toast" role="alert">{{ message }}</div>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 20;
  max-width: min(420px, calc(100vw - 40px));
  padding: 13px 16px;
  border-radius: 9px;
  color: white;
  background: #b91c1c;
  box-shadow: 0 8px 24px rgb(15 23 42 / 18%);
}
</style>
