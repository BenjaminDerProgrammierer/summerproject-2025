<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { Root } from 'react-dom/client';

const host = useTemplateRef<HTMLDivElement>('host');
const loading = ref(true);
const error = ref<string | null>(null);
let reactRoot: Root | undefined;

onMounted(async () => {
  try {
    const response = await fetch('/api/admin/studio/session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(response.status === 404
        ? 'Database Studio is disabled.'
        : 'You are not authorized to use Database Studio.');
    }

    const data = await response.json() as { csrfToken?: unknown };
    if (typeof data.csrfToken !== 'string') {
      throw new Error('Database Studio did not return a valid security token.');
    }

    const [{ createElement }, { createRoot }, { default: StudioApp }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('../studio/StudioApp'),
    ]);

    if (!host.value) return;
    reactRoot = createRoot(host.value);
    reactRoot.render(createElement(StudioApp, { csrfToken: data.csrfToken }));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load Database Studio.';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  reactRoot?.unmount();
});
</script>

<template>
  <section class="studio-island" aria-label="Database Studio">
    <p v-if="loading" class="studio-state">Loading Database Studio…</p>
    <p v-else-if="error" class="studio-state studio-error" role="alert">{{ error }}</p>
    <div v-show="!loading && !error" ref="host" class="studio-host"></div>
  </section>
</template>

<style scoped>
.studio-island,
.studio-host {
  min-height: 70vh;
  width: 100%;
}

.studio-island {
  overflow: hidden;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.studio-state {
  padding: 2rem;
  text-align: center;
}

.studio-error {
  color: #b42318;
}
</style>
