<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import UserManagement from '../components/UserManagement.vue';
import CommentsManagement from '../components/CommentsManagement.vue';
import SignupKeysManagement from '../components/SignupKeysManagement.vue';
import SiteSettingsManagement from '../components/SiteSettingsManagement.vue';
import DestinationSettingsManagement from '../components/DestinationSettingsManagement.vue';
import Logo from '../components/Logo.vue';
import { loginRoute } from '../auth-navigation';
import { extractPastedPost } from '../utils/pasted-post';

const PrismaStudio = defineAsyncComponent(() => import('../components/PrismaStudio.vue'));

interface Attachment {
  id: number;
  filename: string;
  post_id: number;
}

interface UploadedAttachment {
  id: number;
  filename: string;
}

interface Tag {
  id: number;
  name: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author: string;
  author_id: number;
  created_at: string;
  custom_date?: string;
  is_pinned: boolean;
  category_name?: string;
  category_id?: number;
  tags: Tag[];
  attachments: Attachment[];
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface User {
  id: number;
  username: string;
  role: 'admin' | 'moderator' | 'writer' | 'user';
}

const router = useRouter();
const route = useRoute();
const posts = ref<Post[]>([]);
const isAuthenticated = ref(false);
const loading = ref(true);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const studioEnabled = ref(false);
const showAccessRequiredDialog = ref(false);
const accessDialogTitle = ref('Access Required');
const accessDialogMessage = ref('You need appropriate privileges to access this section.');

// Form data for new/edit post
const formMode = ref('create'); // 'create' or 'edit'
const currentPostId = ref<number | null>(null);
const title = ref('');
const content = ref('');
const attachments = ref<Attachment[]>([]);
const selectedFiles = ref<File[]>([]);
const attachmentsToRemove = ref<Attachment[]>([]);
const selectedTags = ref<Tag[]>([]);
const availableTags = ref<string[]>([]);
const availableCategories = ref<Category[]>([]);
const selectedCategoryId = ref<number | null>(null);
const customDate = ref('');
const newTag = ref('');
const newCategory = ref('');
const showNewCategoryInput = ref(false);
const isSubmittingPost = ref(false);
const uploadProgress = ref(new Map<string, number>());
const allAttachmentsUploaded = computed(() =>
  selectedFiles.value.length === 0
  || selectedFiles.value.every(file => uploadProgress.value.get(file.name) === 100),
);

// UI state
const activeTab = ref('posts'); // 'posts', 'users', 'comments' or 'crud'

function closeAccessRequiredDialog() {
  showAccessRequiredDialog.value = false;
  router.replace('/');
}

onMounted(async () => {
  await checkAuthStatus();
  if (isAuthenticated.value) {
    await Promise.all([fetchPosts(), fetchTags(), fetchCategories()]);
  } else {
    // Redirect to login if not authenticated
    router.replace(loginRoute(route.fullPath));
  }
});

async function checkAuthStatus() {
  try {
    // First check if setup is needed
    const setupResponse = await fetch(`/api/setup/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (setupResponse.ok) {
      const setupData = await setupResponse.json();
      if (setupData.needsSetup) {
        // Redirect to setup page if no users exist
        router.replace('/setup');
        return;
      }
    }

    // Continue with normal auth check
    const response = await fetch(`/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      currentUser.value = userData;
      isAuthenticated.value = true;

      if (userData.role === 'admin') {
        const studioResponse = await fetch('/api/admin/studio/session', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        studioEnabled.value = studioResponse.ok;
      }

      // Check if user has any valid role for the admin panel (writer, moderator, or admin)
      if (!['writer', 'moderator', 'admin'].includes(userData.role)) {
        accessDialogTitle.value = "Access Required";
        accessDialogMessage.value = "You need writer, moderator, or admin privileges to access this page.";
        showAccessRequiredDialog.value = true;
        // The redirect happens after the user dismisses the dialog
        return;
      }

      // Check which tab to show as active based on role
      if (userData.role === 'writer') {
        activeTab.value = 'posts'; // Writers can only access posts tab
      }
    } else {
      isAuthenticated.value = false;
    }
  } catch (err) {
    console.error('Auth check error:', err);
    isAuthenticated.value = false;
  } finally {
    loading.value = false;
  }
}

async function logout() {
  try {
    await fetch(`/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    isAuthenticated.value = false;
    currentUser.value = null;
    router.replace('/login');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

async function fetchPosts() {
  try {
    const allPosts: Post[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetch(`/api/posts?limit=100&page=${page}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch posts');

      const data = await response.json();
      if (Array.isArray(data)) {
        allPosts.push(...data);
        hasNextPage = false;
      } else {
        allPosts.push(...data.posts);
        hasNextPage = data.pagination.hasNextPage;
        page++;
      }
    }

    // If user is a writer, filter to only show their own posts.
    // This is a client-side backup to the server-side filtering.
    posts.value = currentUser.value?.role === 'writer'
      ? allPosts.filter((post: Post) => post.author_id === currentUser.value?.id)
      : allPosts;
  } catch (err) {
    console.error('Error fetching posts:', err);
  }
}

async function fetchTags() {
  try {
    const response = await fetch(`/api/posts/tags`, {
      credentials: 'include'
    });

    if (response.ok) {
      availableTags.value = await response.json();
    } else {
      throw new Error('Failed to fetch tags');
    }
  } catch (err) {
    console.error('Error fetching tags:', err);
  }
}

async function fetchCategories() {
  try {
    const response = await fetch(`/api/posts/categories`, {
      credentials: 'include'
    });

    if (response.ok) {
      availableCategories.value = await response.json();
    } else {
      throw new Error('Failed to fetch categories');
    }
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    selectedFiles.value = Array.from(target.files);
  }
}

function handleContentPaste(event: ClipboardEvent) {
  const pastedPost = extractPastedPost(
    event.clipboardData?.getData('text/plain') ?? '',
    event.clipboardData?.getData('text/html') ?? '',
  );
  if (!pastedPost) return;

  event.preventDefault();
  const textarea = event.currentTarget as HTMLTextAreaElement;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;

  title.value = pastedPost.title;
  content.value =
    content.value.slice(0, selectionStart)
    + pastedPost.content
    + content.value.slice(selectionEnd);

  requestAnimationFrame(() => {
    const cursorPosition = selectionStart + pastedPost.content.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function resetForm() {
  formMode.value = 'create';
  currentPostId.value = null;
  title.value = '';
  content.value = '';
  customDate.value = '';
  selectedFiles.value = [];
  attachments.value = [];
  attachmentsToRemove.value = [];
  selectedTags.value = [];
  selectedCategoryId.value = null;
  newTag.value = '';
}

function editPost(post: Post) {
  // Check if the user has permission to edit this post
  if (!canEditPost(post)) {
    accessDialogTitle.value = "Permission Denied";
    accessDialogMessage.value = "You don't have permission to edit this post.";
    showAccessRequiredDialog.value = true;
    return;
  }

  formMode.value = 'edit';
  currentPostId.value = post.id;
  title.value = post.title;
  content.value = post.content;
  selectedCategoryId.value = post.category_id || null;

  // Handle custom date - convert from database format to datetime-local format
  if (post.custom_date) {
    // Convert from PostgreSQL timestamp to datetime-local format
    const date = new Date(post.custom_date);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    customDate.value = date.toISOString().slice(0, 16);
  } else {
    customDate.value = '';
  }

  attachments.value = Array.isArray(post.attachments) ? post.attachments : [];
  attachmentsToRemove.value = [];

  if (post.tags && Array.isArray(post.tags)) {
    selectedTags.value = post.tags.filter((tag: Tag) => tag !== null);
  } else {
    selectedTags.value = [];
  }

  // Scroll to form
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleAttachmentRemoval(attachment: Attachment) {
  const index = attachmentsToRemove.value.indexOf(attachment);
  if (index === -1) {
    attachmentsToRemove.value.push(attachment);
  } else {
    attachmentsToRemove.value.splice(index, 1);
  }
}

function addTag() {
  if (newTag.value && !selectedTags.value.some((tag: Tag) => tag.name === newTag.value)) {
    // Create a new tag object with temporary ID (will be replaced by server)
    selectedTags.value.push({ id: -1, name: newTag.value });
    newTag.value = '';
  }
}

function removeTag(tag: Tag) {
  const index = selectedTags.value.findIndex((t: Tag) => t.id === tag.id && t.name === tag.name);
  if (index !== -1) {
    selectedTags.value.splice(index, 1);
  }
}

function uploadErrorMessage(request: XMLHttpRequest): string {
  const responseText = request.responseText.trim();

  if (responseText) {
    try {
      const data = JSON.parse(responseText) as { message?: unknown; error?: unknown };
      const message = typeof data.message === 'string' ? data.message : data.error;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      // Reverse proxies such as nginx may return an HTML error page instead of JSON.
    }
  }

  if (request.status === 413) {
    return 'The upload is too large. Choose smaller attachments or ask an administrator to increase the upload limit.';
  }
  if (request.status === 502 || request.status === 503 || request.status === 504) {
    return 'The server is temporarily unavailable. Please try again shortly.';
  }

  const contentType = request.getResponseHeader('Content-Type') ?? '';
  const isHtml = contentType.includes('text/html') || /^\s*(?:<!doctype\s+html|<html)/i.test(responseText);
  if (responseText && !isHtml) return responseText;

  const status = [request.status, request.statusText].filter(Boolean).join(' ');
  return status ? `Failed to submit post (HTTP ${status}).` : 'Failed to reach the server. Check your connection and try again.';
}

function uploadAttachment(file: File): Promise<UploadedAttachment> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('attachment', file);

    const request = new XMLHttpRequest();
    request.open('POST', '/api/attachments');
    request.withCredentials = true;
    uploadProgress.value.set(file.name, 0);

    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        uploadProgress.value.set(file.name, Math.round((event.loaded / event.total) * 100));
      }
    });
    request.upload.addEventListener('load', () => {
      uploadProgress.value.set(file.name, 100);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          const attachment = JSON.parse(request.responseText) as UploadedAttachment;
          if (!Number.isInteger(attachment.id) || typeof attachment.filename !== 'string') {
            throw new Error('Invalid attachment response');
          }
          resolve(attachment);
        } catch {
          reject(new Error('The server returned an invalid attachment response.'));
        }
      } else {
        reject(new Error(uploadErrorMessage(request)));
      }
    });
    request.addEventListener('error', () => {
      reject(new Error('Failed to reach the server. Check your connection and try again.'));
    });
    request.addEventListener('abort', () => {
      reject(new Error('The upload was cancelled.'));
    });
    request.send(formData);
  });
}

