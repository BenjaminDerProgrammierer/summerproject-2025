<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Logo from '../components/Logo.vue';

// Define interfaces for our data structures
interface Attachment {
  id: number;
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}

interface Tag {
  id: string | number;
  name: string;
}

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  attachments: Attachment[];
  category_id?: number;
  category_name?: string;
  tags?: Tag[];
}

const posts = ref<Post[]>([]);
const loading = ref<boolean>(true);
const loadingMore = ref<boolean>(false);
const error = ref<string | null>(null);
const selectedTag = ref<string>('');
const selectedCategory = ref<string>('');
const tags = ref<Tag[]>([]);
const categories = ref<string[]>([]);
const route = useRoute();
const router = useRouter();

// Pagination and sorting state
const currentPage = ref<number>(1);
const totalPosts = ref<number>(0);
const hasMorePosts = ref<boolean>(true);
const sortBy = ref<'date' | 'title' | 'author'>('date');
const sortOrder = ref<'asc' | 'desc'>('desc');
const postsPerPage = 20;


onMounted(async () => {
  await fetchPosts();
  await fetchTagsAndCategories();
  
  // Set up infinite scroll
  setupInfiniteScroll();

  // Check for tag or category in URL params on initial load
  if (route.query.tag && typeof route.query.tag === 'string') {
    selectedTag.value = route.query.tag;
  }
  if (route.query.category && typeof route.query.category === 'string') {
    selectedCategory.value = route.query.category;
  }
});

// Watch for changes in route query parameters
watch(() => route.query.tag, (newTagValue) => {
  selectedTag.value = typeof newTagValue === 'string' ? newTagValue : '';
}, { immediate: true });

watch(() => route.query.category, (newCategoryValue) => {
  selectedCategory.value = typeof newCategoryValue === 'string' ? newCategoryValue : '';
}, { immediate: true });

// Also watch selectedTag and selectedCategory to update the URL
watch(() => selectedTag.value, (newTag) => {
  if (newTag !== route.query.tag) {
    updateUrlParams();
  }
});

watch(() => selectedCategory.value, (newCategory) => {
  if (newCategory !== route.query.category) {
    updateUrlParams();
  }
});

function updateUrlParams(): void {
  // Use the imported router instance directly instead of trying to extract it from route
  const query = { ...route.query };

  if (selectedTag.value) {
    query.tag = selectedTag.value;
  } else {
    delete query.tag;
  }

  if (selectedCategory.value) {
    query.category = selectedCategory.value;
  } else {
    delete query.category;
  }

  router.replace({ query });
}

async function fetchPosts(isLoadingMore = false) {
  try {
    if (!isLoadingMore) {
      loading.value = true;
      currentPage.value = 1;
      posts.value = [];
    } else {
      loadingMore.value = true;
    }

    // Build URL with pagination and sorting parameters
    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: postsPerPage.toString(),
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    });
    
    // Add filter parameters if they exist
    if (selectedTag.value) {
      params.append('tag', selectedTag.value);
    }
    if (selectedCategory.value) {
      params.append('category', selectedCategory.value);
    }

    const response = await fetch(`/api/posts?${params}`);

    if (response.ok) {
      const data = await response.json();
      
      if (isLoadingMore) {
        posts.value = [...posts.value, ...data.posts];
      } else {
        posts.value = data.posts;
      }
      
      totalPosts.value = data.total;
      hasMorePosts.value = posts.value.length < data.total;
    } else if (response.status === 401) {
      // Handle case where site is private and authentication is required
      const errorData = await response.json();
      if (errorData.requiresAuth) {
        error.value = "This site is private. Please log in to view posts.";
      } else {
        error.value = "Authentication required to access content.";
      }
    } else {
      throw new Error('Failed to fetch posts');
    }
  } catch (err: any) {
    console.error('Error fetching posts:', err);
    if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
      error.value = "Unable to connect to the server. The backend service might be down. Please try again later.";
    } else {
      error.value = err.message;
    }
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function fetchTagsAndCategories() {
  try {
    // Fetch all posts to extract tags and categories
    const response = await fetch('/api/posts?limit=1000'); // Get all posts for filtering
    if (response.ok) {
      const data = await response.json();
      const allPosts = data.posts || data; // Handle both new and old API format
      
      // Extract unique tags
      const tagSet = new Set<Tag>();
      allPosts.forEach((post: Post) => {
        post.tags?.forEach((tag: Tag) => {
          if (tag !== null) tagSet.add(tag);
        });
      });
      tags.value = Array.from(tagSet).filter((tag, index, self) =>
        index === self.findIndex((t: Tag) => t.name === tag.name)
      ).sort((a, b) => a.name.localeCompare(b.name));

      // Extract unique categories
      const categorySet = new Set<string>();
      allPosts.forEach((post: Post) => {
        if (post.category_name && post.category_name !== null) {
          categorySet.add(post.category_name);
        }
      });
      categories.value = Array.from(categorySet).sort();
    } else if (response.status === 401) {
      // Site is private, skip tags/categories loading
      console.log('Site is private, skipping tags/categories loading');
    }
  } catch (err) {
    console.error('Error fetching tags and categories:', err);
  }
}

