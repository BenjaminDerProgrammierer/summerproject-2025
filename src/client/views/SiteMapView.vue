<!-- Display all sites in the router in a list -->
<script setup lang="ts">
import { useRouter } from 'vue-router';

// get all routes from the router
const allRoutes = useRouter().getRoutes();
</script>

<template>
  <div class="site-map">
    <h1>Site Map</h1>
    <ul>
      <li v-for="(route, index) in allRoutes" :key="index">
        <router-link :to="route.path">{{ route.name }}</router-link>
      </li>
    </ul>
  </div>
</template>
