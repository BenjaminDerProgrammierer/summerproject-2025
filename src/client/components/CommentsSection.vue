<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface Comment {
  id: number;
  content: string;
  author: string;
  author_id: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  parent_id?: number;
  replies: Comment[];
}

interface User {
  id: number;
  username: string;
  role: string;
}

interface Props {
  postId: number;
}

const props = defineProps<Props>();
const router = useRouter();

const comments = ref<Comment[]>([]);
const newComment = ref('');
const replyContent = ref<{ [key: number]: string }>({});
const editContent = ref<{ [key: number]: string }>({});
const showReplyForm = ref<{ [key: number]: boolean }>({});
const showEditForm = ref<{ [key: number]: boolean }>({});
const loading = ref(false);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);

const isLoggedIn = computed(() => currentUser.value !== null);

onMounted(async () => {
  await Promise.all([fetchComments(), fetchCurrentUser()]);
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
    // User not logged in, which is fine for viewing comments
  }
}

async function fetchComments() {
  try {
    loading.value = true;
    error.value = null;
    
    const response = await fetch(`/api/comments/post/${props.postId}`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      comments.value = await response.json();
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

async function submitComment() {
  if (!newComment.value.trim()) return;
  
  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        postId: props.postId,
        content: newComment.value
      })
    });
    
    if (response.ok) {
      newComment.value = '';
      await fetchComments();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to post comment');
    }
  } catch (err) {
    console.error('Error posting comment:', err);
    error.value = err instanceof Error ? err.message : 'Failed to post comment';
  }
}

async function submitReply(parentId: number) {
  const content = replyContent.value[parentId];
  if (!content?.trim()) return;
  
  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        postId: props.postId,
        content: content,
        parentId: parentId
      })
    });
    
    if (response.ok) {
      replyContent.value[parentId] = '';
      showReplyForm.value[parentId] = false;
      await fetchComments();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to post reply');
    }
  } catch (err) {
    console.error('Error posting reply:', err);
    error.value = err instanceof Error ? err.message : 'Failed to post reply';
  }
}

async function editComment(commentId: number) {
  const content = editContent.value[commentId];
  if (!content?.trim()) return;
  
  try {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        content: content
      })
    });
    
    if (response.ok) {
      showEditForm.value[commentId] = false;
      await fetchComments();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to edit comment');
    }
  } catch (err) {
    console.error('Error editing comment:', err);
    error.value = err instanceof Error ? err.message : 'Failed to edit comment';
  }
}

async function deleteComment(commentId: number) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
  try {
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      await fetchComments();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete comment');
    }
  } catch (err) {
    console.error('Error deleting comment:', err);
    error.value = err instanceof Error ? err.message : 'Failed to delete comment';
  }
}

function toggleReplyForm(commentId: number) {
  showReplyForm.value[commentId] = !showReplyForm.value[commentId];
  if (showReplyForm.value[commentId] && !replyContent.value[commentId]) {
    replyContent.value[commentId] = '';
  }
}

function toggleEditForm(commentId: number, currentContent: string) {
  showEditForm.value[commentId] = !showEditForm.value[commentId];
  if (showEditForm.value[commentId]) {
    editContent.value[commentId] = currentContent;
  }
}