function setupInfiniteScroll() {
  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Load more when user is 100px from bottom
    if (scrollTop + windowHeight >= documentHeight - 100) {
      loadMore();
    }
  };

  window.addEventListener('scroll', handleScroll);
  
  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
  });
}

function loadMore() {
  if (!loadingMore.value && hasMorePosts.value && !loading.value) {
    currentPage.value++;
    fetchPosts(true);
  }
}

function changeSortOrder(newSortBy: 'date' | 'title' | 'author', newSortOrder: 'asc' | 'desc') {
  sortBy.value = newSortBy;
  sortOrder.value = newSortOrder;
  currentPage.value = 1;
  fetchPosts();
}

// Watch for filter changes to refetch posts
watch([selectedTag, selectedCategory], () => {
  currentPage.value = 1;
  fetchPosts();
});

function filterByTag(tag: string) {
  selectedTag.value = tag === selectedTag.value ? '' : tag;
}

function filterByCategory(category: string) {
  selectedCategory.value = category === selectedCategory.value ? '' : category;
}

// For client-side filtering of already loaded posts (now just returns all posts since filtering is server-side)
const filteredPosts = computed(() => {
  return posts.value;
});

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-AT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function truncateContent(content: string, maxLength = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
</script>

<template>
  <Logo />
  <div class="blog-view">
    <h1>Blog Posts</h1>

    <div v-if="loading" class="loading">
      Loading posts...
    </div>

    <div v-else-if="error" class="auth-notice">
      <h2>Welcome!</h2>
      <p>{{ error }}</p>
      <router-link to="/login" class="login-link">Sign In</router-link>
    </div>

    <template v-else>
      <!-- Sorting controls -->
      <div class="sorting-controls">
        <h2>Sort Posts</h2>
        <div class="sort-buttons">
          <button 
            @click="changeSortOrder('date', 'desc')"
            :class="['sort-btn', { active: sortBy === 'date' && sortOrder === 'desc' }]">
            Newest First
          </button>
          <button 
            @click="changeSortOrder('date', 'asc')"
            :class="['sort-btn', { active: sortBy === 'date' && sortOrder === 'asc' }]">
            Oldest First
          </button>
        </div>
      </div>

      <div class="filters-container">
        <!-- Categories filter -->
        <div v-if="categories.length > 0" class="categories-filter">
          <h2>Filter by Category</h2>
          <div class="categories-list">
            <button v-for="category in categories" :key="category" @click="filterByCategory(category)"
              :class="['filter-btn', { active: selectedCategory === category }]">
              {{ category }}
            </button>
          </div>
          <button v-if="selectedCategory" @click="selectedCategory = ''" class="filter-btn clear">
            Clear Category
          </button>
        </div>

        <!-- Tags filter -->
        <div v-if="tags.length > 0" class="tags-filter">
          <h2>Filter by Tag</h2>
          <div class="tags-list">
            <button v-for="tag in tags" :key="typeof tag === 'object' && 'id' in tag ? tag.id : tag" 
              @click="filterByTag(tag.name)"
              :class="['tag-filter-btn', { active: selectedTag === (typeof tag === 'object' && 'name' in tag ? tag.name : tag) }, 'filter-btn']">
              {{ typeof tag === 'object' && 'name' in tag ? tag.name : tag }}
            </button>
          </div>
          <button v-if="selectedTag" @click="selectedTag = ''" class="tag-filter-btn filter-btn clear">
            Clear Tag
          </button>
        </div>
      </div>

      <div v-if="filteredPosts.length === 0" class="no-posts">
        <p>
          <template v-if="selectedCategory && selectedTag">
            No posts with category "{{ selectedCategory }}" and tag "{{ selectedTag }}".
          </template>
          <template v-else-if="selectedCategory">
            No posts with category "{{ selectedCategory }}".
          </template>
          <template v-else-if="selectedTag">
            No posts with tag "{{ selectedTag }}".
          </template>
          <template v-else>
            No posts available yet.
          </template>
        </p>
      </div>

      <div v-else class="posts-grid">
        <div v-for="post in filteredPosts" :key="post.id" class="post-card">
          <div
            v-if="post.attachments && post.attachments.some(a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i))"
            class="post-image">
            <img
              :src="`/uploads/${post.attachments.find(a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i))?.filename}`"
              :alt="post.title">
          </div>
          <div v-else class="post-image placeholder">
            <span class="material-symbols-outlined">article</span>
          </div>

          <div class="post-details">
            <h2>{{ post.title }}</h2>

            <div class="post-meta">
              <span class="author">By {{ post.author }}</span>
              <span class="date">{{ formatDate(post.created_at) }}</span>
            </div>

            <div class="post-categorization">
              <span v-if="post.category_name" class="category-pill" @click="filterByCategory(post.category_name)">
                {{ post.category_name }}
              </span>

              <span v-if="post.tags && post.tags.filter(t => t !== null).length > 0"
                v-for="tag in post.tags.filter(t => t !== null)" :key="typeof tag === 'object' && 'id' in tag ? tag.id : tag" class="tag-pill" 
                @click="filterByTag(typeof tag === 'object' && 'name' in tag ? tag.name : String(tag))">
                {{ typeof tag === 'object' && 'name' in tag ? tag.name : tag }}
              </span>
            </div>

            <p class="post-excerpt">{{ truncateContent(post.content) }}</p>

            <router-link :to="`/post/${post.id}`" class="link-button primary">Read More</router-link>
          </div>
        </div>
      </div>

      <!-- Load More Button and Loading More Indicator -->
      <div v-if="hasMorePosts" class="load-more-container">
        <button v-if="!loadingMore" @click="loadMore" class="load-more-btn">
          Load More Posts
        </button>
        <div v-else class="loading-more">
          Loading more posts...
        </div>
      </div>

      <!-- Posts count indicator -->
      <div class="posts-info">
        <p>Showing {{ filteredPosts.length }} of {{ totalPosts }} posts</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.blog-view {
  margin: 0 auto;
  padding: 30px;

  background: rgb(255, 255, 255)
    radial-gradient(
      1124px 720px at 0% 0%,
      rgb(222, 231, 248) 0%,
      rgba(222, 231, 248, 0) 100%
    )
    no-repeat padding-box fixed;

  min-height: 100vh;
  height: auto;
}

h1 {
  font-family: var(--heading-font-family);
  font-size: 2.5rem;
  margin-bottom: 30px;
  text-align: center;
}

.loading,
.loading-more,
.auth-notice,
.no-posts {
  text-align: center;
  padding: 50px;
  border-radius: 10px;
  margin: 0 auto;
  max-width: 600px;
  background-color: #efefff;
  font-size: 1.3rem;

  &.no-posts {
    margin: 20px auto;
    background-color: #f8f8f8;
  }
  
  &.loading-more {
    padding: 20px;
    margin: 20px auto;
    font-size: 1.1rem;
  }
  
  &.auth-notice {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    h2 {
      margin-bottom: 15px;
      font-size: 1.8rem;
    }
    
    p {
      margin-bottom: 20px;
      font-size: 1.1rem;
    }
  }
}

.login-link {
  display: inline-block;
  padding: 10px 20px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  text-decoration: none;
  border-radius: 25px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
  font-weight: 500;

  &:hover {
    background-color: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
  }
}

img {
  max-width: 100%;
}

.sorting-controls {
  margin-bottom: 30px;
  text-align: center;
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 15px;
  }
}

