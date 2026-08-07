<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

interface Destination {
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

interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
  unit: string;
}

const destination = ref<Destination | null>(null);
const weather = ref<CurrentWeather | null>(null);
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | undefined;
let weatherTimer: ReturnType<typeof setInterval> | undefined;

const destinationTime = computed(() => {
  if (!destination.value) return '';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: destination.value.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: destination.value.timeFormat === '12',
  }).format(now.value);
});

const localTime = computed(() => {
  if (!destination.value) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: destination.value.timeFormat === '12',
  }).format(now.value);
});

const localDate = computed(() => {
  if (!destination.value) return '';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: destination.value.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now.value);
});

const weatherDescription = computed(() => {
  return weather.value?.description ?? '';
});

const weatherIcon = computed(() => {
  const code = weather.value?.weatherCode;
  if (code === undefined) return '—';
  if ([31, 33].includes(code)) return '🌙';
  if ([32, 34, 36].includes(code)) return '☀️';
  if ([27, 28, 29, 30, 44].includes(code)) return weather.value?.isDay ? '🌤️' : '☁️';
  if (code === 26) return '☁️';
  if ([19, 20, 21, 22].includes(code)) return '🌫️';
  if ([11, 12, 35, 39, 40].includes(code)) return '🌧️';
  if ([5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 41, 42, 43].includes(code)) return '❄️';
  if ([0, 1, 2, 3, 4, 37, 38, 45, 47].includes(code)) return '⛈️';
  if ([23, 24].includes(code)) return '💨';
  return '🌡️';
});

async function fetchWeather() {
  try {
    const response = await fetch('/api/site-settings/destination/weather');
    if (response.ok) weather.value = await response.json();
  } catch (error) {
    console.error('Error fetching destination weather:', error);
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/site-settings/destination');
    if (!response.ok) return;
    const configuredDestination = await response.json() as Destination;
    if (!configuredDestination.enabled) return;
    destination.value = configuredDestination;
    await fetchWeather();
    clockTimer = setInterval(() => { now.value = new Date(); }, 1_000);
    weatherTimer = setInterval(fetchWeather, 10 * 60 * 1_000);
  } catch (error) {
    console.error('Error fetching destination:', error);
  }
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (weatherTimer) clearInterval(weatherTimer);
});
</script>

<template>
  <section v-if="destination" class="destination-widget" aria-label="Destination time and weather">
    <div class="destination-name">
      <span class="eyebrow">Current destination</span>
      <strong>{{ destination.name }}</strong>
      <span v-if="destination.country">{{ destination.country }}</span>
    </div>
    <div class="widget-divider" aria-hidden="true"></div>
    <div class="clock">
      <span class="local-time">Local {{ localTime }}</span>
      <span class="widget-value">{{ destinationTime }}</span>
      <span>{{ localDate }}</span>
    </div>
    <div class="widget-divider" aria-hidden="true"></div>
    <div class="weather">
      <span class="weather-icon" aria-hidden="true">{{ weatherIcon }}</span>
      <div v-if="weather">
        <span class="widget-value">{{ Math.round(weather.temperature) }}{{ weather.unit }}</span>
        <span>{{ weatherDescription }}</span>
      </div>
      <span v-else class="weather-unavailable">Weather unavailable</span>
    </div>
    <a class="weather-credit" href="https://weather.com/" target="_blank" rel="noopener">Weather.com</a>
  </section>
</template>

<style scoped>
.destination-widget {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(18px, 4vw, 52px);
  width: 100%;
  min-height: 112px;
  padding: 20px 10%;
  background: #fff;
  color: #2c3e50;
  box-shadow: 0 8px 24px rgba(31, 45, 61, 0.07);
}

.destination-name,
.clock,
.weather,
.weather > div {
  display: flex;
  flex-direction: column;
}

.destination-name strong,
.widget-value {
  color: #1e2b36;
  font-family: var(--heading-font-family);
  font-size: clamp(1.25rem, 2.4vw, 1.75rem);
  font-weight: 650;
  line-height: 1.1;
}

.clock .widget-value {
  display: inline-block;
  min-width: 11ch;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.local-time {
  margin-bottom: 4px;
  color: #6c757d;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.weather .widget-value {
  display: inline-block;
  min-width: 5ch;
  font-variant-numeric: tabular-nums;
}

.destination-name > span:last-child,
.clock > span:last-child,
.weather > div > span:last-child,
.weather-unavailable {
  margin-top: 4px;
  color: #6c757d;
  font-size: 0.8rem;
}

.eyebrow {
  margin-bottom: 4px;
  color: #27ae60;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.weather {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.weather-icon {
  font-size: 2rem;
  line-height: 1;
}

.widget-divider {
  align-self: stretch;
  width: 1px;
  background: #e6e9ec;
}

.weather-credit {
  position: absolute;
  right: 12px;
  bottom: 7px;
  color: #9099a1;
  font-size: 0.6rem;
  text-decoration: none;
}

@media (max-width: 650px) {
  .destination-widget {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 16px 24px;
    padding: 18px 7%;
  }

  .destination-name {
    width: 100%;
  }

  .widget-divider {
    display: none;
  }
}
</style>
