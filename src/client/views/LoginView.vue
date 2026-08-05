<script setup lang="ts">
import { ref, onMounted } from 'vue';
import router from '../router';

const isLogin = ref(router.currentRoute.value.path === '/login');
console.log('isLogin:', isLogin.value, router.currentRoute.value.path);
const needsSetup = ref(false);
const registrationMode = ref('invite_only'); // 'open', 'invite_only', 'closed'

// Input fields
const user = ref('');
const email = ref('');
const password = ref('');
const signupKey = ref('');
const confirmPassword = ref('');

const loginError = ref('');
const signupError = ref<string>('');
const setupError = ref<string | null>(null);

const error = ref<string | null>(null);

onMounted(async () => {
  // check if already logged in
  await checkSetupStatus();
  await fetchRegistrationMode();
});

// Check if the app needs setup
async function checkSetupStatus() {
  try {
    const response = await fetch(`/api/setup/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      needsSetup.value = data.needsSetup;
    } else {
      error.value = 'Could not check setup status';
    }
  } catch (err) {
    console.error('Error checking setup status:', err);
    error.value = 'Failed to connect to the server';
  }
}

// Check registration mode to determine if signup key is needed
async function fetchRegistrationMode() {
  try {
    const response = await fetch('/api/site-settings/public', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      registrationMode.value = data.registration_mode || 'invite_only';
    } else {
      // Default to invite_only if we can't fetch settings
      registrationMode.value = 'invite_only';
    }
  } catch (err) {
    console.error('Error fetching registration mode:', err);
    // Default to invite_only on error
    registrationMode.value = 'invite_only';
  }
}

// Try to login the user
async function login(event: Event) {
  event.preventDefault();
  const target = event.target as HTMLFormElement;
  const username = target.username.value;
  const password = target.password.value;

  try {
    const response = await fetch(`/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Login successful:', data);
      router.push('/');
    } else {
      console.error('Login failed:', data);
      loginError.value = data.message || 'Login failed';
    }
  } catch (err) {
    console.error('Login error:', err);
    loginError.value = 'Login failed. Please try again.';
  }
}

// Try to signup the user
async function signup(event: Event) {
  event.preventDefault();
  signupError.value = '';
  
  // Basic validation
  if (!user.value || !email.value || !password.value) {
    signupError.value = 'All fields are required';
    return;
  }
  
  // For invite-only mode, signup key is required
  if (registrationMode.value === 'invite_only' && !signupKey.value) {
    signupError.value = 'Signup key is required';
    return;
  }
  
  if (password.value !== confirmPassword.value) {
    signupError.value = 'Passwords do not match';
    return;
  }
  
  if (password.value.length < 8) {
    signupError.value = 'Password must be at least 8 characters long';
    return;
  }
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    signupError.value = 'Please enter a valid email address';
    return;
  }
  
  console.log('Creating user:', {
    username: user.value,
    email: email.value,
    password: password.value,
    signupKey: signupKey.value
  });

  try {
    const requestBody: any = {
      username: user.value,
      email: email.value,
      password: password.value
    };
    
    // Only include signup key if in invite-only mode and key is provided
    if (registrationMode.value === 'invite_only' && signupKey.value) {
      requestBody.signupKey = signupKey.value;
    }

    const response = await fetch(`/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });
    
    if (response.ok) {
      console.log('User created successfully');
      router.push('/');

    } else {
      const data = await response.json();
      signupError.value = data.message || 'Failed to sign up';
    }
  } catch (err) {
    console.error('Error during setup:', err);
    signupError.value = 'Connection error';
  }
}

// Try to setup the admin user
async function setup(event: Event) {
  event.preventDefault();
  setupError.value = null;
  
  // Basic validation
  if (!user.value || !email.value || !password.value) {
    setupError.value = 'All fields are required';
    return;
  }
  
  if (password.value !== confirmPassword.value) {
    setupError.value = 'Passwords do not match';
    return;
  }
  
  if (password.value.length < 8) {
    setupError.value = 'Password must be at least 8 characters long';
    return;
  }
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    setupError.value = 'Please enter a valid email address';
    return;
  }
  
  try {
    const response = await fetch(`/api/setup/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: user.value,
        email: email.value,
        password: password.value
      })
    });
    
    if (response.ok) {
      setTimeout(() => {
        router.push('/admin');
      }, 500);
    } else {
      const data = await response.json();
      setupError.value = data.message || 'Failed to create admin user';
    }
  } catch (err) {
    console.error('Error during setup:', err);
    setupError.value = 'Connection error';
  }
}

