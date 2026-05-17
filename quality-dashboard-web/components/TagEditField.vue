<template>
  <span class="tag-edit-field" :class="{ 'is-disabled': disabled }">
    <span class="tag-edit-group">
      <AutocompleteInput
        class="tag-edit-input tag-edit-input-key"
        :model-value="tag"
        :suggestions="tagSuggestions"
        :placeholder="tagPlaceholder"
        :disabled="disabled"
        @update:model-value="(v: string) => $emit('update:tag', v)"
      />
      <span class="tag-edit-sep" aria-hidden="true">=</span>
      <AutocompleteInput
        class="tag-edit-input tag-edit-input-value"
        :model-value="value"
        :suggestions="valueSuggestions"
        :placeholder="valuePlaceholder"
        :disabled="disabled"
        @update:model-value="(v: string) => $emit('update:value', v)"
      />
    </span>
    <button
      v-if="removable && !disabled"
      class="tag-edit-remove"
      type="button"
      title="Remove"
      aria-label="Remove tag"
      @click="$emit('remove')"
    >
      <i class="bi bi-x-lg"></i>
    </button>
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tag: string;
    value: string;
    tagSuggestions: string[];
    valueSuggestions: string[];
    tagPlaceholder?: string;
    valuePlaceholder?: string;
    disabled?: boolean;
    removable?: boolean;
  }>(),
  {
    tagPlaceholder: "tag",
    valuePlaceholder: "value",
    disabled: false,
    removable: false,
  },
);

defineEmits<{
  "update:tag": [value: string];
  "update:value": [value: string];
  remove: [];
}>();
</script>

<style scoped>
.tag-edit-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  flex: 1;
  min-width: 0;
  font-size: 0.9em;
  padding: 0;
  margin: 0;
}
.tag-edit-group {
  display: inline-flex;
  align-items: stretch;
  flex: 1;
  min-width: 0;
  height: 2em;
  border: 1px solid #cfd8dc;
  border-radius: 6px;
  background: #fff;
  position: relative;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.tag-edit-group:hover {
  border-color: #90a4ae;
}
.tag-edit-group:focus-within {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}
.tag-edit-group :deep(.autocomplete-wrapper) {
  flex: 1;
  min-width: 5em;
  display: flex;
}
.tag-edit-group :deep(.autocomplete-wrapper input) {
  width: 100%;
  height: 100%;
  padding: 0 0.6em;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  font-size: 1em;
  line-height: 1.2;
  box-shadow: none;
  outline: none;
  --pico-form-element-spacing-vertical: 0;
  --pico-form-element-spacing-horizontal: 0.6rem;
}
.tag-edit-group :deep(.autocomplete-wrapper input:focus) {
  outline: none;
  box-shadow: none;
}
.tag-edit-group :deep(.autocomplete-dropdown) {
  border-radius: 0 0 6px 6px;
}
.tag-edit-group :deep(.autocomplete-dropdown li) {
  padding: 0.25em 0.6em;
  font-size: 0.95em;
}
.tag-edit-sep {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4em;
  color: #90a4ae;
  font-weight: 500;
  font-size: 0.85em;
  background: #f5f7f8;
  border-left: 1px solid #eceff1;
  border-right: 1px solid #eceff1;
  user-select: none;
}
.tag-edit-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2em;
  width: 2em;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0;
  padding-top: 0.4rem;
  cursor: pointer;
  color: #90a4ae;
  font-size: 1em;
  line-height: 1;
  flex-shrink: 0;
  align-self: center;
  margin-bottom: 0.6em;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.tag-edit-remove:hover {
  color: #c62828;
  background: #ffebee;
}
.tag-edit-remove:focus-visible {
  outline: none;
  border-color: #c62828;
  color: #c62828;
}
.tag-edit-remove .bi {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 0.9em;
}
.tag-edit-field.is-disabled .tag-edit-group {
  background: #f5f7f8;
  opacity: 0.7;
}
@media (prefers-color-scheme: dark) {
  .tag-edit-group {
    background: #1e2a32;
    border-color: #455a64;
  }
  .tag-edit-group:hover {
    border-color: #607d8b;
  }
  .tag-edit-group:focus-within {
    border-color: #64b5f6;
    box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.2);
  }
  .tag-edit-group :deep(.autocomplete-wrapper input) {
    color: #cfd8dc;
  }
  .tag-edit-sep {
    background: #263238;
    color: #607d8b;
    border-left-color: #37474f;
    border-right-color: #37474f;
  }
  .tag-edit-remove {
    color: #78909c;
  }
  .tag-edit-remove:hover {
    color: #ff8a80;
    background: #3e2723;
  }
  .tag-edit-field.is-disabled .tag-edit-group {
    background: #263238;
  }
}
</style>