.sort-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
}

.sort-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--body-font-family);
  font-size: 0.9rem;

  &:hover {
    background-color: #5a6268;
    transform: translateY(-1px);
  }

  &.active {
    background-color: #1e00c5;
    box-shadow: 0 2px 10px rgba(30, 0, 197, 0.3);

    &:hover {
      background-color: #13007d;
    }
  }
}

.filters-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.categories-filter,
.tags-filter {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: start;
  gap: 10px;

  h2 {
    font-size: 1.5rem;
    margin-bottom: 10px;
    text-align: center;
  }
}

.categories-list,
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 5px;
  justify-content: center;
}

.filter-btn {
  background-color: #1e00c5;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  font-family: var(--body-font-family);
  margin-right: 5px;

  &:hover {
    background-color: #13007d;
    transform: translateY(-1px);
  }

  &.active {
    background-color: #0f0066;
    box-shadow: 0 2px 8px rgba(30, 0, 197, 0.4);
  }

  &.tag-filter-btn {
    background-color: #00811e;

    &:hover {
      background-color: #005313;
    }
    
    &.active {
      background-color: #004010;
      box-shadow: 0 2px 8px rgba(0, 129, 30, 0.4);
    }
  }

  &.clear {
    background-color: #e74c3c;
    color: white;

    &:hover {
      background-color: #c0392b;
    }
  }
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.post-card {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
  }
}

