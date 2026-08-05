<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MarkdownRenderer from '../components/MarkdownRenderer.vue';
import CommentsSection from '../components/CommentsSection.vue';
import ErrorBox from '../components/ErrorBox.vue';

interface Attachment {
  id: number;
  filename: string;
  post_id: number;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author: string;
  author_id: number;
  created_at: string;
  custom_date?: string;
  category_name?: string;
  category_id?: number;
  tags: string[];
  attachments: Attachment[];
}

const route = useRoute();
const router = useRouter();
const post = ref<Post | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const popupAttachment = ref<Attachment | null>(null);
const currentAttachmentIndex = ref(0);

onMounted(async () => {
  await fetchPost();
  
  // Add keyboard event listener for escape key
  document.addEventListener('keydown', handleKeyDown);
});

// Clean up event listener when component unmounts
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

function handleKeyDown(event: KeyboardEvent) {
  if (!popupAttachment.value) return;
  
  if (event.key === 'Escape') {
    closePopup();
  } else if (event.key === 'ArrowLeft') {
    navigateAttachment(-1);
  } else if (event.key === 'ArrowRight') {
    navigateAttachment(1);
  }
}

async function fetchPost() {
  try {
    const postId = route.params.id;
    const response = await fetch(`/api/posts/${postId}`);

    if (response.ok) {
      post.value = await response.json();
    } else {
      throw new Error('Post not found');
    }
  } catch (err) {
    console.error('Error fetching post:', err);
    // Provide a friendly error message when the backend is down
    if (err instanceof Error) {
      if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        error.value = "Unable to connect to the server. The backend service might be down. Please try again later.";
      } else {
        error.value = err.message;
      }
    } else {
      error.value = "An unknown error occurred";
    }
  } finally {
    loading.value = false;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-AT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function filterByTag(tag: string) {
  router.push({
    path: '/blog',
    query: { tag }
  });
}

function filterByCategory(category: string) {
  router.push({
    path: '/blog',
    query: { category }
  });
}

function openAttachmentPopup(attachment: Attachment) {
  if (post.value?.attachments) {
    const imageAttachments = post.value.attachments.filter(a => 
      a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)
    );
    currentAttachmentIndex.value = imageAttachments.findIndex(a => a.id === attachment.id);
    popupAttachment.value = attachment;
    
    // Set the background image for the popup
    document.documentElement.style.setProperty('--popup-bg-image', `url('/uploads/${attachment.filename}')`);
  }
}

function closePopup() {
  popupAttachment.value = null;
}

function navigateAttachment(direction: number) {
  if (!post.value?.attachments) return;
  
  const imageAttachments = post.value.attachments.filter(a => 
    a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)
  );
  
  if (imageAttachments.length <= 1) return;
  
  const newIndex = (currentAttachmentIndex.value + direction + imageAttachments.length) % imageAttachments.length;
  currentAttachmentIndex.value = newIndex;
  popupAttachment.value = imageAttachments[newIndex];
  
  // Update the background image for the popup
  document.documentElement.style.setProperty('--popup-bg-image', `url('/uploads/${imageAttachments[newIndex].filename}')`);
}

function handlePopupBackgroundClick(event: Event) {
  if (event.target === event.currentTarget) {
    closePopup();
  }
}
</script>

