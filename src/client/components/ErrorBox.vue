<script setup lang="ts">
defineProps(['title', 'message']);
</script>

<template>
    <div class="error">
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
    </div>
</template>
<style scoped>
.error {
    margin: 0 auto;
    max-width: 600px;
    background-color: #fff0f0;
    border-radius: 10px;
    padding: 30px 20px;
}

.error h2 {
    color: #e74c3c;
    margin-bottom: 15px;
    font-family: var(--heading-font-family);
}

.error-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin-top: 20px;
}
</style>