.post-image {
  height: 250px;
  overflow: hidden;
}

.post-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.post-card:hover .post-image img {
  transform: scale(1.05);
}

.post-image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f1f1f1;
}

.post-image.placeholder .material-symbols-outlined {
  font-size: 48px;
  color: #aaa;
}

.post-details {
  padding: 20px;
}

.post-details h2 {
  font-family: var(--heading-font-family);
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.post-meta {
  display: flex;
  justify-content: space-between;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 10px;
  font-family: var(--body-font-family);
}

.post-categorization {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.category-pill,
.tag-pill {
  background-color: var(--color-primary);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-primary-hover);
  }

  &.tag-pill {
    background-color: var(--color-accent);
    color: white;

    &:hover {
      background-color: var(--color-accent-hover);
    }
  }
}

.post-excerpt {
  margin-bottom: 20px;
  line-height: 1.5;
  font-family: var(--body-font-family);
}

.load-more-container {
  text-align: center;
  margin: 40px auto;
}

.load-more-btn {
  background: linear-gradient(135deg, #1e00c5, #3a20d8);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1.1rem;
  font-family: var(--body-font-family);
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(30, 0, 197, 0.3);

  &:hover {
    background: linear-gradient(135deg, #13007d, #2a1599);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(30, 0, 197, 0.4);
  }
}

.posts-info {
  text-align: center;
  margin: 30px auto;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 10px;
  max-width: 400px;
  color: #666;
  font-family: var(--body-font-family);
}

@media (max-width: 800px) {
  .posts-grid {
    grid-template-columns: 1fr;
  }
  
  .filters-container {
    grid-template-columns: 1fr;
  }
  
  .sort-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .sort-btn {
    width: 200px;
  }
}
</style>