function canModifyComment(comment: Comment): boolean {
  if (!currentUser.value) return false;
  return comment.author_id === currentUser.value.id || 
         ['admin', 'moderator'].includes(currentUser.value.role);
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

function goToLogin() {
  router.push('/login');
}
</script>

<template>
  <div class="comments-section">
    <h3>Comments ({{ comments.length }})</h3>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- Comment Form -->
    <div v-if="isLoggedIn" class="comment-form">
      <textarea
        v-model="newComment"
        placeholder="Write a comment..."
        rows="3"
        maxlength="2000"
      ></textarea>
      <div class="form-actions">
        <span class="char-count">{{ newComment.length }}/2000</span>
        <button 
          @click="submitComment"
          :disabled="!newComment.trim()"
          class="btn btn-primary"
        >
          Post Comment
        </button>
      </div>
    </div>
    
    <div v-else class="login-prompt">
      <p>Please <button @click="goToLogin" class="link-button">log in</button> to post a comment.</p>
    </div>
    
    <!-- Comments List -->
    <div v-if="loading" class="loading">
      Loading comments...
    </div>
    
    <div v-else-if="comments.length === 0" class="no-comments">
      No comments yet. Be the first to comment!
    </div>
    
    <div v-else class="comments-list">
      <div 
        v-for="comment in comments" 
        :key="comment.id" 
        class="comment"
      >
        <!-- Main Comment -->
        <div class="comment-content" :class="{ deleted: comment.is_deleted }">
          <div class="comment-header">
            <span class="comment-author">{{ comment.author || 'Unknown User' }}</span>
            <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
            <span v-if="comment.updated_at !== comment.created_at" class="comment-edited">(edited)</span>
          </div>
          
          <div v-if="!comment.is_deleted" class="comment-body">
            <div v-if="!showEditForm[comment.id]" class="comment-text">
              {{ comment.content }}
            </div>
            
            <!-- Edit Form -->
            <div v-if="showEditForm[comment.id]" class="edit-form">
              <textarea
                v-model="editContent[comment.id]"
                rows="3"
                maxlength="2000"
              ></textarea>
              <div class="form-actions">
                <span class="char-count">{{ (editContent[comment.id] || '').length }}/2000</span>
                <button @click="editComment(comment.id)" class="btn btn-primary btn-sm">Save</button>
                <button @click="showEditForm[comment.id] = false" class="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          </div>
          
          <div v-else class="deleted-message">
            [This comment has been deleted]
          </div>
          
          <!-- Comment Actions -->
          <div v-if="!comment.is_deleted" class="comment-actions">
            <button 
              v-if="isLoggedIn"
              @click="toggleReplyForm(comment.id)"
              class="action-btn"
            >
              Reply
            </button>
            
            <button 
              v-if="canModifyComment(comment)"
              @click="toggleEditForm(comment.id, comment.content)"
              class="action-btn"
            >
              Edit
            </button>
            
            <button 
              v-if="canModifyComment(comment)"
              @click="deleteComment(comment.id)"
              class="action-btn delete"
            >
              Delete
            </button>
          </div>
          
          <!-- Reply Form -->
          <div v-if="showReplyForm[comment.id]" class="reply-form">
            <textarea
              v-model="replyContent[comment.id]"
              placeholder="Write a reply..."
              rows="2"
              maxlength="2000"
            ></textarea>
            <div class="form-actions">
              <span class="char-count">{{ (replyContent[comment.id] || '').length }}/2000</span>
              <button @click="submitReply(comment.id)" class="btn btn-primary btn-sm">Reply</button>
              <button @click="showReplyForm[comment.id] = false" class="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </div>
        </div>
        
        <!-- Replies -->
        <div v-if="comment.replies.length > 0" class="replies">
          <div 
            v-for="reply in comment.replies" 
            :key="reply.id" 
            class="comment reply"
          >
            <div class="comment-content" :class="{ deleted: reply.is_deleted }">
              <div class="comment-header">
                <span class="comment-author">{{ reply.author || 'Unknown User' }}</span>
                <span class="comment-date">{{ formatDate(reply.created_at) }}</span>
                <span v-if="reply.updated_at !== reply.created_at" class="comment-edited">(edited)</span>
              </div>
              
              <div v-if="!reply.is_deleted" class="comment-body">
                <div v-if="!showEditForm[reply.id]" class="comment-text">
                  {{ reply.content }}
                </div>
                
                <!-- Edit Form for Reply -->
                <div v-if="showEditForm[reply.id]" class="edit-form">
                  <textarea
                    v-model="editContent[reply.id]"
                    rows="2"
                    maxlength="2000"
                  ></textarea>
                  <div class="form-actions">
                    <span class="char-count">{{ (editContent[reply.id] || '').length }}/2000</span>
                    <button @click="editComment(reply.id)" class="btn btn-primary btn-sm">Save</button>
                    <button @click="showEditForm[reply.id] = false" class="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              </div>
              
              <div v-else class="deleted-message">
                [This comment has been deleted]
              </div>
              
              <!-- Reply Actions -->
              <div v-if="!reply.is_deleted" class="comment-actions">
                <button 
                  v-if="canModifyComment(reply)"
                  @click="toggleEditForm(reply.id, reply.content)"
                  class="action-btn"
                >
                  Edit
                </button>
                
                <button 
                  v-if="canModifyComment(reply)"
                  @click="deleteComment(reply.id)"
                  class="action-btn delete"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comments-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e1e1e1;
}

.comments-section h3 {
  font-family: var(--heading-font-family);
  margin-bottom: 20px;
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c66;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.comment-form, .reply-form, .edit-form {
  margin-bottom: 20px;
}

.comment-form textarea,
.reply-form textarea,
.edit-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.char-count {
  font-size: 0.8rem;
  color: #666;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
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

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-prompt {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 20px;
}

.link-button {
  background: none;
  border: none;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
}

.link-button:hover {
  color: var(--color-primary-hover);
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.no-comments {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-style: italic;
}

.comments-list {
  margin-top: 20px;
}

.comment {
  margin-bottom: 20px;
}

.comment.reply {
  margin-left: 40px;
  margin-bottom: 15px;
}

.comment-content {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border-left: 3px solid var(--color-primary);
}

.comment-content.deleted {
  background-color: #f5f5f5;
  border-left-color: #ccc;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.comment-author {
  font-weight: 600;
  color: var(--color-primary);
}

.comment-date {
  color: #666;
}

.comment-edited {
  color: #999;
  font-size: 0.8rem;
  font-style: italic;
}

.comment-text {
  margin-bottom: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.deleted-message {
  color: #999;
  font-style: italic;
  margin-bottom: 10px;
}

.comment-actions {
  display: flex;
  gap: 15px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  text-decoration: underline;
}

.action-btn:hover {
  color: var(--color-primary-hover);
}

.action-btn.delete {
  color: #dc3545;
}

.action-btn.delete:hover {
  color: #c82333;
}

.replies {
  margin-top: 15px;
}

@media (max-width: 768px) {
  .comment.reply {
    margin-left: 20px;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .form-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}
</style>
