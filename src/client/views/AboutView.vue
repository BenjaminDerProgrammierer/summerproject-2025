<script setup lang="ts">
import Logo from '../components/Logo.vue';
import ImageGallery from '../components/ImageGallery.vue';
</script>

<template>
    <div class="about">
        <h1 class="title">
            <Logo inline="true" />
            <span>About us</span>
            <div></div>
        </h1>
        <p>Hier kommst später etwas mehr inhalt hin.</p>
        <ImageGallery />
    </div>
</template>

<style scoped>
.about {
    font-size: 2rem;
    font-family: var(--heading-font-family);
    color: var(--color-secondary);
    padding: 0% 10%;

    h1 {
        font-size: 3rem;
        font-family: var(--heading-font-family);
        color: var(--color-secondary);
        text-align: center;
    }
}

.title {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

@media (max-width: 800px) {
    .about {
        font-size: 1.5rem;
        padding: 0% 5%;
    }

    h1 {
        font-size: 2rem;
    }

}
</style>