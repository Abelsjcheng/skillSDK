import Vue from 'vue';
import VueI18n from 'vue-i18n';

Vue.use(VueI18n);

const messages = {
  en: {
    title: 'Vue2 Skill SDK Demo',
    nav: {
      home: 'Home',
      about: 'About'
    },
    home: {
      welcome: 'Welcome to Vue 2.6.14 demo.',
      count: 'Current count'
    },
    about: {
      desc: 'This page is powered by vue-router.'
    },
    button: {
      increment: 'Increment'
    }
  },
  zh: {
    title: 'Vue2 Skill SDK \u793a\u4f8b',
    nav: {
      home: '\u9996\u9875',
      about: '\u5173\u4e8e'
    },
    home: {
      welcome: '\u6b22\u8fce\u4f7f\u7528 Vue 2.6.14 \u793a\u4f8b\u9879\u76ee\u3002',
      count: '\u5f53\u524d\u8ba1\u6570'
    },
    about: {
      desc: '\u8be5\u9875\u9762\u7531 vue-router \u9a71\u52a8\u3002'
    },
    button: {
      increment: '\u52a0\u4e00'
    }
  }
};

export default new VueI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  messages
});
