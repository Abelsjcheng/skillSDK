<template>
  <div>
    <button type="button" @click="setLocale('zh')">&#20013;&#25991;</button>
    <button type="button" @click="setLocale('en')">EN</button>
  </div>
</template>

<script>
export default {
  name: 'LanguageSwitcher',
  methods: {
    setLocale(value) {
      this.$i18n.locale = value;
    }
  }
};
</script>

<style scoped>
div {
  display: flex;
  gap: 8px;
}

button {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  cursor: pointer;
  padding: 6px 10px;
}
</style>
