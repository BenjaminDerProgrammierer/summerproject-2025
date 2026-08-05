<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  is_deleted: boolean;
  post_title: string;
  post_id: number;
  author: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

const comments = ref<Comment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const page = ref(1);
const limit = ref(20);
const hasMore = ref(true);

const canAccessComments = computed(() => {
  return currentUser.value && ['writer', 'moderator', 'admin'].includes(currentUser.value.role);
});

onMounted(async () => {
  await fetchCurrentUser();
  if (canAccessComments.value) {
    await fetchComments();
  }
});

async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    if (response.ok) {
      currentUser.value = await response.json();
    }
  } catch (err) {
    console.error('Error fetching user:', err);
  }
}

async function fetchComments(append = false) {
  if (!canAccessComments.value) return;
  
  try {
    loading.value = true;
    error.value = null;
    
    const offset = append ? comments.value.length : 0;
    const response = await fetch(`/api/comments/recent?limit=${limit.value}&offset=${offset}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const newComments = await response.json();
      
      if (append) {
        comments.value.push(...newComments);
      } else {
        comments.value = newComments;
      }
      
      hasMore.value = newComments.length === limit.value;
    } else {
      throw new Error('Failed to fetch comments');
    }
  } catch (err) {
    console.error('Error fetching comments:', err);
    error.value = 'Failed to load comments';
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  page.value++;
  await fetchComments(true);
}

async function deleteComment(commentId: number) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
  try {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Remove from local list
      comments.value = comments.value.filter(c => c.id !== commentId);
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete comment');
    }
  } catch (err) {
    console.error('Error deleting comment:', err);
    error.value = err instanceof Error ? err.message : 'Failed to delete comment';
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('de-AT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncateContent(content: string, maxLength = 100): string {
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
}

function goToPost(postId: number) {
  window.open(`/post/${postId}`, '_blank');
}
</script>

<template>
  <div class="comments-management">
    <div class="header">
      <h3>Recent Comments</h3>
      <button @click="fetchComments(false)" class="btn btn-secondary" :disabled="loading">
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>
    
    <div v-if="!canAccessComments" class="access-denied">
      <p>You don't have permission to view comments.</p>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-else-if="loading && comments.length === 0" class="loading">
      Loading comments...
    </div>
    
    <div v-else-if="comments.length === 0" class="no-comments">
      No comments found.
    </div>
    
    <div v-else class="comments-list">
      <div 
        v-for="comment in comments" 
        :key="comment.id" 
        class="comment-item"
        :class="{ deleted: comment.is_deleted }"
      >
        <div class="comment-header">
          <div class="comment-meta">
            <span class="author">{{ comment.author || 'Unknown User' }}</span>
            <span class="date">{{ formatDate(comment.created_at) }}</span>
            <span v-if="comment.is_deleted" class="deleted-badge">DELETED</span>
          </div>
          <div class="comment-actions">
            <button 
              @click="goToPost(comment.post_id)" 
              class="btn btn-sm btn-primary"
              title="View Post"
            >
              View Post
            </button>
            <button 
              v-if="!comment.is_deleted && ['admin', 'moderator'].includes(currentUser?.role || '')"
              @click="deleteComment(comment.id)" 
              class="btn btn-sm btn-danger"
              title="Delete Comment"
            >
              Delete
            </button>
          </div>
        </div>
        
        <div class="comment-content">
          <div class="post-title">
            <strong>Post:</strong> {{ comment.post_title }}
          </div>
          <div class="comment-text" :class="{ deleted: comment.is_deleted }">
            {{ comment.is_deleted ? '[This comment has been deleted]' : truncateContent(comment.content) }}
          </div>
        </div>
      </div>
      
      <div v-if="hasMore" class="load-more">
        <button 
          @click="loadMore" 
          class="btn btn-secondary"
          :disabled="loading"
        >
          {{ loading ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comments-management {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h3 {
  margin: 0;
  color: #2c3e50;
}

.access-denied {
  text-align: center;
  padding: 40px 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c66;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.loading {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.no-comments {
  text-align: center;
  padding: 40px 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.comment-item {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  transition: box-shadow 0.2s ease;
}

.comment-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.comment-item.deleted {
  background-color: #f5f5f5;
  border-color: #ddd;
  opacity: 0.7;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
}

.author {
  font-weight: 600;
  color: var(--color-primary);
}

.date {
  color: #666;
}

.deleted-badge {
  background-color: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
}

.comment-actions {
  display: flex;
  gap: 8px;
}

.comment-content .post-title {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 8px;
}

.comment-text {
  line-height: 1.5;
  color: #2c3e50;
}

.comment-text.deleted {
  color: #999;
  font-style: italic;
}

.load-more {
  text-align: center;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .comment-meta {
    justify-content: center;
  }
  
  .comment-actions {
    justify-content: center;
  }
}
</style>
