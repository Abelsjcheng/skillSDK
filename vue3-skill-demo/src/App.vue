<template>
  <div class="app">
    <header class="header">
      <h1>{{ $t('title') }}</h1>
      <LanguageSwitcher />
    </header>

    <nav class="nav">
      <router-link to="/">{{ $t('nav.home') }}</router-link>
      <router-link to="/about">{{ $t('nav.about') }}</router-link>
    </nav>

    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';

export default {
  name: 'App',
  components: {
    LanguageSwitcher
  }
};
</script>

<style scoped>
.app {
  margin: 0 auto;
  max-width: 720px;
  padding: 24px;
  font-family: Arial, sans-serif;
}

.header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.nav {
  display: flex;
  gap: 16px;
  margin: 16px 0 24px;
}

.nav a {
  color: #1f6feb;
  text-decoration: none;
}

.nav a.router-link-active {
  font-weight: 700;
  text-decoration: underline;
}
</style>