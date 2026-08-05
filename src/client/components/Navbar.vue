<!-- unused -->
<script setup lang="ts">
import Logo from './Logo.vue';
</script>

<template>
    <nav id="navbar">
        <Logo inline="true"/>
        <div class="right">
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/destinations">View Destinations</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Author Posts</a></li>
            </ul>
            <a href="#" id="login" class="link-button primary bordered">Log In</a>
            <a href="#" id="signup" class="link-button primary">Sign Up</a>
        </div>
    </nav>
</template>

<style>
nav#navbar {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8f8f8;
    padding: 10px;
    height: 80px;

    & ul {
        display: flex;
        gap: 20px;
        list-style: none;

        & li {
            font-size: 18px;
        }
    }

    & .right {
        display: flex;
        gap: 20px;

        & ul {
            display: flex;
            gap: 20px;
            list-style: none;
            align-items: center;

            & a {
                text-decoration: none;
                color: black;
                font-family: var(--heading-font-family);

                &:hover {
                    color: var(--color-primary);
                }
            }
        }
    }
}
</style>