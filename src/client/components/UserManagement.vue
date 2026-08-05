<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
}

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref('');

// User being edited
const editingUserId = ref<number | null>(null);
const selectedRoleId = ref<number | null>(null);

// User edit form 
const editForm = ref({
  id: null as number | null,
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// Delete confirmation
const userToDelete = ref<User | null>(null);
const showDeleteConfirm = ref(false);

// Reset password
const resetPasswordUserId = ref<number | null>(null);
const resetPasswordForm = ref({
  newPassword: '',
  confirmPassword: ''
});

// Edit mode
const editMode = ref<'role' | 'profile' | 'password' | 'delete' | null>(null);

onMounted(async () => {
  await Promise.all([fetchUsers(), fetchRoles()]);
  loading.value = false;
});

async function fetchUsers() {
  try {
    const response = await fetch(`/api/auth/users`, {
      credentials: 'include'
    });

    if (response.ok) {
      users.value = await response.json();
    } else {
      throw new Error('Failed to fetch users');
    }
  } catch (err) {
    console.error('Error fetching users:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

async function fetchRoles() {
  try {
    const response = await fetch(`/api/auth/roles`, {
      credentials: 'include'
    });

    if (response.ok) {
      roles.value = await response.json();
    } else {
      throw new Error('Failed to fetch roles');
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

function startEditRole(user: User) {
  // Reset any previous edit mode
  cancelEdit();

  editingUserId.value = user.id;
  editMode.value = 'role';

  // Find role id from role name
  const roleObj = roles.value.find(r => r.name === user.role);
  selectedRoleId.value = roleObj ? roleObj.id : null;
}

function startEditProfile(user: User) {
  // Reset any previous edit mode
  cancelEdit();

  editingUserId.value = user.id;
  editMode.value = 'profile';

  editForm.value = {
    id: user.id,
    username: user.username,
    email: user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
}

function startResetPassword(user: User) {
  // Reset any previous edit mode
  cancelEdit();

  resetPasswordUserId.value = user.id;
  editMode.value = 'password';

  resetPasswordForm.value = {
    newPassword: '',
    confirmPassword: ''
  };
}

function startDeleteUser(user: User) {
  // Reset any previous edit mode
  cancelEdit();

  userToDelete.value = user;
  showDeleteConfirm.value = true;
  editMode.value = 'delete';
}

function cancelEdit() {
  editingUserId.value = null;
  selectedRoleId.value = null;
  resetPasswordUserId.value = null;
  userToDelete.value = null;
  showDeleteConfirm.value = false;
  editMode.value = null;

  editForm.value = {
    id: null,
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  resetPasswordForm.value = {
    newPassword: '',
    confirmPassword: ''
  };
}

async function updateUserRole(userId: number) {
  if (!selectedRoleId.value) {
    error.value = 'Please select a role';
    return;
  }

  try {
    const response = await fetch(`/api/auth/users/${userId}/`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roleId: selectedRoleId.value })
    });

    if (response.ok) {
      showSuccessMessage('User role updated successfully');
      await fetchUsers();
      cancelEdit();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to update user role');
    }
  } catch (err) {
    console.error('Error updating user role:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

async function updateUserProfile() {
  // Validate form fields
  if (!editForm.value.username || !editForm.value.email) {
    error.value = 'Username and email are required';
    return;
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(editForm.value.email)) {
    error.value = 'Please enter a valid email address';
    return;
  }

  try {
    const response = await fetch(`/api/auth/users/${editForm.value.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: editForm.value.username,
        email: editForm.value.email
      })
    });

    if (response.ok) {
      showSuccessMessage('User profile updated successfully');
      await fetchUsers();
      cancelEdit();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to update user profile');
    }
  } catch (err) {
    console.error('Error updating user profile:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

async function resetPassword() {
  // Validate form fields
  if (!resetPasswordForm.value.newPassword || !resetPasswordForm.value.confirmPassword) {
    error.value = 'Please enter and confirm the new password';
    return;
  }

  if (resetPasswordForm.value.newPassword.length < 8) {
    error.value = 'Password must be at least 8 characters long';
    return;
  }

  if (resetPasswordForm.value.newPassword !== resetPasswordForm.value.confirmPassword) {
    error.value = 'Passwords do not match';
    return;
  }

  try {
    const response = await fetch(`/api/auth/users/${resetPasswordUserId.value}/password`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: resetPasswordForm.value.newPassword
      })
    });

    if (response.ok) {
      showSuccessMessage('Password reset successfully');
      cancelEdit();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to reset password');
    }
  } catch (err) {
    console.error('Error resetting password:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

async function deleteUser() {
  if (!userToDelete.value) {
    error.value = 'No user selected for deletion';
    return;
  }

  try {
    const response = await fetch(`/api/auth/users/${userToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      showSuccessMessage(`User ${userToDelete.value.username} deleted successfully`);
      await fetchUsers();
      cancelEdit();
    } else {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete user');
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    error.value = err instanceof Error ? err.message : 'An error occurred';
  }
}

function showSuccessMessage(message: string) {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = '';
  }, 3000);
}
</script>

<template>
  <div class="user-management">
    <h3>User Management</h3>

    <div v-if="loading" class="loading">
      Loading users...
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
      <button @click="error = null; cancelEdit()" class="link-button secondary small">Dismiss</button>
    </div>

    <div v-else-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <div v-if="users.length === 0" class="no-users">
      No users found.
    </div>

    <div v-else class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span v-if="editingUserId === user.id && editMode === 'role'" class="role-editor">
                <select v-model="selectedRoleId">
                  <option :value="null">-- Select Role --</option>
                  <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
                </select>
                <button @click="updateUserRole(user.id)" class="link-button primary small">Save</button>
                <button @click="cancelEdit()" class="link-button secondary small">Cancel</button>
              </span>
              <span v-else class="role-badge" :class="user.role">{{ user.role }}</span>
            </td>
            <td>{{ new Date(user.created_at).toLocaleDateString('de-AT', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
              }) }}</td>
            <td class="actions-cell">
              <div v-if="editingUserId !== user.id && resetPasswordUserId !== user.id && !showDeleteConfirm"
                class="action-buttons">
                <button @click="startEditProfile(user)" class="link-button primary small">Edit</button>
                <button @click="startEditRole(user)" class="link-button secondary small">Role</button>
                <button @click="startResetPassword(user)" class="link-button warning small">Reset</button>
                <button @click="startDeleteUser(user)" class="link-button danger small">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Edit Profile Form -->
      <div v-if="editMode === 'profile'" class="edit-form-container">
        <div class="edit-form">
          <h4>Edit User</h4>
          <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" v-model="editForm.username" required>
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" v-model="editForm.email" required>
          </div>
          <div class="form-actions">
            <button @click="updateUserProfile()" class="link-button primary">Save Changes</button>
            <button @click="cancelEdit()" class="link-button secondary">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Reset Password Form -->
      <div v-if="editMode === 'password'" class="edit-form-container">
        <div class="edit-form">
          <h4>Reset Password</h4>
          <div class="form-group">
            <label for="new-password">New Password:</label>
            <input type="password" id="new-password" v-model="resetPasswordForm.newPassword" required>
          </div>
          <div class="form-group">
            <label for="confirm-password">Confirm Password:</label>
            <input type="password" id="confirm-password" v-model="resetPasswordForm.confirmPassword" required>
          </div>
          <div class="form-actions">
            <button @click="resetPassword()" class="link-button warning">Reset Password</button>
            <button @click="cancelEdit()" class="link-button secondary">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation -->
      <div v-if="editMode === 'delete'" class="edit-form-container">
        <div class="edit-form">
          <h4>Delete User</h4>
          <p class="warning-text">Are you sure you want to delete user "{{ userToDelete?.username }}"?</p>
          <p class="warning-text">This action cannot be undone.</p>
          <div class="form-actions">
            <button @click="deleteUser()" class="link-button danger">Delete User</button>
            <button @click="cancelEdit()" class="link-button secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-management {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  position: relative;
}

.loading,
.no-users {
  text-align: center;
  padding: 15px;
  color: #666;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.users-table-container {
  overflow-x: auto;
  position: relative;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.users-table th {
  background-color: #f5f5f5;
}

.users-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.role-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  background-color: #eee;
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

.role-editor {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.role-editor select {
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.edit-actions {
  display: flex;
  gap: 5px;
}

.action-buttons {
  display: flex;
  gap: 5px;
  flex-wrap: nowrap;
}

.link-button.small {
  font-size: 12px;
  padding: 3px 8px;
}

.link-button.warning {
  background-color: #f39c12;
  color: white;
}

.link-button.warning:hover {
  background-color: #d68910;
}

.link-button.danger {
  background-color: #e74c3c;
  color: white;
}

.link-button.danger:hover {
  background-color: #c0392b;
}

.edit-form-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.edit-form {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.edit-form h4 {
  margin-top: 0;
  margin-bottom: 20px;
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

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.warning-text {
  color: #e74c3c;
  font-weight: bold;
}
</style>