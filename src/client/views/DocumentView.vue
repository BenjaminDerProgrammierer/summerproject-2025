<script setup lang="ts">
// get URL parameter "f"
import { useRoute } from 'vue-router';
import { ref, onMounted } from 'vue';
import ErrorBox from '../components/ErrorBox.vue';
import Logo from '../components/Logo.vue';
import MarkdownRenderer from '../components/MarkdownRenderer.vue';

const route = useRoute();
const f = route.query.f;
console.log(f);

// fetch document from backend

const document = ref<string | null>(null);
const apiError = ref<Error | null>(null);

onMounted(async () => {
    try {
        const response = await fetch(`/api/document/${f}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        document.value = await response.text();
    } catch (error) {
        console.error('Error fetching document:', error);
        apiError.value = error instanceof Error ? error : new Error(String(error));
    }
});
</script>

<template>
    <Logo />
    <div id="container">
        <h1>Document Viewer</h1>
        <MarkdownRenderer v-if="document" :markdown="document" />
        <ErrorBox v-else-if="apiError" title="Error" :message="apiError.message" />
    </div>
</template>

<style scoped>
#container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #f0f0f0;
}

h1 {
    margin: 40px 0;
}

.markdown-renderer {
    width: 80%;
    margin: 20px auto;
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    max-width: 1200px;
}

@media screen and (max-width: 800px) {
    h1 {
        margin: 30px 0 20px 0;
    }
    .markdown-renderer {
        border-radius: 0;
        width: 100%;
        margin: 0;
    }
}
</style>