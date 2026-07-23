<script setup lang="ts">
import type { VerdictTone } from "~/utils/verdict"
/**
 * The one prominent lead chip at the top of a detail page. It characterises the
 * client or the domain shape — it never rates trust, so it borrows none of the
 * reserved --green/--red. Three tones only:
 *   notable       — amber-soft, the interesting case (accent)
 *   neutral       — panel, an ordinary read
 *   unestablished — dashed, not enough data to say
 */
interface Props {
  tone?: VerdictTone // notable | neutral | unestablished
  label: string
}
withDefaults(defineProps<Props>(), { tone: "neutral" })
</script>

<template>
  <span class="verdict" :class="`verdict--${tone}`">{{ label }}</span>
</template>

<style scoped lang="scss" src="~/styles/components/verdict-chip.scss"></style>
