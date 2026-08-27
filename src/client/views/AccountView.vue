<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Logo from '../components/Logo.vue';
import { loginRoute } from '../auth-navigation';

interface UserProfile {
  username: string;
  email: string;
  emailNotifications: boolean;
  commentNotifications: boolean;
  replyNotifications: boolean;
}

const router = useRouter();
const route = useRoute();
const profile = ref<UserProfile | null>(null);
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const error = ref('');

onMounted(async () => {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.status === 401 || response.status === 404) {
      await router.replace(loginRoute(route.fullPath));
      return;
    }
    if (!response.ok) throw new Error('Could not load your account');
    profile.value = await response.json() as UserProfile;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not load your account';
  } finally {
    loading.value = false;
  }
});

type NotificationPreference = 'emailNotifications' | 'commentNotifications' | 'replyNotifications';

async function updateNotifications(changedPreference: NotificationPreference): Promise<void> {
  if (!profile.value || saving.value) return;
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    const response = await fetch('/api/auth/me/notifications', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailNotifications: profile.value.emailNotifications,
        commentNotifications: profile.value.commentNotifications,
        replyNotifications: profile.value.replyNotifications,
      }),
    });
    if (!response.ok) throw new Error('Could not save your notification preference');
    message.value = 'Notification preference saved.';
  } catch (caught) {
    profile.value[changedPreference] = !profile.value[changedPreference];
    error.value = caught instanceof Error ? caught.message : 'Could not save your preference';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="account-page">
    <header>
      <Logo :inline="true" />
      <router-link to="/" class="back-link">Back home</router-link>
    </header>

    <section class="account-card">
      <div class="eyebrow">Your account</div>
      <h1>Stay in the loop</h1>
      <p class="intro">Choose which WEBonTour activity should reach your inbox.</p>

      <p v-if="loading" class="status">Loading your preferences…</p>
      <p v-else-if="error && !profile" class="notice error">{{ error }}</p>

      <template v-else-if="profile">
        <div class="identity">
          <strong>{{ profile.username }}</strong>
          <span>{{ profile.email }}</span>
        </div>

        <label class="preference" :class="{ disabled: saving }">
          <span>
            <strong>New post notifications</strong>
            <small>Receive a styled email with a preview and link to every new post.</small>
          </span>
          <span class="switch">
            <input v-model="profile.emailNotifications" type="checkbox" :disabled="saving" @change="updateNotifications('emailNotifications')">
            <span class="slider"></span>
          </span>
        </label>

        <label class="preference" :class="{ disabled: saving }">
          <span>
            <strong>New comment notifications</strong>
            <small>Writers, moderators, and admins can receive an email when a new top-level comment is posted.</small>
          </span>
          <span class="switch">
            <input v-model="profile.commentNotifications" type="checkbox" :disabled="saving" @change="updateNotifications('commentNotifications')">
            <span class="slider"></span>
          </span>
        </label>

        <label class="preference" :class="{ disabled: saving }">
          <span>
            <strong>Reply notifications</strong>
            <small>Receive an email when another user replies to one of your comments.</small>
          </span>
          <span class="switch">
            <input v-model="profile.replyNotifications" type="checkbox" :disabled="saving" @change="updateNotifications('replyNotifications')">
            <span class="slider"></span>
          </span>
        </label>

        <p v-if="message" class="notice success">{{ message }}</p>
        <p v-if="error" class="notice error">{{ error }}</p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  padding: 24px max(5vw, 20px) 70px;
  background: linear-gradient(145deg, #f5f6f2 0%, #e5f6e2 55%, #f8ece3 100%);
  color: var(--color-accent);
}

header {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-link {
  color: var(--color-accent);
  font-weight: 700;
}

.account-card {
  max-width: 720px;
  margin: 70px auto 0;
  padding: clamp(28px, 6vw, 56px);
  border-radius: 24px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 18px 55px rgba(10, 0, 52, .14);
}

.eyebrow {
  color: var(--color-secondary);
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

h1 {
  margin: 8px 0 12px;
  font: 700 clamp(2rem, 5vw, 3rem)/1.15 var(--heading-font-family);
}

.intro {
  max-width: 560px;
  color: #5e5a69;
  font-size: 1.1rem;
  line-height: 1.55;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 32px 0 18px;
  padding: 18px 20px;
  border-left: 5px solid var(--color-secondary);
  background: #faf7f4;
}

.identity span,
.preference small {
  color: #696572;
}

.preference {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px;
  border: 1px solid #e1dfe5;
  border-radius: 14px;
  cursor: pointer;
}

.preference + .preference { margin-top: 12px; }

.preference > span:first-child {
  display: flex;
  flex-direction: column;
  gap: 5px;
  line-height: 1.4;
}

.preference.disabled { opacity: .65; }
.switch { position: relative; flex: 0 0 54px; height: 30px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; border-radius: 30px; background: #aaa6b2; transition: .2s; }
.slider::before { content: ''; position: absolute; width: 22px; height: 22px; left: 4px; top: 4px; border-radius: 50%; background: white; transition: .2s; box-shadow: 0 2px 5px #0003; }
input:checked + .slider { background: var(--color-primary); }
input:checked + .slider::before { transform: translateX(24px); }

.notice, .status { margin-top: 18px; }
.notice { padding: 12px 14px; border-radius: 8px; }
.success { background: #e3f9df; color: #146b14; }
.error { background: #fde9e7; color: #9b251d; }

@media (max-width: 560px) {
  .account-card { margin-top: 36px; }
  .preference { align-items: flex-start; }
}
</style>
