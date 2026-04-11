<script setup lang="ts">
import type { Extension } from '@codemirror/state'
import { computed, ref, toRef } from 'vue'
import { useCodemirror } from '../composables/useCodemirror'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    language?: 'python' | 'markdown' | 'raw'
    readOnly?: boolean
    lineNumbers?: boolean
    lineWrapping?: boolean
    indentUnit?: number
    tabSize?: number
    placeholder?: string
    autofocus?: boolean
    extensions?: Extension[]
    dark?: boolean
  }>(),
  {
    modelValue: '',
    language: 'python',
    readOnly: false,
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 4,
    tabSize: 4,
    placeholder: '',
    autofocus: false,
    extensions: () => [],
    dark: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  execute: [advance: boolean]
  split: [cursorOffset: number]
  focus: []
  blur: []
  cursor: [{ line: number; col: number }]
  navigateUp: []
  navigateDown: []
}>()

const containerRef = ref<HTMLElement | null>(null)

const modelValueRef = toRef(props, 'modelValue')
const languageRef = toRef(props, 'language')
const readOnlyRef = toRef(props, 'readOnly')
const lineNumbersRef = toRef(props, 'lineNumbers')
const lineWrappingRef = toRef(props, 'lineWrapping')
const indentUnitRef = toRef(props, 'indentUnit')
const tabSizeRef = toRef(props, 'tabSize')
const placeholderRef = toRef(props, 'placeholder')
const autofocusRef = toRef(props, 'autofocus')
const extensionsRef = computed(() => props.extensions)
const darkRef = toRef(props, 'dark')

const { focus, blur } = useCodemirror(containerRef, {
  modelValue: modelValueRef,
  language: languageRef,
  readOnly: readOnlyRef,
  lineNumbers: lineNumbersRef,
  lineWrapping: lineWrappingRef,
  indentUnit: indentUnitRef,
  tabSize: tabSizeRef,
  placeholder: placeholderRef,
  autofocus: autofocusRef,
  extensions: extensionsRef,
  dark: darkRef,
  onUpdate: (value) => emit('update:modelValue', value),
  onExecute: (advance) => emit('execute', advance),
  onSplitCell: (cursorOffset) => emit('split', cursorOffset),
  onFocus: () => emit('focus'),
  onBlur: () => emit('blur'),
  onCursor: (cursor) => emit('cursor', cursor),
  onNavigateUp: () => emit('navigateUp'),
  onNavigateDown: () => emit('navigateDown'),
})

defineExpose({
  focus,
  blur,
})
</script>

<template>
  <div ref="containerRef" class="vuepyter-code-editor" />
</template>

<style scoped>
.vuepyter-code-editor {
  min-height: 2.25rem;
}
</style>