async function postRequestError(response: Response): Promise<string> {
  const responseText = await response.text();
  if (responseText) {
    try {
      const data = JSON.parse(responseText) as { message?: unknown; error?: unknown };
      const message = typeof data.message === 'string' ? data.message : data.error;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      // Reverse proxies may return an HTML error page instead of JSON.
    }
  }
  return `Failed to submit post (HTTP ${response.status} ${response.statusText}).`;
}

async function deleteOrphanAttachments(uploaded: UploadedAttachment[]): Promise<void> {
  await Promise.allSettled(uploaded.map(attachment => fetch(`/api/attachments/${attachment.id}`, {
    method: 'DELETE',
    credentials: 'include',
  })));
}

async function submitPost(event: Event) {
  event.preventDefault();

  if (isSubmittingPost.value) return;

  error.value = null;
  isSubmittingPost.value = true;
  uploadProgress.value = new Map(selectedFiles.value.map(file => [file.name, 0]));
  const uploadPromises = selectedFiles.value.map(uploadAttachment);
  let uploaded: UploadedAttachment[] = [];

  try {
    uploaded = await Promise.all(uploadPromises);
    const isCreate = formMode.value === 'create';
    const response = await fetch(isCreate ? '/api/posts' : `/api/posts/${currentPostId.value}`, {
      method: isCreate ? 'POST' : 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.value,
        content: content.value,
        custom_date: customDate.value || null,
        category_id: selectedCategoryId.value,
        tags: selectedTags.value.map(tag => tag.name),
        removeAttachments: isCreate ? [] : attachmentsToRemove.value.map(attachment => attachment.id),
        attachmentIds: uploaded.map(attachment => attachment.id),
      }),
    });
    if (!response.ok) {
      throw new Error(await postRequestError(response));
    }

    await Promise.all([fetchPosts(), fetchTags()]);
    
    // Reset the file input
    const fileInput = document.getElementById('files') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    resetForm();
  } catch (err) {
    if (uploaded.length === 0 && uploadPromises.length > 0) {
      const uploadResults = await Promise.allSettled(uploadPromises);
      uploaded = uploadResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    }
    if (uploaded.length > 0) await deleteOrphanAttachments(uploaded);
    console.error('Error submitting post:', err);
    if (err instanceof Error) {
      error.value = err.message;
    } else {
      error.value = 'An unknown error occurred';
    }
  } finally {
    isSubmittingPost.value = false;
  }
}

