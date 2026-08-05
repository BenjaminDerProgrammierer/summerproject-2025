<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface SiteSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string;
  updated_at: string;
  updated_by_username: string;
}

const settings = ref<SiteSetting[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  await fetchSettings();
});

async function fetchSettings() {
  try {
    const response = await fetch('/api/site-settings', {
      credentials: 'include'
    });

    if (response.ok) {
      settings.value = await response.json();
    } else {
      throw new Error('Failed to fetch site settings');
    }
  } catch (err) {
    console.error('Error fetching site settings:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

async function updateSetting(key: string, value: string) {
  try {
    const response = await fetch(`/api/site-settings/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ value })
    });

    if (response.ok) {
      await fetchSettings();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update setting');
    }
  } catch (err) {
    console.error('Error updating setting:', err);
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

function getSettingDisplayName(key: string) {
  const names: Record<string, string> = {
    'site_visibility': 'Site Visibility',
    'registration_mode': 'Registration Mode'
  };
  return names[key] || key;
}

function getSettingOptions(key: string) {
  const options: Record<string, { value: string; label: string; description: string }[]> = {
    'site_visibility': [
      { value: 'public', label: 'Public', description: 'Anyone can view posts without logging in' },
      { value: 'private', label: 'Private', description: 'Users must log in to view posts' }
    ],
    'registration_mode': [
      { value: 'open', label: 'Open', description: 'Anyone can register without invitation' },
      { value: 'invite_only', label: 'Invite Only', description: 'Users need signup keys to register' },
      { value: 'closed', label: 'Closed', description: 'Registration is completely disabled' }
    ]
  };
  return options[key] || [];
}
</script>

<template>
  <div class="site-settings-management">
    <h2>Site Settings</h2>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading">
      Loading site settings...
    </div>

    <div v-else class="settings-list">
      <div v-for="setting in settings" :key="setting.id" class="setting-item">
        <div class="setting-header">
          <h3>{{ getSettingDisplayName(setting.setting_key) }}</h3>
          <small class="setting-description">{{ setting.description }}</small>
        </div>
        
        <div class="setting-content">
          <div class="setting-options">
            <div 
              v-for="option in getSettingOptions(setting.setting_key)" 
              :key="option.value"
              class="option"
            >
              <label class="option-label">
                <input 
                  type="radio" 
                  :name="setting.setting_key"
                  :value="option.value" 
                  :checked="setting.setting_value === option.value"
                  @change="updateSetting(setting.setting_key, option.value)"
                />
                <div class="option-content">
                  <strong>{{ option.label }}</strong>
                  <p>{{ option.description }}</p>
                </div>
              </label>
            </div>
          </div>
          
          <div class="setting-meta">
            <small>
              Last updated: {{ formatDate(setting.updated_at) }}
              <span v-if="setting.updated_by_username">
                by {{ setting.updated_by_username }}
              </span>
            </small>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-info">
      <h3>Settings Information</h3>
      <div class="info-items">
        <div class="info-item">
          <h4>Site Visibility</h4>
          <p>Controls whether users need to be logged in to view blog posts and content.</p>
          <ul>
            <li><strong>Public:</strong> Anyone can browse posts without authentication</li>
            <li><strong>Private:</strong> Users must log in to view any content</li>
          </ul>
        </div>
        
        <div class="info-item">
          <h4>Registration Mode</h4>
          <p>Controls how new users can register for accounts.</p>
          <ul>
            <li><strong>Open:</strong> Anyone can register with just email/username/password</li>
            <li><strong>Invite Only:</strong> Users need a signup key from an admin to register</li>
            <li><strong>Closed:</strong> No new registrations allowed</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.site-settings-management {
  padding: 20px;
}

.settings-list {
  margin-bottom: 40px;
}

.setting-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.setting-header h3 {
  margin: 0 0 5px 0;
  color: #495057;
}

.setting-description {
  color: #6c757d;
  font-style: italic;
}

.setting-content {
  margin-top: 15px;
}

.setting-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.option {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.option:hover {
  border-color: #007bff;
}

.option-label {
  display: flex;
  align-items: flex-start;
  padding: 15px;
  cursor: pointer;
  gap: 12px;
}

.option-label input[type="radio"] {
  margin-top: 2px;
  flex-shrink: 0;
}

.option-content {
  flex: 1;
}

.option-content strong {
  display: block;
  margin-bottom: 4px;
  color: #495057;
}

.option-content p {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
  line-height: 1.4;
}

.option-label:has(input:checked) {
  background: #e7f3ff;
  border-color: #007bff;
}

.setting-meta {
  border-top: 1px solid #e9ecef;
  padding-top: 10px;
  color: #6c757d;
  font-size: 12px;
}

.settings-info {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.settings-info h3 {
  margin-top: 0;
  color: #495057;
}

.info-items {
  display: grid;
  gap: 20px;
}

.info-item h4 {
  margin: 0 0 8px 0;
  color: #495057;
}

.info-item p {
  margin: 0 0 10px 0;
  color: #6c757d;
}

.info-item ul {
  margin: 0;
  padding-left: 20px;
}

.info-item li {
  margin-bottom: 5px;
  color: #6c757d;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

@media (min-width: 768px) {
  .setting-options {
    flex-direction: row;
  }
  
  .option {
    flex: 1;
  }
  
  .info-items {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
