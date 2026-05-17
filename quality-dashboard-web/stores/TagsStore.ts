import { AuthService } from "~~/services/AuthService";
import Config from "~~/services/Config";
import { handleError } from "~~/services/EventBus";
import axios from "axios";

export interface TagAggregate {
  tag: string;
  values: string[];
}

export const TagsStore = defineStore("TagsStore", {
  state: () => ({
    allTags: [] as TagAggregate[],
    lastError: null as string | null,
    isLoaded: false,
  }),

  getters: {
    /** All unique tag names currently known. */
    tagNames(): string[] {
      return this.allTags.map((t) => t.tag);
    },

    /** Lookup known values for a given tag name. */
    valuesForTag(): (tagName: string) => string[] {
      return (tagName: string) => {
        const agg = this.allTags.find((t) => t.tag === tagName);
        return agg ? agg.values : [];
      };
    },
  },

  actions: {
    async fetchAll(): Promise<void> {
      try {
        const res = await axios.get(
          `${(await Config.get()).SERVER_URL}/tags`,
          await AuthService.getAuthHeader(),
        );
        this.allTags = (res.data.tags || []) as TagAggregate[];
        this.lastError = null;
        this.isLoaded = true;
      } catch (err) {
        this.lastError = (err as Error).message;
        handleError(err);
      }
    },

    /** Only fetch tags if they have not been loaded yet. */
    async loadIfNeeded(): Promise<void> {
      if (!this.isLoaded || this.allTags.length === 0) {
        await this.fetchAll();
      }
    },

    async setTagsForReport(
      key: string,
      tags: { tag: string; value: string }[],
    ): Promise<void> {
      await axios.put(
        `${(await Config.get()).SERVER_URL}/tags/reports/${encodeURIComponent(key)}`,
        { tags },
        await AuthService.getAuthHeader(),
      );
    },

    async setTag(key: string, tag: string, value: string): Promise<void> {
      await axios.put(
        `${(await Config.get()).SERVER_URL}/tags/reports/${encodeURIComponent(key)}/${encodeURIComponent(tag)}`,
        { value },
        await AuthService.getAuthHeader(),
      );
    },

    async removeTag(key: string, tag: string): Promise<void> {
      await axios.delete(
        `${(await Config.get()).SERVER_URL}/tags/reports/${encodeURIComponent(key)}/${encodeURIComponent(tag)}`,
        await AuthService.getAuthHeader(),
      );
    },
  },
});

if (import.meta.hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import.meta.hot.accept(acceptHMRUpdate(TagsStore as any, import.meta.hot));
}
