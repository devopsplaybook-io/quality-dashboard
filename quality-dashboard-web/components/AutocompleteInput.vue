<template>
  <div class="autocomplete-wrapper" ref="wrapperRef">
    <input
      :value="inputValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @focus="onFocus"
      @click="onClick"
      @blur="onBlur"
      @keydown.down.prevent="highlightNext"
      @keydown.up.prevent="highlightPrev"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="closeDropdown"
    />
    <ul
      v-if="showDropdown && filteredSuggestions.length > 0"
      class="autocomplete-dropdown"
    >
      <li
        v-for="(suggestion, i) in filteredSuggestions"
        :key="suggestion"
        :class="{ highlighted: i === highlightedIndex }"
        @mousedown.prevent="selectSuggestion(suggestion)"
      >
        {{ suggestion }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  select: [value: string];
}>();

const inputValue = ref(props.modelValue);
const showDropdown = ref(false);
const highlightedIndex = ref(-1);
const wrapperRef = ref<HTMLElement | null>(null);

const filteredSuggestions = computed(() => {
  const val = inputValue.value.toLowerCase();
  if (!val) return props.suggestions.slice(0, 10);
  return props.suggestions
    .filter((s) => s.toLowerCase().includes(val))
    .slice(0, 10);
});

watch(
  () => props.modelValue,
  (newVal) => {
    inputValue.value = newVal;
  },
  { immediate: true },
);

function onInput(event: Event): void {
  const val = (event.target as HTMLInputElement).value;
  inputValue.value = val;
  emit("update:modelValue", val);
  showDropdown.value = true;
  highlightedIndex.value = -1;
}

function onFocus(): void {
  showDropdown.value = true;
  highlightedIndex.value = -1;
}

function onClick(): void {
  // Re-open the dropdown when clicking an already-focused input
  // (e.g. after a previous selection closed it)
  if (!showDropdown.value) {
    showDropdown.value = true;
    highlightedIndex.value = -1;
  }
}

function onBlur(): void {
  // Delay to allow click on dropdown item
  setTimeout(() => {
    showDropdown.value = false;
    highlightedIndex.value = -1;
  }, 150);
}

function highlightNext(): void {
  if (!showDropdown.value) {
    showDropdown.value = true;
    return;
  }
  highlightedIndex.value =
    (highlightedIndex.value + 1) % filteredSuggestions.value.length;
}

function highlightPrev(): void {
  if (!showDropdown.value) {
    showDropdown.value = true;
    return;
  }
  highlightedIndex.value =
    (highlightedIndex.value - 1 + filteredSuggestions.value.length) %
    filteredSuggestions.value.length;
}

function selectHighlighted(): void {
  if (
    highlightedIndex.value >= 0 &&
    highlightedIndex.value < filteredSuggestions.value.length
  ) {
    const val = filteredSuggestions.value[highlightedIndex.value] as string;
    if (val) {
      selectSuggestion(val);
    }
  }
}

function selectSuggestion(value: string): void {
  inputValue.value = value;
  emit("update:modelValue", value);
  emit("select", value);
  showDropdown.value = false;
  highlightedIndex.value = -1;
}

function closeDropdown(): void {
  showDropdown.value = false;
  highlightedIndex.value = -1;
}
</script>

<style scoped>
.autocomplete-wrapper {
  position: relative;
  flex: 1;
}
.autocomplete-wrapper input {
  width: 100%;
  padding: 0.25em var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-sizing: border-box;
}
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 4px var(--color-shadow-md);
}
.autocomplete-dropdown li {
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  font-size: var(--font-body);
}
.autocomplete-dropdown li:hover,
.autocomplete-dropdown li.highlighted {
  background: var(--color-primary-light);
  color: var(--color-primary-text);
}
@media (prefers-color-scheme: dark) {
  .autocomplete-wrapper input {
    background: var(--color-bg);
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .autocomplete-dropdown {
    background: var(--color-bg);
    border-color: var(--color-border);
  }
  .autocomplete-dropdown li:hover,
  .autocomplete-dropdown li.highlighted {
    background: var(--color-primary-light);
    color: var(--color-primary-text);
  }
}
</style>
