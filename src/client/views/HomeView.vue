<script setup lang="ts">
import RecentPosts from '../components/RecentPosts.vue';
import Logo from '../components/Logo.vue';
import LatestCategories from '../components/LatestCategories.vue';
import DestinationWidget from '../components/DestinationWidget.vue';
import { ref, onBeforeUnmount, onMounted } from 'vue';
import ErrorBox from '../components/ErrorBox.vue';
import { useRouter } from 'vue-router';

interface HealthResponse {
    status: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

const router = useRouter();
const apiError = ref<Error | null>(null);
const noPosts = ref(false);
const hasAuthError = ref(false);
const currentUser = ref<User | null>(null);
const isLoggedIn = ref(false);
const downArrow = ref<HTMLElement | null>(null);
const isArrowUp = ref(false);
const arrowRotation = ref(0);

function updateArrowDirection() {
  if (!downArrow.value) return;

  const arrowBounds = downArrow.value.getBoundingClientRect();
  const arrowCenter = arrowBounds.top + arrowBounds.height / 2;
  const shouldPointUp = arrowCenter < window.innerHeight / 2;

  if (shouldPointUp !== isArrowUp.value) {
    isArrowUp.value = shouldPointUp;
    arrowRotation.value += 180;
  }
}

async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    if (response.ok) {
      currentUser.value = await response.json();
      isLoggedIn.value = true;
    }
  } catch (err) {
    console.error('Error fetching user:', err);
    isLoggedIn.value = false;
  }
}

function goToLogin() {
  router.push('/login');
}

function goToAdmin() {
  router.push('/admin');
}

function goToAccount() {
  router.push('/account');
}

function handleAuthError(hasError: boolean) {
  hasAuthError.value = hasError;
}

function handlePostsLoaded(hasPosts: boolean) {
  noPosts.value = !hasPosts;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    currentUser.value = null;
    isLoggedIn.value = false;
  } catch (err) {
    console.error('Logout error:', err);
  }
}

onMounted(async () => {
    updateArrowDirection();
    window.addEventListener('scroll', updateArrowDirection, { passive: true });
    window.addEventListener('resize', updateArrowDirection);

    // Check if user is logged in
    await fetchCurrentUser();
    
    // Check health
    try {
        const response = await fetch(`/api/health`);
        const data = await response.json() as HealthResponse;
        if (data.status !== "UP") {
            throw new Error("Server reported down state")
        }
    } catch (error) {
        console.error('Error connecting to server:', error);
        apiError.value = error as Error;
    }

    // Fetch recent posts
    try {
        const response = await fetch(`/api/posts`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const posts = await response.json();
        noPosts.value = posts.length === 0;
    } catch (error) {
        console.error('Error fetching posts:', error);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('scroll', updateArrowDirection);
    window.removeEventListener('resize', updateArrowDirection);
});
</script>

<template>
    <!-- Login/User Status Bar -->
    <div class="user-status-bar">
        <div v-if="isLoggedIn" class="user-info">
            <span>Welcome, {{ currentUser?.username }}!</span>
            <button @click="goToAccount" class="link-button accent small">Account</button>
            <button @click="goToAdmin" class="link-button secondary small">Dashboard</button>
            <button @click="logout" class="link-button secondary small">Logout</button>
        </div>
        <div v-else class="login-prompt">
            <button @click="goToLogin" class="link-button primary login-btn">Log In</button>
        </div>
    </div>

    <Logo />
    <section id="hero">
        <div class="magicpattern"></div>
        <h1>Welcome to WEBonTour</h1>
        <p>Here you can follow our journeys around the globe. From Austria to Australia and the whole world, here you
            can read our stories!</p>
        <div class="buttons">
            <router-link to="/blog" class="link-button primary">View Blog Posts</router-link>
            <router-link to="/about" class="link-button secondary bordered">More about us</router-link>
        </div>
        <div id="down-arrow" ref="downArrow">
            <span class="arrow-motion" :class="{ 'arrow-up': isArrowUp }">
                <img
                    :style="{ transform: `rotate(${arrowRotation}deg)` }"
                    :src="`assets/icons/MaterialSymbolsArrowDownward.svg`"
                    :alt="isArrowUp ? 'Up' : 'Down'"
                >
            </span>
        </div>
    </section>

    <DestinationWidget />

    <section id="recent">
        <ErrorBox v-if="apiError" title="Error" message="Unable to connect to the backend server. Is it on?" />

        <template v-else>
            <h2>Recent Posts</h2>
            <div>
                <RecentPosts @auth-error="handleAuthError" @posts-loaded="handlePostsLoaded" />
                <div class="sidebar" v-if="!noPosts && !hasAuthError">
                    <h3>Latest Destinations</h3>
                    <LatestCategories />
                    <router-link to="/blog" class="link-button primary">View All Blog Posts</router-link>
                </div>
            </div>
        </template>
    </section>

    <footer>
        <div class="footer-item">
            <h3>Social Media</h3>
            <div class="social-media">
                <a><img :src="`assets/icons/fa6-brands/square-facebook.svg`" alt="Facebook"></a>
                <a><img :src="`assets/icons/fa6-brands/x-twitter.svg`" alt="Twitter / X"></a>
                <a><img :src="`assets/icons/fa6-brands/instagram.svg`" alt="Instagram"></a>
            </div>
        </div>
        <div class="footer-item">
            <h3>Contact Us</h3>
            <p>For inquiries, email us at <a href="mailto:info@webontour.eu">info@webontour.eu</a></p>
            <p>This is v0-alpha-4.0.1</p>
        </div>
        <div class="footer-item">
            <h3>Quick Links</h3>
            <ul class="footer-links">
                <li><router-link to="/admin">Admin Dashboard</router-link></li>
                <li><a href="/document?f=tos">Terms of Service</a></li>
                <li><a href="/document?f=privacy">Privacy Policy</a></li>
            </ul>
        </div>
    </footer>
</template>

<style scoped>
/* User Status Bar */
.user-status-bar {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(255, 255, 255, 0.95);
    padding: 10px 15px;
    border-radius: 25px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

.user-info span {
    font-weight: 500;
    color: #2c3e50;
}

.login-prompt .login-btn {
    background-color: #27ae60;
    color: white;
    font-size: 16px;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 25px;
    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
    transition: all 0.3s ease;
    border: none;
    cursor: pointer;
}

.login-prompt .login-btn:hover {
    background-color: #229954;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
}

.link-button.small {
    font-size: 0.8rem;
    padding: 6px 12px;
}

section {
    width: 100vw;
}

/* Hero section */
section#hero {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    background-color: #d9d9d9;
    padding: 5%;
    height: calc(100vh - 50px);
    background-image: url('/assets/images/magicpattern.png');
    background-size: cover;
    background-position: center;
    background-blend-mode: overlay;

    h1 {
        font-size: 48px;
        font-family: var(--heading-font-family);
        font-weight: 700;
        margin-bottom: 20px;
        text-align: center;
    }

    p {
        font-size: 24px;
        font-family: var(--body-font-family);
        margin-bottom: 15px;
        text-align: center;
        max-width: 600px;
    }

    .buttons {
        display: flex;
        gap: 20px;
        margin-top: 20px;
    }
}

/* Recent section */
section#recent {
    width: 100%;
    padding: 75px 10%;
    background-color: var(--color-accent);

    &>div {
        display: grid;
        grid-template-columns: 2fr 1fr;
    }

    /* with API connection error */
    &:has(.error)>div {
        display: block;
    }

    h2 {
        font-size: 36px;
        font-family: var(--heading-font-family);
        color: white;
        margin-bottom: 20px;
        font-weight: 500;
    }

    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 20px;
        color: white;
        margin-left: 20px;
        padding: 0 20px;

        h3 {
            text-align: center;
            font-size: 25px;
            font-family: var(--heading-font-family);
        }

        .link-button {
            display: inline-block;
            width: fit-content;
            margin: 0 auto;
        }
    }
}

