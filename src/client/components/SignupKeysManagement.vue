<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface SignupKey {
  id: number;
  key_value: string;
  note: string;
  created_at: string;
  created_by_username: string;
}

const signupKeys = ref<SignupKey[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const newKeyNote = ref('');
const showCreateForm = ref(false);

onMounted(async () => {
  await fetchSignupKeys();
});

async function fetchSignupKeys() {
  try {
    const response = await fetch('/api/signup-keys', {
      credentials: 'include'
    });

    if (response.ok) {
      signupKeys.value = await response.json();
    } else {
      throw new Error('Failed to fetch signup keys');
    }
  } catch (err) {
    console.error('Error fetching signup keys:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

async function createSignupKey() {
  try {
    const response = await fetch('/api/signup-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        note: newKeyNote.value.trim() || null
      })
    });

    if (response.ok) {
      newKeyNote.value = '';
      showCreateForm.value = false;
      await fetchSignupKeys();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create signup key');
    }
  } catch (err) {
    console.error('Error creating signup key:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

async function deleteSignupKey(id: number) {
  if (!confirm('Are you sure you want to delete this signup key?')) {
    return;
  }

  try {
    const response = await fetch(`/api/signup-keys/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      await fetchSignupKeys();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete signup key');
    }
  } catch (err) {
    console.error('Error deleting signup key:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

async function updateSignupKeyNote(id: number, note: string) {
  try {
    const response = await fetch(`/api/signup-keys/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ note })
    });

    if (response.ok) {
      await fetchSignupKeys();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update signup key');
    }
  } catch (err) {
    console.error('Error updating signup key:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-AT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    // Could add a toast notification here
    console.log('Copied to clipboard');
  });
}
</script>

<template>
  <div class="signup-keys-management">
    <div class="header">
      <h2>One-Time Signup Keys</h2>
      <button 
        @click="showCreateForm = !showCreateForm" 
        class="link-button primary"
      >
        {{ showCreateForm ? 'Cancel' : 'Create New Key' }}
      </button>
    </div>

    <div v-if="showCreateForm" class="create-form">
      <h3>Create New Signup Key</h3>
      <div class="form-group">
        <label for="keyNote">Note (optional):</label>
        <input 
          id="keyNote"
          v-model="newKeyNote" 
          type="text" 
          placeholder="e.g., 'For Bob from HR'"
          class="form-input"
        />
        <small>This note helps you track who the key is for</small>
      </div>
      <div class="form-actions">
        <button @click="createSignupKey" class="link-button primary">Create Key</button>
        <button @click="showCreateForm = false" class="link-button secondary">Cancel</button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading">
      Loading signup keys...
    </div>

    <div v-else-if="signupKeys.length === 0" class="no-keys">
      No signup keys created yet.
    </div>

    <div v-else class="keys-table">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Note</th>
            <th>Created By</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in signupKeys" :key="key.id">
            <td class="key-value">
              <code>{{ key.key_value.substring(0, 12) }}...</code>
              <button 
                @click="copyToClipboard(key.key_value)" 
                class="copy-btn"
                title="Copy full key"
              >
                📋
              </button>
            </td>
            <td>
              <input 
                :value="key.note || ''" 
                @blur="updateSignupKeyNote(key.id, ($event.target as HTMLInputElement).value)"
                class="note-input"
                placeholder="Add note..."
              />
            </td>
            <td class="created-by">{{ key.created_by_username || '-' }}</td>
            <td class="date">{{ formatDate(key.created_at) }}</td>
            <td class="actions">
              <button 
                @click="deleteSignupKey(key.id)" 
                class="link-button danger small"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.signup-keys-management {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.create-form {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.keys-table {
  overflow-x: auto;
}

.keys-table table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.keys-table th,
.keys-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.keys-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.keys-table tr.used {
  opacity: 0.7;
  background: #f8f9fa;
}

.key-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-value code {
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
}

.copy-btn:hover {
  background: #e9ecef;
}

.note-input {
  border: 1px solid #ddd;
  padding: 4px 8px;
  border-radius: 4px;
  width: 100%;
  min-width: 120px;
}

.date {
  font-size: 12px;
  color: #6c757d;
}

.status-used {
  color: #dc3545;
  font-weight: 500;
}

.status-available {
  color: #28a745;
  font-weight: 500;
}

.used-by small {
  display: block;
  color: #6c757d;
  font-size: 11px;
}

.signup-note {
  font-style: italic;
  color: #6c757d;
}

.actions {
  text-align: center;
}

.no-actions {
  color: #6c757d;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.loading,
.no-keys {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.link-button.small {
  padding: 4px 8px;
  font-size: 12px;
}

.link-button.danger {
  background-color: #dc3545;
  color: white;
}

.link-button.danger:hover {
  background-color: #c82333;
}
</style>
