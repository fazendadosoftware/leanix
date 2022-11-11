<template>
  <h1>{{ msg }}</h1>
  <p>
    {{ date }}
  </p>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ msg: string }>()

const date = ref(new Date())
setInterval(() => { date.value = new Date() }, 1000)
</script>
