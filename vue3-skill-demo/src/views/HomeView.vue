<template>
  <section>
    <p>{{ $t('home.welcome') }}</p>
    <p>{{ $t('home.count') }}: {{ count }}</p>
    <button type="button" @click="addCount">{{ $t('button.increment') }}</button>
  </section>
</template>

<script>
export default {
  name: 'HomeView',
  computed: {
    count() {
      return this.$store.state.count;
    }
  },
  methods: {
    addCount() {
      this.$store.dispatch('increment');
    }
  }
};
</script>

<style scoped>
button {
  background: #1f6feb;
  border: 0;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  padding: 8px 12px;
}
</style>