<template>
  <div :class="`ak-alert ak-alert-${type}`">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  type: { type: String, default: 'info' },
})
</script>
