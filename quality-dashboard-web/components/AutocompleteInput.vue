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
  padding: 0.25em 0.5em;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  box-sizing: border-box;
}
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #cfd8dc;
  border-top: none;
  border-radius: 0 0 4px 4px;
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.autocomplete-dropdown li {
  padding: 0.3em 0.5em;
  cursor: pointer;
  font-size: 0.9em;
}
.autocomplete-dropdown li:hover,
.autocomplete-dropdown li.highlighted {
  background: #e3f2fd;
  color: #1565c0;
}
@media (prefers-color-scheme: dark) {
  .autocomplete-wrapper input {
    background: #1e2a32;
    color: #cfd8dc;
    border-color: #455a64;
  }
  .autocomplete-dropdown {
    background: #1e2a32;
    border-color: #455a64;
  }
  .autocomplete-dropdown li:hover,
  .autocomplete-dropdown li.highlighted {
    background: #1a3a5c;
    color: #82b1ff;
  }
}
</style>