</script>

<template>
  <div class="login-container">
    <div class="form-container">

      <div v-if="needsSetup" class="setup-form">
        <h2>Setup</h2>
        <p>Welcome to your new blog! You need to create an admin user to get started.</p>
        <form @submit.prevent="setup">
          <div>
            <label for="username">User name:</label>
            <input type="text" id="username" name="username" v-model="user" required>
          </div>
          <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" v-model="email" required>
          </div>
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" v-model="password" required>
          </div>
          <div>
            <label for="confirmPassword">Confirm Password:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" v-model="confirmPassword" required>
          </div>
          <button type="submit">Create Admin</button>
        </form>
      </div>

      <div v-else-if="isLogin" class="login-form">
        <h2>Login</h2>
        <form @submit="login">
          <div>
            <label for="username">User name:</label>
            <input type="text" id="username" name="username" required v-model="user">
          </div>
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required v-model="password">
          </div>
          <div v-if="loginError" class="error-message">{{ loginError }}</div>
          <button type="submit">Login</button>
        </form>
        <p class="next-notice">Don't have an account? <span @click="router.push('/signup'); isLogin = false">Sign
            up</span></p>
      </div>

      <div v-else class="signup-form">
        <h2>Sign Up</h2>
        <form @submit="signup">
          <div v-if="registrationMode === 'invite_only'">
            <label for="key">Sign Up key:</label>
            <input type="text" id="key" name="signupkey" v-model="signupKey" required>
          </div>
          <div>
            <label for="username">User name:</label>
            <input type="text" id="username" name="username" v-model="user" required>
          </div>
          <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" v-model="email" required>
          </div>
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" v-model="password" required>
          </div>
          <div>
            <label for="confirmPassword">Confirm Password:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" v-model="confirmPassword" required>
          </div>
          <div v-if="signupError" class="error-message">{{ signupError }}</div>
          <button type="submit">Sign Up</button>
        </form>
        <p class="next-notice">Already have an account? <span
            @click="router.push('/login'); isLogin = true">Login</span></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  background-color: #f0f0f0;
  overflow: hidden;
  z-index: 0;

  &::before {
    content: '';
    position: absolute;
    background: conic-gradient(
      red,
      orange,
      yellow,
      lime,
      cyan,
      blue,
      violet,
      red
    );
    width: 500px;
    height: 500px;
    border-radius: 50%;
    z-index: 1;
    animation: steam 5s linear infinite;
    filter: blur(80px) opacity(0.5);
  }

}

.form-container {
  background-color: white;
  padding: 5px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1;
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    width: calc(100% + 5px);
    height: calc(100% + 5px);
    top: -5px;
    left: -5px;
    background: conic-gradient(
        red,
        orange,
        yellow,
        lime,
        cyan,
        blue,
        violet,
        red
      );
    z-index: -5;
  }
}

.login-form,
.signup-form,
.setup-form {
  max-height: 80vh;
  max-width: 80vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: scroll;
  background-color: #000;
  border-radius: 10px;
  padding: 20px;
  color: #f0f0f0;

  h2 {
    font-family: var(--heading-font-family);
    color: var(--color-secondary);
    margin-bottom: 5px;
  }

  form {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    width: 100%;

    div {
      margin-bottom: 15px;

      label {
        display: block;
        margin-bottom: 5px;
      }

      input {
        width: 100%;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #ccc;
      }
    }

    button {
      padding: 10px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;

      &:hover {
        background-color: #0056b3;
      }
    }
  }

  .next-notice {
    margin-top: 15px;

    span {
      color: #007bff;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .error-message {
    color: red;
    text-align: center;
    font-size: 0.9rem;
  }
}

@keyframes steam {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>