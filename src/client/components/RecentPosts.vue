<!-- A grid of Posts to showcase recent activity - For use on the Home page. -->
<script setup lang="ts">
import PostCard from './PostCard.vue';
import { ref, onMounted } from 'vue';
import type { Post } from '../types/Post';

const posts = ref<Post[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Define emits to communicate with parent
const emit = defineEmits<{
  authError: [hasAuthError: boolean]
  postsLoaded: [hasPosts: boolean]
}>();


onMounted(async () => {
    await fetchRecentPosts();
});

async function fetchRecentPosts() {
    try {
        // Request 6 most recent posts with proper pagination
        const response = await fetch(`/api/posts?limit=6&sortBy=date&sortOrder=desc`);

        if (response.ok) {
            const data = await response.json();
            // The API now returns an object with posts array and pagination info
            if (data.posts && Array.isArray(data.posts)) {
                posts.value = data.posts;
            } else {
                // Fallback for older API format (if still used somewhere)
                posts.value = Array.isArray(data) ? data.slice(0, 6) : [];
            }
        } else if (response.status === 401) {
            // Handle case where site is private and authentication is required
            const errorData = await response.json();
            if (errorData.requiresAuth) {
                error.value = "Please log in to view posts.";
            } else {
                error.value = "Authentication required to access content.";
            }
            emit('authError', true);
        } else {
            throw new Error('Failed to fetch posts');
        }
    } catch (err: any) {
        console.error('Error fetching recent posts:', err);
        // Provide a user-friendly error message
        if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
            error.value = "Unable to connect to the server. Please try again later.";
        } else {
            error.value = "Failed to load recent posts.";
        }
        emit('authError', false);
    } finally {
        loading.value = false;
        // Emit whether we have posts
        emit('postsLoaded', posts.value.length > 0);
    }
}
</script>

<template>
    <div id="recent-post-list">
        <div v-if="loading" class="loading">
            Loading posts...
        </div>

        <div v-else-if="error" class="auth-notice">
            <h2>Welcome!</h2>
            <p>{{ error }}</p>
            <router-link to="/login" class="login-link">Sign In</router-link>
        </div>

        <div v-else-if="posts.length === 0" class="no-posts">
            <p>No posts available yet.</p>
        </div>

        <template v-else>
            <PostCard v-for="post in posts" :key="post.id" :post="post" />
        </template>
    </div>
</template>

<style scoped>
#recent-post-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.loading,
.auth-notice,
.no-posts {
    text-align: center;
    padding: 20px;
    width: 80%;
    margin: 0 auto;
    border-radius: 10px;
}

.no-posts {
    background-color: #f8f8f8;
}

.auth-notice {
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

@media (min-width: 800px) {
    #recent-post-list {
        flex-direction: row;
        flex-wrap: wrap;
    }
}
</style>
