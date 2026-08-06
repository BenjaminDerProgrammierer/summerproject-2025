<script setup>
import { ref, computed } from 'vue'
import {
    Pencil,
    ClipboardList,
    Info,
    CheckCircle2,
    Flame,
    Check,
    HelpCircle,
    AlertTriangle,
    X,
    Zap,
    Bug,
    List,
    Quote,
    ChevronDown
} from '@lucide/vue'
import { sanitizeHtml } from '../utils/sanitize-html'

// Props
const props = defineProps({
    type: { type: String, default: 'note' },
    title: { type: String, default: '' },
    icon: { type: String, default: '' },
    content: { type: String, default: '' },
    folded: { type: Boolean, default: false },
    children: { type: Array, default: () => [] }
})

const isCollapsed = ref(props.folded)
const isFoldable = computed(() => props.folded !== undefined)
const sanitizedContent = computed(() => sanitizeHtml(props.content))

const calloutStyles = {
    note: { color: '8, 109, 221', icon: Pencil },
    abstract: { color: '0, 191, 188', icon: ClipboardList },
    info: { color: '8, 109, 221', icon: Info },
    todo: { color: '8, 109, 221', icon: CheckCircle2 },
    important: { color: '0, 191, 188', icon: Flame },
    tip: { color: '0, 191, 188', icon: Flame },
    success: { color: '8, 185, 78', icon: Check },
    question: { color: '236, 117, 0', icon: HelpCircle },
    warning: { color: '236, 117, 0', icon: AlertTriangle },
    failure: { color: '233, 49, 71', icon: X },
    danger: { color: '233, 49, 71', icon: Zap },
    bug: { color: '233, 49, 71', icon: Bug },
    example: { color: '120, 82, 238', icon: List },
    quote: { color: '158, 158, 158', icon: Quote }
}

const style = computed(() => calloutStyles[props.type.toLowerCase()] || calloutStyles.note)
const iconComponent = computed(() => {
    if (props.icon && calloutStyles[props.icon]) {
        return calloutStyles[props.icon].icon
    }
    return style.value.icon
})
const titleToUse = computed(() => props.title || capitalize(props.type))

function toggleCollapse() {
    if (isFoldable.value) isCollapsed.value = !isCollapsed.value
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
</script>

<template>
    <div class="callout" :class="{ collapsed: isCollapsed, foldable: isFoldable }"
        :style="{ '--callout-color': style.color }">
        <div class="title" @click="toggleCollapse" :class="{ foldable: isFoldable }">
            <div class="title-left">
                <component :is="iconComponent" class="icon" :size="20" stroke-width="2" />
                {{ titleToUse }}
            </div>
            <ChevronDown v-if="isFoldable" class="fold-arrow" :size="20" stroke-width="2" />
        </div>

        <div class="content" v-if="!isCollapsed">
            <div v-if="sanitizedContent" v-html="sanitizedContent"></div>
            <Callout v-for="(child, index) in children" :key="index" v-bind="child" />
        </div>
    </div>
</template>

<style scoped>
.callout {
    border-left: 4px solid rgb(var(--callout-color));
    background-color: rgba(var(--callout-color), 0.1);
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    font-family: var(--body-font-family);
}

.title {
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
}

.foldable .title {
    cursor: pointer;
}

.title-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.fold-arrow {
    transition: transform 0.2s ease;
}

.collapsed .fold-arrow {
    transform: rotate(-90deg);
}

.content {
    margin-top: 0.5rem;
    padding-left: 1.5rem;
}

.content :deep(p:last-child) {
    margin-bottom: 0;
}

.collapsed .content {
    display: none;
}
</style>
