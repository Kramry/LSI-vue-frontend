<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <main class="coming-soon">
    <h1>{{ title }}</h1>
    <p>This screen will be connected to the backend in the next integration phase.</p>
  </main>
</template>

<style scoped>
.coming-soon {
  padding: 24px;
  border: 1px solid #e5eaf1;
  border-radius: 12px;
  background: white;
}

.coming-soon p {
  color: #64748b;
}
</style>
