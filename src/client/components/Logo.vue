<!-- A Logo component for use on any Page. -->
<script>
export default {
    props: {
        inline: {
            type: Boolean,
            default: false
        }
    }
}
</script>

<template>
    <router-link to="/" class="logo" :class="{ 'logo--inline': inline }">
        <img :src="`/icon/transparent.png`" alt="Logo">
        <span>WEBonTour</span>
    </router-link>
</template>

<style scoped>
.logo {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: black;
    text-decoration: none;
    font-size: min(3vw, 32px);
}

.logo--inline {
    position: relative;
    display: inline-flex;
    top: auto;
    left: auto;
}

.logo img {
    width: 1.5em;
    aspect-ratio: 1;
}

.logo span {
    font-size: 1em;
    font-weight: bold;
    font-family: var(--heading-font-family);
}
</style>
