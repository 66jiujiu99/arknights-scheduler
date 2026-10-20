<template>
  <span
    class="ak-op"
    :class="{ 'has-skill': skills.length }"
    tabindex="0"
    :aria-label="ariaLabel"
  >
    <i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}
    <small>{{ primarySkill?.name || '' }}</small>
    <span v-if="skills.length" class="ak-op-tip" role="tooltip">
      <span v-for="skill in skills" :key="skill.buffId || skill.name" class="ak-op-skill">
        <strong>
          {{ skill.name }}
          <em v-if="requirement(skill)">{{ requirement(skill) }}</em>
        </strong>
        <span v-if="skill.text || skill.desc">{{ skill.text || skill.desc }}</span>
      </span>
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  op: { type: Object, required: true },
})

const skills = computed(() => {
  if (props.op?.skill) return [props.op.skill]
  const list = Array.isArray(props.op?.skills) ? props.op.skills.filter(Boolean) : []
  const best = new Map()
  for (const skill of list) {
    const key = String(skill.buffId || skill.name || '').replace(/\[\d+\]$/, '')
    const rank = Number(skill.phase || 0) * 1000 + Number(skill.level || 1)
    const prev = best.get(key)
    if (!prev || rank > prev.rank) best.set(key, { skill, rank })
  }
  return [...best.values()].map((x) => x.skill)
})
const primarySkill = computed(() => skills.value[0] || null)
const ariaLabel = computed(() => {
  if (!skills.value.length) return props.op.name
  return props.op.name + '：' + skills.value.map((s) => s.name).join('、')
})

function requirement(skill) {
  const parts = []
  if (Number(skill.phase || 0) > 0) parts.push('精' + skill.phase)
  if (Number(skill.level || 1) > 1) parts.push('Lv' + skill.level)
  return parts.join(' / ')
}
</script>
