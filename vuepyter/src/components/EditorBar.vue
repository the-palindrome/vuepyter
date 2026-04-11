<script setup lang="ts">
import { computed, useSlots } from 'vue'
import type { CellType, KernelStatus } from '../types'

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
    status?: KernelStatus
    activeCellType?: CellType
    cellTypes?: CellType[]
    locale?: Record<string, string>
  }>(),
  {
    readOnly: false,
    status: 'loading',
    activeCellType: 'code',
    cellTypes: () => ['code', 'markdown', 'raw'],
    locale: () => ({}),
  },
)

const emit = defineEmits<{
  addCell: [type: CellType]
  deleteActive: []
  setCellType: [type: CellType]
  runActive: []
  runAll: []
  restartKernel: []
  interrupt: []
  clearOutputs: []
}>()

const slots = useSlots()
const resolvedLocale = computed(() => props.locale ?? {})

const statusText = computed(() => {
  if (props.status === 'ready') {
    return resolvedLocale.value.kernelReady ?? 'Ready'
  }
  if (props.status === 'busy') {
    return resolvedLocale.value.kernelBusy ?? 'Busy'
  }
  if (props.status === 'error') {
    return resolvedLocale.value.kernelError ?? 'Error'
  }
  return resolvedLocale.value.kernelLoading ?? 'Loading'
})

const statusClass = computed(() => `is-${props.status}`)

const hasLeftSlot = computed(() => Boolean(slots['bar-left']))
const hasCenterSlot = computed(() => Boolean(slots['bar-center']))
const hasRightSlot = computed(() => Boolean(slots['bar-right']))
</script>

<template>
  <slot name="bar-prepend" />
  <div class="vuepyter-editor-bar">
    <div class="vuepyter-editor-group">
      <slot name="bar-left">
        <template v-if="!hasLeftSlot">
          <button type="button" :disabled="readOnly" @click="emit('addCell', 'code')">
            {{ resolvedLocale.addCodeCell ?? 'Add code' }}
          </button>
          <button type="button" :disabled="readOnly" @click="emit('addCell', 'markdown')">
            {{ resolvedLocale.addMarkdownCell ?? 'Add markdown' }}
          </button>
          <button type="button" :disabled="readOnly" @click="emit('deleteActive')">
            {{ resolvedLocale.deleteCell ?? 'Delete cell' }}
          </button>
          <label class="vuepyter-cell-type">
            <span>{{ resolvedLocale.cellType ?? 'Cell type' }}</span>
            <select
              :value="activeCellType"
              :disabled="readOnly"
              @change="emit('setCellType', ($event.target as HTMLSelectElement).value as CellType)"
            >
              <option v-for="type in cellTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </label>
        </template>
      </slot>
    </div>

    <div class="vuepyter-editor-group">
      <slot name="bar-center">
        <template v-if="!hasCenterSlot">
          <button type="button" @click="emit('runActive')">{{ resolvedLocale.runCell ?? 'Run cell' }}</button>
          <button type="button" @click="emit('runAll')">{{ resolvedLocale.runAllCells ?? 'Run all' }}</button>
          <button type="button" @click="emit('restartKernel')">{{ resolvedLocale.restartKernel ?? 'Restart kernel' }}</button>
          <button type="button" @click="emit('interrupt')">{{ resolvedLocale.interrupt ?? 'Interrupt' }}</button>
        </template>
      </slot>
    </div>

    <div class="vuepyter-editor-group">
      <slot name="bar-right">
        <template v-if="!hasRightSlot">
          <div class="vuepyter-status" :class="statusClass">
            <span class="vuepyter-status-dot" />
            <span>{{ statusText }}</span>
          </div>
          <button type="button" @click="emit('clearOutputs')">{{ resolvedLocale.clearOutputs ?? 'Clear outputs' }}</button>
        </template>
      </slot>
    </div>
  </div>
  <slot name="bar-append" />
</template>

<style scoped>
.vuepyter-editor-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
  background: var(--vuepyter-toolbar-bg);
  border: 1px solid var(--vuepyter-cell-border);
  border-radius: 0.45rem;
  padding: 0.5rem;
}

.vuepyter-editor-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.vuepyter-editor-group:nth-child(2) {
  justify-content: center;
}

.vuepyter-editor-group:nth-child(3) {
  justify-content: flex-end;
}

button,
select {
  border: 1px solid var(--vuepyter-cell-border);
  background: var(--vuepyter-button-bg);
  color: var(--vuepyter-text);
  border-radius: 0.35rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
}

button:hover:not(:disabled),
select:hover:not(:disabled) {
  background: var(--vuepyter-button-hover-bg);
}

button:disabled,
select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vuepyter-cell-type {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--vuepyter-text-secondary);
}

.vuepyter-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.vuepyter-status-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 9999px;
  background: var(--vuepyter-status-ready);
}

.vuepyter-status.is-loading .vuepyter-status-dot {
  background: var(--vuepyter-text-secondary);
}

.vuepyter-status.is-busy .vuepyter-status-dot {
  background: var(--vuepyter-status-busy);
}

.vuepyter-status.is-error .vuepyter-status-dot {
  background: var(--vuepyter-status-error);
}
</style>
