<template>
  <h1>{{ msg }}</h1>
  <p>
    {{ date }}
  </p>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  msg: {
    type: String,
    required: true
  }
})

const date = ref(new Date())
setInterval(() => { date.value = new Date() }, 1000)
</script>
