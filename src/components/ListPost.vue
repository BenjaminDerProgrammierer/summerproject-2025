<script setup>
// Generate a random image

// get previous image numbers
let previousImages = [];
if (localStorage.getItem('previousImages')) {
    previousImages = JSON.parse(localStorage.getItem('previousImages'));
}
    
let imagenumber = 0;
do {
    imagenumber++;
} while (previousImages.includes(imagenumber));
let image = `https://picsum.photos/900/600?random=${imagenumber}`;


previousImages.push(imagenumber);
localStorage.setItem('previousImages', JSON.stringify(previousImages));
</script>

<!-- One Post in a list of posts -->
<template>
    <div class="flip-container">
        <div class="post">
            <div class="front">
                <!-- @vue-ignore -->
                <img :src="image" alt="Post Header" class="post-preview">
            </div>
            <div class="back">
                <!-- @vue-ignore -->
                <img :src="image" alt="Post Header" class="post-header">
                <div class="post-content">
                    <h3>Post Title</h3>
                    <p>Post description. This is a brief summary of the post content.</p>
                    <a href="#" class="link-button secondary read-more">Read More</a>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
.flip-container {
    width: 100%;
    height: 450px;

    &:hover .post {
        transform: rotateY(180deg);
    }

    &:hover .back {
        z-index: 3;
    }

    &:hover .front {
        z-index: 1;
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
    gap: 20px;

    & img {
        width: 200px;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 10px;
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
    }
}

@media screen {
    .flip-container {
        width: calc(50% - 10px);
        flex-direction: column;
    }

    .back {
        flex-direction: column;

        & img {
            width: 100%;
            height: 200px;
        }
    }
}
</style>