<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface DestinationConfig {
  enabled: boolean;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  placeId: string;
  timezone: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
  timeFormat: '12' | '24';
}

interface PlaceResult {
  id: string;
  placeId: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const config = ref<DestinationConfig>({
  enabled: false,
  name: 'Destination',
  country: '',
  latitude: 0,
  longitude: 0,
  placeId: 'unconfigured',
  timezone: 'UTC',
  temperatureUnit: 'celsius',
  timeFormat: '24',
});
const query = ref('');
const results = ref<PlaceResult[]>([]);
const loading = ref(true);
const searching = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

async function responseMessage(response: Response, fallback: string) {
  try {
    const data = await response.json() as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

async function fetchConfig() {
  try {
    const response = await fetch('/api/site-settings/destination');
    if (!response.ok) throw new Error(await responseMessage(response, 'Failed to load destination settings'));
    config.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load destination settings';
  } finally {
    loading.value = false;
  }
}

async function searchDestinations() {
  if (query.value.trim().length < 2) {
    error.value = 'Enter at least two characters to search.';
    return;
  }

  searching.value = true;
  error.value = null;
  success.value = null;
  try {
    const params = new URLSearchParams({ q: query.value.trim() });
    const response = await fetch(`/api/site-settings/destination/search?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error(await responseMessage(response, 'Destination search failed'));
    results.value = await response.json();
    if (results.value.length === 0) error.value = 'No matching destinations found.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Destination search failed';
  } finally {
    searching.value = false;
  }
}

function selectPlace(place: PlaceResult) {
  config.value = {
    ...config.value,
    enabled: true,
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.placeId,
    timezone: place.timezone,
  };
  query.value = '';
  results.value = [];
  success.value = `${place.name} selected. Save changes to publish it.`;
}

async function saveConfig() {
  saving.value = true;
  error.value = null;
  success.value = null;
  try {
    const response = await fetch('/api/site-settings/destination', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value),
    });
    if (!response.ok) throw new Error(await responseMessage(response, 'Failed to save destination settings'));
    config.value = await response.json();
    success.value = 'Destination widgets updated.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save destination settings';
  } finally {
    saving.value = false;
  }
}

onMounted(fetchConfig);
</script>

<template>
  <div class="destination-settings">
    <div class="heading">
      <div>
        <h2>Destination Widgets</h2>
        <p>Choose the place shown in the home-page clock and weather strip.</p>
      </div>
      <label class="visibility-toggle">
        <input v-model="config.enabled" type="checkbox" :disabled="loading">
        <span>Show widgets</span>
      </label>
    </div>

    <p v-if="error" class="message error-message">{{ error }}</p>
    <p v-if="success" class="message success-message">{{ success }}</p>
    <p v-if="loading" class="loading">Loading destination settings…</p>

    <template v-else>
      <form class="search" @submit.prevent="searchDestinations">
        <label for="destination-search">Find a city or destination</label>
        <div class="search-row">
          <input id="destination-search" v-model="query" type="search" placeholder="e.g. Kyoto" autocomplete="off">
          <button class="link-button secondary" type="submit" :disabled="searching">
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
        </div>
      </form>

      <div v-if="results.length" class="search-results">
        <button v-for="place in results" :key="place.id" type="button" @click="selectPlace(place)">
          <strong>{{ place.name }}</strong>
          <span>{{ [place.region, place.country].filter(Boolean).join(', ') }}</span>
        </button>
      </div>

      <div class="selected-destination">
        <div>
          <span class="label">Selected destination</span>
          <strong>{{ config.name }}</strong>
          <span>{{ config.country || 'No country' }} · {{ config.timezone }}</span>
        </div>
        <label>
          Temperature
          <select v-model="config.temperatureUnit">
            <option value="celsius">Celsius (°C)</option>
            <option value="fahrenheit">Fahrenheit (°F)</option>
          </select>
        </label>
        <label>
          Time
          <select v-model="config.timeFormat">
            <option value="24">24-hour</option>
            <option value="12">12-hour</option>
          </select>
        </label>
      </div>

      <div class="actions">
        <button class="link-button primary" type="button" :disabled="saving" @click="saveConfig">
          {{ saving ? 'Saving…' : 'Save Changes' }}
        </button>
        <span>Weather data is provided by Weather.com.</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.destination-settings {
  padding: 20px;
}

.heading,
.selected-destination,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.heading h2,
.heading p {
  margin: 0;
}

.heading p,
.actions span,
.selected-destination span {
  color: #6c757d;
  font-size: 0.85rem;
}

.visibility-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.search {
  margin-top: 28px;
}

.search > label,
.selected-destination label {
  display: block;
  margin-bottom: 7px;
  font-weight: 600;
}

.search-row {
  display: flex;
  gap: 10px;
}

.search-row input,
.selected-destination select {
  width: 100%;
  padding: 9px;
  border: 1px solid #d7dce1;
  border-radius: 5px;
  background: #fff;
}

.search-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.search-results button {
  display: flex;
  flex-direction: column;
  padding: 11px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.search-results button:hover {
  border-color: #27ae60;
}

.search-results span {
  margin-top: 3px;
  color: #6c757d;
  font-size: 0.78rem;
}

.selected-destination {
  margin-top: 24px;
  padding: 18px;
  border: 1px solid #e3e7ea;
  border-radius: 8px;
  background: #f8f9fa;
}

.selected-destination > div {
  display: flex;
  flex-direction: column;
  margin-right: auto;
}

.selected-destination strong {
  margin: 2px 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.selected-destination .label {
  color: #27ae60;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.actions {
  justify-content: flex-start;
  margin-top: 20px;
}

.message {
  padding: 10px;
  border-radius: 4px;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
}

.success-message {
  background: #d4edda;
  color: #155724;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 650px) {
  .heading,
  .selected-destination,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