async function deletePost(id: number) {
  // Find the post to check permissions
  const post = posts.value.find((p: Post) => p.id === id);

  if (!post) {
    console.error('Post not found');
    return;
  }

  // Check if the user has permission to delete this post
  if (!canEditPost(post)) {
    accessDialogTitle.value = "Permission Denied";
    accessDialogMessage.value = "You don't have permission to delete this post.";
    showAccessRequiredDialog.value = true;
    return;
  }

  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }

  try {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Failed to delete post: ${response.statusText}`);
    }

    await fetchPosts();
  } catch (err) {
    console.error('Error deleting post:', err);
    if (err instanceof Error) {
      error.value = err.message;
    } else {
      error.value = 'An unknown error occurred';
    }
  }
}

async function togglePinned(post: Post) {
  if (!isAdmin()) return;

  try {
    const response = await fetch(`/api/posts/${post.id}/pin`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !post.is_pinned }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to update pinned post');
    }
    await fetchPosts();
  } catch (err) {
    console.error('Error updating pinned post:', err);
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
  }
}

// For convenience, specific role checks
const isAdmin = () => currentUser.value?.role === 'admin';
const isModerator = () => ['admin', 'moderator'].includes(currentUser.value?.role || '');
const isWriter = () => ['admin', 'moderator', 'writer'].includes(currentUser.value?.role || '');

// Check if user can edit a specific post
function canEditPost(post: Post) {
  if (!currentUser.value) return false;
  return isAdmin() || isModerator() || (isWriter() && post.author_id === currentUser.value.id);
}

async function createCategory() {
  if (!newCategory.value.trim()) {
    return;
  }

  try {
    const response = await fetch(`/api/posts/categories`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newCategory.value.trim(), description: '' })
    });

    if (response.ok) {
      const createdCategory = await response.json();
      availableCategories.value.push(createdCategory);
      selectedCategoryId.value = createdCategory.id;
      newCategory.value = '';
      showNewCategoryInput.value = false;
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to create category');
    }
  } catch (err) {
    console.error('Error creating category:', err);
    if (err instanceof Error) {
      error.value = err.message;
    } else {
      error.value = 'An unknown error occurred';
    }
  }
}

function toggleNewCategoryInput() {
  showNewCategoryInput.value = !showNewCategoryInput.value;
  if (showNewCategoryInput.value) {
    // Focus the input after it's shown
    setTimeout(() => {
      const newCategoryInput = document.getElementById('new-category-input');
      if (newCategoryInput) {
        newCategoryInput.focus();
      }
    }, 0);
  }
}
</script>

<template>
  <div class="admin-container">
    <!-- Access Required Dialog -->
    <div v-if="showAccessRequiredDialog" class="admin-required-dialog">
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>{{ accessDialogTitle }}</h3>
          <button @click="closeAccessRequiredDialog" class="close-btn">&times;</button>
        </div>
        <div class="dialog-body">
          <p>{{ accessDialogMessage }}</p>
        </div>
        <div class="dialog-footer">
          <button @click="closeAccessRequiredDialog" class="cancel-btn">Close</button>
          <button @click="logout" class="action-btn">Sign Out</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-screen">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <div v-else-if="isAuthenticated" class="admin-dashboard">
      <div class="admin-header">
        <h2 class="admin-title">
          <Logo :inline="true" />Welcome to the Admin Dashboard
        </h2>
        <div class="user-info">
          <span class="username">{{ currentUser?.username }}</span>
          <span class="role-badge" :class="currentUser?.role">{{ currentUser?.role }}</span>
          <router-link to="/account" class="link-button accent">Account</router-link>
          <button @click="logout" class="link-button secondary">Logout</button>
        </div>
      </div>

      <div class="tabs">
        <!-- All roles (writer, moderator, admin) can access posts tab -->
        <button @click="activeTab = 'posts'" :class="{ active: activeTab === 'posts' }" class="tab-button">
          Manage Posts
        </button>

        <!-- Writers, moderators, and admins can access comments -->
        <button v-if="isWriter()" @click="activeTab = 'comments'" :class="{ active: activeTab === 'comments' }" class="tab-button">
          Comments
        </button>

        <!-- Only admin can access user management -->
        <button v-if="isAdmin()" @click="activeTab = 'users'" :class="{ active: activeTab === 'users' }"
          class="tab-button">
          Manage Users
        </button>

        <!-- Only admin can access signup keys management -->
        <button v-if="isAdmin()" @click="activeTab = 'signup-keys'" :class="{ active: activeTab === 'signup-keys' }"
          class="tab-button">
          Signup Keys
        </button>

        <!-- Only admin can access site settings -->
        <button v-if="isAdmin()" @click="activeTab = 'site-settings'" :class="{ active: activeTab === 'site-settings' }"
          class="tab-button">
          Site Settings
        </button>

        <button v-if="isAdmin()" @click="activeTab = 'destination'" :class="{ active: activeTab === 'destination' }"
          class="tab-button">
          Destination
        </button>

        <!-- Database Studio is separately feature-flagged and admin-only -->
        <button v-if="isAdmin() && studioEnabled" @click="activeTab = 'studio'" :class="{ active: activeTab === 'studio' }"
          class="tab-button">
          Database Studio
        </button>
      </div>

      <div v-if="activeTab === 'posts'" class="tab-content posts-tab">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <form id="post-form" @submit="submitPost" class="create-post-form">
          <h3>{{ formMode === 'create' ? 'Create New Post' : 'Edit Post' }}</h3>

          <div class="form-group">
            <label for="title">Title:</label>
            <input type="text" id="title" v-model="title" required>
          </div>

          <div class="form-group">
            <label for="content">Content:</label>
            <textarea id="content" v-model="content" rows="10" required @paste="handleContentPaste"></textarea>
            <small>Supports Markdown and safe HTML, including iframe embeds</small>
          </div>

          <div class="form-group">
            <label for="customDate">Custom Date (optional):</label>
            <input 
              type="datetime-local" 
              id="customDate" 
              v-model="customDate" 
              class="form-input"
              title="Leave empty to use current date/time"
            />
            <small>If left empty, the current date and time will be used</small>
          </div>

          <div class="form-group">
            <label for="category">Category:</label>
            <div class="category-selector">
              <select id="category" v-model="selectedCategoryId">
                <option :value="null">-- Select Category --</option>
                <option v-for="category in availableCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <button type="button" @click="toggleNewCategoryInput" class="link-button secondary small">
                {{ showNewCategoryInput ? 'Cancel' : 'New Category' }}
              </button>
            </div>

            <div v-if="showNewCategoryInput" class="new-category-input">
              <input type="text" id="new-category-input" v-model="newCategory" placeholder="Enter new category name"
                @keyup.enter="createCategory">
              <button type="button" @click="createCategory" class="link-button primary small">Add</button>
            </div>
          </div>

          <!-- File Upload -->
          <div class="form-group">
            <label for="files">Attachments:</label>
            <input type="file" id="files" multiple @change="handleFileChange">
            <small>Select multiple files if needed (5MB limit per file)</small>
          </div>

          <!-- Current Attachments (Edit Mode) -->
          <div v-if="formMode === 'edit' && attachments.length > 0" class="current-attachments">
            <h4>Current Attachments</h4>
            <div class="attachment-list">
              <div v-for="attachment in attachments" :key="attachment.id" class="attachment-item"
                :class="{ 'marked-remove': attachmentsToRemove.includes(attachment) }">
                <span class="filename">{{ attachment.filename }}</span>
                <button type="button" @click="toggleAttachmentRemoval(attachment)" class="toggle-remove">
                  {{ attachmentsToRemove.includes(attachment) ? 'Keep' : 'Remove' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Fix selected tags display in the form -->
          <div class="form-group">
            <label for="tags">Tags:</label>
            <div class="tag-selector">
              <div class="selected-tags">
                <span v-for="tag in selectedTags" :key="tag.id" class="tag">
                  {{ tag.name }}
                  <button type="button" @click="removeTag(tag)" class="remove-tag">&times;</button>
                </span>
              </div>
              <div class="add-tag">
                <input type="text" v-model="newTag" placeholder="Add a tag" @keyup.enter.prevent="addTag">
                <button type="button" @click="addTag" class="link-button primary small">Add</button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="link-button primary" :disabled="isSubmittingPost">
              {{ isSubmittingPost ? 'Uploading…' : (formMode === 'create' ? 'Create Post' : 'Update Post') }}
            </button>
            <button type="button" @click="resetForm" class="link-button secondary" :disabled="isSubmittingPost">Cancel</button>
          </div>

          <div v-if="isSubmittingPost" class="upload-status" role="status" aria-live="polite">
            <div class="upload-status-label">
              <span>{{ allAttachmentsUploaded ? 'Processing post' : 'Uploading attachments' }}</span>
            </div>
            <div v-for="file in selectedFiles" :key="`${file.name}-${file.size}-${file.lastModified}`" class="attachment-progress">
              <div class="upload-status-label">
                <span>{{ file.name }}</span>
                <span>{{ uploadProgress.get(file.name) ?? 0 }}%</span>
              </div>
              <progress :value="uploadProgress.get(file.name) ?? 0" max="100"
                :aria-label="`Upload progress for ${file.name}: ${uploadProgress.get(file.name) ?? 0}%`">
                {{ uploadProgress.get(file.name) ?? 0 }}%
              </progress>
            </div>
          </div>
        </form>

        <div class="post-lists">
          <div class="posts-list">
            <h3>{{ isAdmin() ? 'All Posts' : 'Your Posts' }}</h3>

            <div v-if="(isAdmin() ? posts : posts.filter(p => p.author === currentUser?.username)).length === 0" class="no-posts">
              No posts yet. Create one using the form above.
            </div>

            <div v-else class="post-cards">
              <div v-for="post in (isAdmin() ? posts : posts.filter(p => p.author === currentUser?.username))" :key="post.id"
                class="post-card">
                <h4 class="post-title">
                  <span v-if="post.is_pinned" class="pin-badge">Pinned</span>
                  {{ post.title }}
                </h4>
                <div class="post-meta">
                  <p class="post-date">{{ new Date(post.custom_date || post.created_at).toLocaleDateString('de-AT', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                    }) }}</p>
                  <p class="post-category" v-if="post.category_name">{{ post.category_name }}</p>
                  <p class="post-author" v-if="isAdmin()">{{ post.author }}</p>
                </div>
                <div class="post-tags">
                  <span v-for="tag in post.tags" :key="tag.id" class="post-tag">{{ tag.name }}</span>
                </div>
                <div class="post-actions">
                  <a :href="`/post/${post.id}`" target="_blank" class="link-button small">View</a>
                  <button v-if="isAdmin()" type="button" @click="togglePinned(post)" class="link-button accent small">
                    {{ post.is_pinned ? 'Unpin' : 'Pin' }}
                  </button>
                  <button @click="editPost(post)" class="link-button primary small">Edit</button>
                  <button @click="deletePost(post.id)" class="link-button danger small">Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div class="posts-list" v-if="isModerator() && !isAdmin()">
            <h3>Other's Posts</h3>

            <div v-if="posts.filter(p => p.author !== currentUser?.username).length === 0" class="no-posts">
              No posts from other users yet.
            </div>

            <div v-else class="post-cards">
              <div v-for="post in posts.filter(p => p.author !== currentUser?.username)" :key="post.id"
                class="post-card">
                <h4 class="post-title">
                  <span v-if="post.is_pinned" class="pin-badge">Pinned</span>
                  {{ post.title }}
                </h4>
                <div class="post-meta">
                  <p class="post-date">{{ new Date(post.custom_date || post.created_at).toLocaleDateString('de-AT', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) }}</p>
                  <p class="post-author">{{ post.author }}</p>
                  <p class="post-category" v-if="post.category_name">{{ post.category_name }}</p>
                </div>
                <div class="post-tags">
                  <span v-for="tag in post.tags" :key="tag.id" class="post-tag">{{ tag.name }}</span>
                </div>
                <div class="post-actions">
                  <a :href="`/post/${post.id}`" target="_blank" class="link-button small">View</a>
                  <button @click="editPost(post)" class="link-button primary small">Edit</button>
                  <button @click="deletePost(post.id)" class="link-button danger small">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'comments'" class="tab-content comments-tab">
        <CommentsManagement />
      </div>

      <div v-else-if="activeTab === 'users'" class="tab-content users-tab">
        <UserManagement />
      </div>

      <div v-else-if="activeTab === 'signup-keys'" class="tab-content signup-keys-tab">
        <SignupKeysManagement />
      </div>

      <div v-else-if="activeTab === 'site-settings'" class="tab-content site-settings-tab">
        <SiteSettingsManagement />
      </div>

      <div v-else-if="activeTab === 'destination'" class="tab-content destination-settings-tab">
        <DestinationSettingsManagement />
      </div>

      <div v-else-if="activeTab === 'studio'" class="tab-content studio-tab">
        <PrismaStudio />
      </div>
    </div>

    <div v-else-if="!loading" class="not-authenticated">
      <h2>Not Authenticated</h2>
      <p>Please log in to access the admin dashboard.</p>
      <router-link to="/login" class="link-button primary">Go to Login</router-link>
    </div>
  </div>
</template>

<style scoped>
.post-lists {
  display: grid;
  gap: 20px;
  grid-template-rows: 1fr 1fr;
  height: 100%;

  &>* {
    height: 100%;
  }
}

.pin-badge {
  display: inline-block;
  margin-right: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fff3cd;
  color: #7a5700;
  font-family: var(--body-font-family);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  vertical-align: middle;
}

.admin-title {
  display: flex;
  gap: 10px;
  align-items: center;
}

.admin-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20px;
}

/* White background when access dialog is shown */
.admin-container:has(.admin-required-dialog) {
  background-color: white;
}

.admin-container:has(.admin-required-dialog) .admin-dashboard {
  display: none;
}

.loading,
.not-authenticated {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  text-align: center;
}

.admin-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.admin-header h2 {
  margin: 0;
  color: #2c3e50;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.username {
  font-weight: bold;
}

.role-badge {
  background-color: #eee;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  text-transform: uppercase;
}

.role-badge.admin {
  background-color: #2c3e50;
  color: white;
}

.role-badge.moderator {
  background-color: #3498db;
  color: white;
}

.role-badge.writer {
  background-color: #27ae60;
  color: white;
}

.role-badge.user {
  background-color: #95a5a6;
  color: white;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

@media (max-width: 600px) {
  .admin-container {
    padding: 12px;
  }

  .admin-header,
  .user-info {
    align-items: flex-start;
  }

  .admin-title {
    width: 100%;
  }

  .tab-button {
    flex: 1 1 calc(50% - 5px);
    padding-inline: 10px;
  }

  .tab-content {
    padding: 12px;
  }
}

.tab-button {
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-button.active {
  background-color: #2c3e50;
  color: white;
  border-color: #2c3e50;
}

.tab-content {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.posts-tab {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 1000px) {
  .posts-tab {
    grid-template-columns: 1fr 1fr;
  }
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  grid-column: 1 / -1;
}

.create-post-form {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.create-post-form h3 {
  margin-top: 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group small {
  color: #6c757d;
  font-size: 12px;
}

.category-selector {
  display: flex;
  gap: 10px;
}

.category-selector select {
  flex: 1;
}

.new-category-input {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.new-category-input input {
  flex: 1;
}

.current-attachments {
  margin: 15px 0;
}

.current-attachments h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background-color: #f1f1f1;
  border-radius: 4px;
}

.attachment-item.marked-remove {
  background-color: #f8d7da;
  text-decoration: line-through;
}

.toggle-remove {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
}

.tag-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  display: inline-flex;
  align-items: center;
  background-color: #e9ecef;
  padding: 3px 8px;
  border-radius: 15px;
  font-size: 12px;
}

.remove-tag {
  background: none;
  border: none;
  color: #495057;
  margin-left: 5px;
  cursor: pointer;
  font-size: 14px;
}

.add-tag {
  display: flex;
  gap: 10px;
}

.add-tag input {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.form-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.upload-status {
  margin-top: 14px;
}

.attachment-progress {
  margin-top: 8px;
}

.attachment-progress .upload-status-label span:first-child {
  overflow-wrap: anywhere;
}

.upload-status-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #495057;
  font-size: 13px;
}

.upload-status progress {
  display: block;
  width: 100%;
  height: 12px;
  accent-color: #27ae60;
}

.posts-list {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  height: 450px;
}

.posts-list h3 {
  margin-top: 0;
  color: #2c3e50;
}

.no-posts {
  text-align: center;
  padding: 20px;
  color: #6c757d;
}

.post-cards {
  display: grid;
  gap: 15px;
  max-height: 100%;
  overflow-y: auto;
}

.post-card {
  background-color: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.post-title {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.post-meta {
  display: flex;
  justify-content: space-between;
  color: #6c757d;
  font-size: 12px;
  margin-bottom: 10px;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.post-tag {
  background-color: #e9ecef;
  padding: 3px 8px;
  border-radius: 15px;
  font-size: 12px;
}

.post-actions {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
}

.link-button.small {
  font-size: 12px;
  padding: 5px 10px;
}

.link-button.danger {
  background-color: #dc3545;
  color: white;
}

.link-button.danger:hover {
  background-color: #c82333;
}

/* Admin Required Dialog Styles */
.admin-required-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 400px;
  max-width: 90%;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #f44336;
  /* Red for warning */
  color: white;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.dialog-body {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
  gap: 10px;
}

.dialog-footer button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.dialog-footer .cancel-btn {
  background-color: #e0e0e0;
  border: none;
  color: #333;
}

.dialog-footer .action-btn {
  background-color: #2196f3;
  border: none;
  color: white;
}

.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #2196f3;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
