<template>
  <main class="legal-page" data-test="legal-document-page">
    <section class="legal-card" aria-labelledby="legal-title">
      <button class="back-button" type="button" data-test="legal-back" @click="$emit('back')">返回登录</button>
      <p class="brand">FRUIT PARTY</p>
      <h1 id="legal-title">{{ documentContent.title }}</h1>
      <p class="intro">请在继续使用前阅读以下内容。</p>

      <article class="legal-content">
        <section v-for="section in documentContent.sections" :key="section.title">
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </section>
      </article>
    </section>
  </main>
</template>

<script>
const DOCUMENTS = {
  user: {
    title: '用户协议',
    sections: [
      { title: '账号与使用', paragraphs: ['欢迎使用水果切切乐。请妥善保管你的账号与密码，并使用本人账号进行游戏。'] },
      { title: '游戏数据', paragraphs: ['游戏分数、金币、能量、道具和关卡进度以服务端记录为准；篡改客户端或利用漏洞的行为可能导致账号受到限制。'] },
      { title: '服务调整', paragraphs: ['为维护、安全和更新需要，服务可能调整游戏内容；涉及账号权益的重要变更会通过站内通知说明。'] },
    ],
  },
  privacy: {
    title: '隐私政策',
    sections: [
      { title: '我们处理的信息', paragraphs: ['为提供登录、进度保存、排行榜和通知服务，我们会处理你提交的用户名、经安全处理的密码凭证和游戏行为记录。'] },
      { title: '信息用途', paragraphs: ['这些数据用于账号验证、保存进度、防止作弊和改进游戏体验，不会在未说明用途的情况下向其他玩家公开。'] },
      { title: '数据管理', paragraphs: ['你可以通过账户设置或联系运营方了解账号数据与服务状态；必要记录会按适用规则保留。'] },
    ],
  },
}

export default {
  name: 'LegalDocument',
  props: {
    documentType: { type: String, required: true },
  },
  computed: {
    documentContent() {
      return DOCUMENTS[this.documentType] || DOCUMENTS.user
    },
  },
}
</script>

<style scoped>
.legal-page { display: grid; min-height: 100vh; place-items: center; padding: 32px 20px; background: radial-gradient(circle at 82% 18%, #2c2563 0, #14264a 30%, #081529 74%); }
.legal-card { width: min(100%, 680px); padding: 30px; border: 1px solid #58709b; border-radius: 8px; background: #101f3ce8; box-shadow: 0 22px 54px #020716a8; }
.back-button { min-height: 36px; padding: 0 12px; border: 1px solid #516a94; border-radius: 5px; background: #0a1730; color: #d6e1f1; font-size: 13px; }
.brand { margin: 24px 0 8px; color: #ffd36a; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
h1 { margin: 0; color: #f7f9ff; font-size: 28px; }
.intro { margin: 9px 0 24px; color: #afc0db; font-size: 13px; }
.legal-content { border-top: 1px solid #314766; }
.legal-content section { padding: 18px 0; border-bottom: 1px solid #314766; }
.legal-content h2 { margin: 0 0 8px; color: #f0c85c; font-size: 15px; }
.legal-content p { margin: 0; color: #c2cedf; font-size: 14px; line-height: 1.8; }
</style>
