<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const categories = ref<Category[]>([]);
const loading = ref(true);
const error = ref(null);
const router = useRouter();

interface Category {
    id: number;
    name: string;
}

onMounted(async () => {
    await fetchCategories();
});

async function fetchCategories() {
    try {
        const response = await fetch('/api/posts/categories');

        if (response.ok) {
            categories.value = await response.json();
            // Limit to 5 categories max
            categories.value = categories.value.slice(0, 5);
        } else {
            throw new Error('Failed to fetch categories');
        }
    } catch (err: any) {
        console.error('Error fetching categories:', err);
        error.value = err.message;
    } finally {
        loading.value = false;
    }
}

function goToCategory(category: Category) {
    router.push({
        path: '/blog',
        query: { category: category.name }
    });
}
</script>

<template>
    <div class="latest-categories">
        <div v-if="loading" class="loading">
            Loading categories...
        </div>

        <div v-else-if="error" class="error">
            {{ error }}
        </div>

        <div v-else-if="categories.length === 0" class="no-categories">
            <p>No categories available yet.</p>
        </div>

        <ul v-else class="category-list">
            <li v-for="category in categories" :key="category.id" @click="goToCategory(category)">
                {{ category.name }}
            </li>
        </ul>
    </div>
</template>

<style scoped>
ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

ul li {
  font-size: 18px;
  display: flex;
  align-items: center;
}

ul li::before {
  content: '';
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 0.5em;
  background: url('/assets/icons/IcSharpLocationOn.svg') no-repeat center;
  background-size: contain;
  filter: brightness(0) invert(1);
}

ul li a {
  text-decoration: none;
  color: #ddffdd;
  font-family: var(--body-font-family);
  transition: color 0.1s ease;

  &:hover {
    color: var(--color-primary);
  }
}
</style>