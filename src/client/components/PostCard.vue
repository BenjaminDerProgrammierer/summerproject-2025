<script setup lang="ts">
import type { Post } from '../types/Post';

const props = defineProps<{
    post: Post
}>();

// Function to format date
function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-AT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Function to truncate content
function truncateContent(content: string | undefined, maxLength: number = 100): string | undefined {
    if (!content || content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
}

// Check if post has a valid image
function hasValidImage(): string | false {
    const hasAttachment = props.post.attachments && 
        props.post.attachments.some(a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i));
    
    if (hasAttachment && props.post.attachments) {
        const attachment = props.post.attachments.find(
            a => a !== null && a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)
        );
        return attachment ? attachment.filename : false;
    }
    return false;
}

// Get image from post attachments or use placeholder
function getPostImage(): string {
    const validImage = hasValidImage();
    if (validImage) {
        return `/uploads/${validImage}`;
    }
    // Fallback to placeholder image
    return `https://picsum.photos/900/600?random=${Math.floor(Math.random() * 1000)}`;
}

const postImage = getPostImage();
const hasImage = hasValidImage();

// Check for touch devices
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

</script>

<!-- One Post in a list of posts -->
<template>
    <div class="flip-container" :class="{ 'no-flip': !hasImage || isTouchDevice }">
        <div class="post" :class="{ 'no-flip': !hasImage || isTouchDevice }">
            <div class="front" v-if="hasImage || isTouchDevice">
                <img :src="postImage" :alt="post.title" class="post-preview">
            </div>
            <div class="back" :class="{ 'show-back': !hasImage || isTouchDevice }">
                <img :src="postImage" :alt="post.title" class="post-header">
                <div class="post-content">
                    <h3 class="single-line">{{ post.title }}</h3>
                    <div class="post-meta">
                        <span class="author">By {{ post.author }}</span>
                        <span class="date">{{ formatDate(post.custom_date || post.created_at) }}</span>
                    </div>
                    <p class="single-line">{{ truncateContent(post.content) }}</p>
                    <router-link :to="`/post/${post.id}`" class="link-button secondary read-more">Read
                        More</router-link>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.flip-container {
    width: 100%;
    height: 450px;

    &:hover .post {
        transform: rotateY(180deg);
        transition-delay: 0.1s;
    }

    &:hover .back {
        z-index: 3;
    }

    &:hover .front {
        z-index: 1;
    }

    &.no-flip:hover .post {
        transform: rotateY(0deg);
    }
}

.post,
.front,
.back {
    width: 100%;
    height: 100%;
    border-radius: 10px;
}

.post {
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.5s ease;

    &.no-flip {
        transform: rotateY(0deg);
    }
}

.front,
.back {
    position: absolute;
    top: 0;
    left: 0;

    &,
    & * {
        backface-visibility: hidden;
    }
}

.front {
    z-index: 2;
    background-color: white;

    & .post-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 10px;
    }
}

.back {
    transform: rotateY(180deg);
    background-color: white;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;

    &.show-back {
        transform: rotateY(0deg);
        z-index: 3;
    }

    & img {
        width: 100%;
        object-fit: cover;
        border-radius: 10px;
        height: 188px;
    }

    & .post-content {
        display: flex;
        flex-direction: column;
        gap: 10px;

        & h3 {
            font-size: 3rem;
            font-family: var(--heading-font-family);
            margin-bottom: 10px;
        }

        & p {
            font-size: 1.25rem;
            font-family: var(--body-font-family);
            margin-bottom: 10px;
        }

        & .read-more {
            margin-top: auto;
            width: fit-content;
        }

        & .post-meta {
            display: flex;
            justify-content: space-between;
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
            font-family: var(--body-font-family);
        }
    }
}

.single-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

@media screen and (min-width: 800px) {
    .flip-container {
        width: calc(50% - 10px);
    }
}
</style>