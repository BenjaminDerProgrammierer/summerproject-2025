<script setup lang="ts">
import { ref } from 'vue';

const images = ref([
    '20180804_024529.jpg',
    '20220731_174021.jpg',
    '2022-08-13_0151.jpg',
    '2023-07-17_0047.jpg',
    '2023-07-18_eva_0010.jpg',
    '2023-07-22_eva_0039.jpg',
    '2023-07-23_grcam_0122.jpg',
    '2023-07-26_grcam_0082-1.jpg',
    '2023-07-30_werner_0005.jpg',
    '2023-08-06_grcam_0003.jpg',
    '2023-08-08_eva_0025.jpg',
]);

const lightboxVisible = ref(false);
const lightboxIndex = ref(0);

const openLightbox = (index: number) => {
    lightboxIndex.value = index;
    lightboxVisible.value = true;
};

</script>

<template>
    <div class="image-gallery">
        <img v-for="(image, index) in images" :key="index" :src="`/assets/images/slides/${image}`"
            :alt="String(index + 1)" v-on:click="openLightbox(index)" />
    </div>
    <div class="lightbox" v-if="lightboxVisible">
        <span class="close" @click="lightboxVisible = false">&times;</span>
        <img :src="`/assets/images/slides/${images[lightboxIndex]}`" :alt="`Popup ${lightboxIndex + 1}`" />
    </div>
</template>

<style>
.image-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    padding: 10px;
    border: 2px solid #bbb;
    border-radius: 10px;
    background-color: #ccc;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        border-radius: 10px;
        filter: grayscale(0.8);
        transition: filter 0.3s ease;

        &:hover {
            filter: grayscale(0);
        }
    }
}

.lightbox {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;

    img {
        width: 80%;
        max-height: 80%;
    }

    .close {
        position: absolute;
        top: 20px;
        right: 30px;
        color: white;
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
    }
}


@media (max-width: 800px) {
    .image-gallery {
        grid-template-columns: 1fr;
        gap: 5px;
        padding: 5px;

        img {
            filter: none;
        }
    }
}
</style>