/* Footer */
footer {
    background-color: #1e1e1e;
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-around;
    align-items: center;
}

footer .footer-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: center;
    margin-bottom: 10px;
}

footer .footer-item h3 {
    font-size: 24px;
    font-family: var(--heading-font-family);
}

footer .footer-item a {
    color: white;
    font-family: var(--body-font-family);
    transition: color 0.1s ease;
}

footer .footer-item a:hover {
    color: var(--color-primary);
}

footer .footer-item p {
    font-family: var(--body-font-family);
}

footer .footer-item .social-media {
    display: flex;
    gap: 20px;
}

footer .footer-item .social-media img {
    /* #ffffff https://codepen.io/sosuke/pen/Pjoqqp */
    filter: invert(99%) sepia(49%) saturate(2%) hue-rotate(114deg) brightness(113%) contrast(100%);
    transition: filter 0.3s ease;
}

footer .footer-item .social-media img:hover {
    /* primary color #1dd31d */
    filter: invert(74%) sepia(74%) saturate(3794%) hue-rotate(74deg) brightness(97%) contrast(101%);
}

footer .footer-item ul.footer-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    list-style: none;
}

footer .footer-item ul.footer-links a {
    text-decoration: none;
    color: white;
    font-family: var(--body-font-family);
    transition: color 0.1s ease;
}

footer .footer-item ul.footer-links a:hover {
    color: var(--color-primary);
}

/* Down arrow */
#down-arrow {
    position: absolute;
    bottom: -32px;
    left: 0;
    width: 100vw;
    display: flex;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
}

#down-arrow .arrow-motion {
    display: flex;
    animation: bounce 1s infinite;
}

#down-arrow .arrow-motion.arrow-up {
    animation: none;
}

#down-arrow img {
    background-color: transparent;
    filter: invert(50%) sepia(0%) saturate(25%) hue-rotate(144deg) brightness(93%) contrast(82%);
    width: 64px;
    height: 64px;
    border: 2px solid black;
    border-radius: 50%;
    transition: transform 0.4s ease-in-out;
}

@keyframes bounce {
    0% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-10px);
    }

    100% {
        transform: translateY(0);
    }
}

/* Responsive design */
@media screen and (max-width: 1100px) {
    section#recent {
        &>div {
            display: block;
        }

        .sidebar {
            margin-left: 0;
            width: 100%;
            padding: 0;

            h3 {
                margin-top: 20px;
                text-align: center;
            }

            ul {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                flex-direction: row;
                align-items: center;
                justify-content: space-evenly;
            }

            ul li {
                margin: 5px 0;
            }

            ul * {
                text-align: center;
            }
        }

    }
}

@media screen and (max-width: 800px) {
    .flip-container {
        width: 100%;
    }

    footer {
        flex-direction: column;
        align-items: center;
    }

    section#recent {
        h2 {
            text-align: center;
        }

        &:has(.error) {
            padding: 0;

            .error {
                width: 100%;
                max-width: 100%;
                padding: 20px 10px;
                border-radius: 0;
                margin: 0;
                border-top: 1px solid #e74c3c;
            }
        }
    }

}
</style>
