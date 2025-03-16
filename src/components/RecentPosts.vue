<script setup>
import ListPost from './ListPost.vue';
</script>

<template>
    <div id="recent-post-list">
        <ListPost/>
        <ListPost/>
        <ListPost/>
        <ListPost/>
        <ListPost/>
    </div>
</template>

<style>
#recent-post-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

@media (min-width: 768px) {
    #recent-post-list {
        flex-direction: row;
        flex-wrap: wrap;
    }
}
</style>