<template>
  <div class="post-view">
    <div v-if="loading" class="loading">
      Loading post...
    </div>

    <ErrorBox v-else-if="error" :title="'Error'" :message="error" />

    <div v-else-if="post" class="post-content">
      <h1>{{ post.title }}</h1>

      <div class="post-myMeta">
        <div class="post-meta">
          Uploaded by
          <span class="author">{{ post.author }}</span>
          on
          <span class="date">{{ formatDate(post.custom_date || post.created_at) }}</span>
        </div>

        <div class="post-categorization"
          v-if="post.category_name || (post.tags && post.tags.filter(t => t !== null).length > 0)">

          <span class="category-pill" @click="filterByCategory(post.category_name || '')" v-if="post.category_name">
            {{ post.category_name }}
          </span>
          <span v-for="tag in post.tags.filter(t => t !== null)" :key="tag" class="tag-pill" @click="filterByTag(tag)">
            {{ tag }}
          </span>
        </div>
      </div>

      <div class="post-body">
        <MarkdownRenderer :markdown="post.content" />
      </div>

      <div v-if="post.attachments && post.attachments.filter(a => a !== null).length > 0" class="post-attachments">
        <h3>Attachments</h3>
        <div class="attachments-gallery">
          <div v-for="(attachment, index) in post.attachments.filter(a => a !== null)" :key="index" class="attachment">

            <img :src="`/uploads/${attachment.filename}`" :alt="`Attachment ${index + 1}`"
              v-if="attachment.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)" @click="openAttachmentPopup(attachment)" />

            <a :href="`/uploads/${attachment.filename}`" target="_blank" v-else>
              <div class="file-attachment">
                <span class="material-symbols-outlined">description</span>
                <span>{{ attachment.filename.substring('attachments-'.length) }}</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      <div class="post-navigation">
        <router-link to="/blog" class="link-button secondary bordered">Back to Blog</router-link>
      </div>

      <!-- Comments Section -->
      <CommentsSection :post-id="post.id" />

      <div id="image-popup" v-if="popupAttachment" @click="handlePopupBackgroundClick">
        <div class="popup-content">
          <img :src="`/uploads/${popupAttachment.filename}`" :alt="`Attachment ${popupAttachment.filename.substring('attachments-'.length)}`" />
          
          <!-- Navigation arrows -->
          <button class="nav-arrow nav-arrow-left" @click="navigateAttachment(-1)" 
                  v-if="post && post.attachments.filter(a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)).length > 1">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="nav-arrow nav-arrow-right" @click="navigateAttachment(1)"
                  v-if="post && post.attachments.filter(a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)).length > 1">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
          
          <button class="close-button" @click="closePopup">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.post-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.loading {
  text-align: center;
  padding: 50px 20px;
}

.post-content h1 {
  font-family: var(--heading-font-family);
  font-size: 2.5rem;
  margin-bottom: 15px;
}

.post-myMeta {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: start;
  gap: 20px;
  margin-bottom: 20px;
}

.post-meta {
  color: #666;
  font-family: var(--body-font-family);
  font-style: italic;

  span {
    font-weight: bold;
  }
}

.post-categorization {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
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

.post-attachments {
  margin: 40px 0;
}

.post-attachments h3 {
  font-family: var(--heading-font-family);
  margin-bottom: 20px;
}

.attachments-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.attachment {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.attachment a {
  text-decoration: none;
  color: inherit;
}

.attachment img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.attachment img:hover {
  transform: scale(1.05);
}

.file-attachment {
  height: 200px;
  background-color: #f1f1f1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  transition: background-color 0.3s ease;
}

.file-attachment:hover {
  background-color: #e1e1e1;
}

.file-attachment .material-symbols-outlined {
  font-size: 48px;
  margin-bottom: 10px;
}

.post-navigation {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}

#image-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-content {
  position: relative;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 80%;
  max-height: 80%;
  width: 80vw;
  height: 80vh;
}

.popup-content img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  /* border-radius: 8px; */
}
.popup-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: var(--popup-bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(20px);
  mask: radial-gradient(circle at center,black);
  /* opacity: 0.3; */
  z-index: -1;
  border-radius: 8px;
  overflow: hidden;
}
.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.9);
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 12px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
  font-size: 24px;
}

.nav-arrow:hover {
  background-color: rgba(0, 0, 0, 0.9);
}

.nav-arrow-left {
  left: 20px;
}

.nav-arrow-right {
  right: 20px;
}

.nav-arrow .material-symbols-outlined {
  font-size: 28px;
}

/* Mobile responsiveness for popup */
@media (max-width: 768px) {
  .popup-content {
    max-width: 95%;
    max-height: 95%;
  }
  
  .nav-arrow {
    padding: 8px;
  }
  
  .nav-arrow-left {
    left: 10px;
  }
  
  .nav-arrow-right {
    right: 10px;
  }
  
  .nav-arrow .material-symbols-outlined {
    font-size: 24px;
  }
}

@media print {
  .post-navigation,
  .comment-form,
  .comment-actions {
    display: none !important;
  }

  .post-meta,
  .comment-date {
    color: #000 !important;
    font-style: normal !important;
  }
  .comment-content {
    border: 2px solid #ccc !important;
    border-radius: none !important;
    background-color: transparent !important;
  }
}

</style>
