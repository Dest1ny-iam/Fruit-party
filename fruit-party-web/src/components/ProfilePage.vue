<template>
  <main class="profile-page" data-test="profile-page">
    <section class="profile-shell" aria-labelledby="profile-title">
      <header class="profile-header">
        <button type="button" class="back-button" data-test="back-from-profile" title="返回大厅" @click="$emit('back')"><span aria-hidden="true">←</span><b>大厅</b></button>
        <p class="profile-kicker">FRUIT PARTY</p>
        <span class="header-spacer" aria-hidden="true"></span>
      </header>

      <section class="profile-summary" data-test="profile-summary">
        <div class="identity-block">
          <div class="avatar-ring" aria-hidden="true">
            <img v-if="isImageAvatar(avatar)" :src="avatar" alt="" />
            <span v-else>{{ avatar }}</span>
          </div>
          <div class="identity-copy">
            <p class="identity-label">水果派对玩家</p>
            <h1 id="profile-title" data-test="profile-name">{{ username }}</h1>
            <p class="identity-caption">下一刀，解锁新的水果战绩</p>
            <div class="identity-actions">
              <button class="avatar-edit" type="button" data-test="open-avatar-picker" @click="showAvatarPicker = !showAvatarPicker">更换头像</button>
              <button class="username-edit" type="button" data-test="open-username-editor" @click="openUsernameEditor">修改用户名</button>
            </div>
          </div>
        </div>

        <section class="resource-strip" data-test="profile-resources" aria-label="玩家资源">
          <article class="resource-card coin-resource">
            <span class="resource-icon" aria-hidden="true">◈</span>
            <div><small>金币</small><strong data-test="profile-coins">{{ coins }}</strong></div>
          </article>
          <article class="resource-card energy-resource">
            <span class="resource-icon" aria-hidden="true">⚡</span>
            <div><small>能量</small><strong>{{ energy }}<em>/5</em></strong></div>
          </article>
        </section>
      </section>

      <form v-if="showUsernameEditor" class="username-editor" data-test="username-form" @submit.prevent="saveUsername">
        <label>
          用户名
          <input v-model.trim="usernameDraft" data-test="username-input" type="text" minlength="2" maxlength="16" autocomplete="username" required />
        </label>
        <button class="save-username" type="submit">保存</button>
        <button class="cancel-username" type="button" @click="showUsernameEditor = false">取消</button>
        <p v-if="usernameError" class="username-error" role="alert">{{ usernameError }}</p>
      </form>

      <section v-if="showAvatarPicker" class="avatar-picker" aria-label="选择头像">
        <div class="preset-avatars">
          <button v-for="option in avatarOptions" :key="option" :data-test="`avatar-option-${option}`" :class="{ selected: option === avatar }" type="button" @click="selectAvatar(option)">{{ option }}</button>
        </div>
        <span class="picker-divider">或</span>
        <label class="local-avatar-button" :class="{ disabled: avatarProcessing }">
          <input
            ref="localAvatarInput"
            data-test="local-avatar-input"
            type="file"
            accept="image/*"
            :disabled="avatarProcessing"
            @change="selectLocalAvatar"
          />
          <span aria-hidden="true">+</span>
          {{ avatarProcessing ? '正在处理' : '从本地选择' }}
        </label>
        <p v-if="avatarError" class="avatar-error" data-test="avatar-error" role="alert">{{ avatarError }}</p>
      </section>

      <div class="profile-content">
        <section class="progress-section profile-panel" aria-labelledby="progress-title">
          <div class="section-heading">
            <div><p class="section-kicker">CHALLENGE</p><h2 id="progress-title">闯关进度</h2></div>
            <span>共 10 关</span>
          </div>
          <p class="section-description">完成当前关卡后，下一关会加入你的挑战清单。</p>
          <article class="mode-progress" data-test="normal-progress">
            <div class="mode-mark normal-mark">N</div>
            <div class="progress-copy"><strong>普通模式</strong><small>已解锁至第 {{ highestLevel }} 关</small><div class="progress-track"><span :style="{ width: `${normalProgress}%` }"></span></div></div>
            <b>{{ highestLevel }}/10</b>
          </article>
          <article class="mode-progress" data-test="hard-progress">
            <div class="mode-mark hard-mark">H</div>
            <div class="progress-copy"><strong>困难模式</strong><small>已解锁至第 {{ highestHardLevel }} 关</small><div class="progress-track"><span :style="{ width: `${hardProgress}%` }"></span></div></div>
            <b>{{ highestHardLevel }}/10</b>
          </article>
        </section>

        <section class="activity-section profile-panel" data-test="profile-activity" aria-labelledby="activity-title">
          <div class="section-heading">
            <div><p class="section-kicker">ACTIVITY</p><h2 id="activity-title" data-test="profile-activity-title">最近动态</h2></div>
            <span>金币记录</span>
          </div>
          <p v-if="coinLedger.length === 0" class="ledger-empty">完成一局挑战后，奖励和消费会显示在这里。</p>
          <div v-else class="activity-list">
            <article v-for="(entry, index) in coinLedger.slice(0, 4)" :key="`${entry.occurredAt}-${index}`" class="ledger-row">
              <span class="activity-dot" :class="entry.amount >= 0 ? 'income-dot' : 'expense-dot'" aria-hidden="true"></span>
              <div><strong>{{ entry.title }}</strong><small>{{ entry.occurredAt }}</small></div>
              <b :class="entry.amount >= 0 ? 'income' : 'expense'">{{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}</b>
            </article>
          </div>
        </section>
      </div>

      <footer class="profile-footer">
        <span>账号设置</span>
        <button class="logout-player" type="button" data-test="logout-player" @click="$emit('logout')">退出登录</button>
      </footer>
    </section>
  </main>
</template>

<script>
import { isImageAvatar, prepareAvatarImage } from '../utils/avatar-image'

export default {
  name: 'ProfilePage',
  emits: ['back', 'avatar-change', 'username-change', 'logout'],
  props: {
    username: { type: String, default: '水果新手' },
    avatar: { type: String, default: '🍉' },
    coins: { type: Number, default: 0 },
    energy: { type: Number, default: 5 },
    highestLevel: { type: Number, default: 1 },
    highestHardLevel: { type: Number, default: 1 },
    coinLedger: { type: Array, default: () => [] },
    avatarProcessor: { type: Function, default: prepareAvatarImage },
  },
  data() {
    return {
      showAvatarPicker: false,
      avatarOptions: ['🍉', '🍓', '🍍', '🍊', '🍇', '🍌'],
      avatarProcessing: false,
      avatarError: '',
      showUsernameEditor: false,
      usernameDraft: this.username,
      usernameError: '',
    }
  },
  computed: {
    normalProgress() { return Math.min(100, (this.highestLevel / 10) * 100) },
    hardProgress() { return Math.min(100, (this.highestHardLevel / 10) * 100) },
  },
  methods: {
    isImageAvatar,
    selectAvatar(avatar) {
      this.avatarError = ''
      this.showAvatarPicker = false
      this.$emit('avatar-change', avatar)
    },
    openUsernameEditor() {
      this.usernameDraft = this.username
      this.usernameError = ''
      this.showUsernameEditor = true
    },
    saveUsername() {
      const nextUsername = this.usernameDraft.trim()
      if (nextUsername.length < 2 || nextUsername.length > 16) {
        this.usernameError = '用户名需要为 2 到 16 个字符。'
        return
      }
      this.showUsernameEditor = false
      this.usernameError = ''
      this.$emit('username-change', nextUsername)
    },
    async selectLocalAvatar(event) {
      const input = event.target
      const file = input.files?.[0]
      if (!file || this.avatarProcessing) return
      this.avatarProcessing = true
      this.avatarError = ''
      try {
        const preparedAvatar = await this.avatarProcessor(file)
        this.showAvatarPicker = false
        this.$emit('avatar-change', preparedAvatar)
      } catch (error) {
        this.avatarError = error?.message || '头像处理失败，请换一张图片重试。'
      } finally {
        this.avatarProcessing = false
        input.value = ''
      }
    },
  },
}
</script>

<style scoped>
.profile-page { min-height: 100vh; padding: 32px 20px; background: radial-gradient(circle at 50% 0%, #172746 0, #080f1d 45%, #050914 100%); color: #eef4ff; }
.profile-shell { width: min(680px, 100%); margin: 0 auto; }.profile-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }.profile-kicker { margin: 0; color: #d9bb61; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-align: center; }.header-spacer { display: block; }.back-button { justify-self: start; min-height: 34px; padding: 0 12px; border: 1px solid #456184; background: #0c172a; color: #d7e4f7; cursor: pointer; }.back-button:hover { border-color: #d6b65b; color: #f6d875; }
.identity-block { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 48px 0 32px; text-align: left; }.avatar-ring { display: grid; width: 92px; height: 92px; flex: 0 0 92px; overflow: hidden; place-items: center; border: 2px solid #d6b65b; border-radius: 50%; background: #132342; box-shadow: 0 0 0 7px #d6b65b16, 0 15px 35px #0008; font-size: 42px; }.avatar-ring img { width: 100%; height: 100%; object-fit: cover; }.identity-label { margin: 0 0 6px; color: #9db1cf; font-size: 10px; letter-spacing: 1.4px; }.identity-block h1 { margin: 0; font-size: 30px; }.identity-caption { margin: 7px 0 0; color: #98abc7; font-size: 12px; }
.identity-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }.avatar-edit, .username-edit { min-height: 28px; padding: 0 9px; border: 1px solid #48658b; background: #0e1c31; color: #c9d9ee; font-size: 10px; cursor: pointer; }.avatar-edit:hover, .username-edit:hover { border-color: #d6b65b; color: #f6d875; }.username-editor { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: end; gap: 8px; margin: -18px auto 28px; padding: 14px; border: 1px solid #293f5f; background: #0a1424; }.username-editor label { display: grid; gap: 6px; color: #9db1cf; font-size: 10px; }.username-editor input { min-height: 34px; padding: 0 9px; border: 1px solid #48658b; background: #0d192d; color: #eff5ff; font: inherit; }.save-username, .cancel-username { min-height: 34px; padding: 0 12px; border: 1px solid #536b8d; background: #102037; color: #c9d9ee; font-size: 11px; cursor: pointer; }.save-username { border-color: #c59e43; background: #3a2c14; color: #f7d97f; }.username-error { grid-column: 1 / -1; margin: 0; color: #e49ba2; font-size: 10px; }.avatar-picker { display: grid; grid-template-columns: auto auto auto; align-items: center; justify-content: center; gap: 12px; margin: -18px 0 28px; padding: 14px; border: 1px solid #293f5f; background: #0a1424; }.preset-avatars { display: flex; flex-wrap: wrap; justify-content: center; gap: 9px; }.preset-avatars button { display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid #385474; border-radius: 50%; background: #0d192d; font-size: 21px; cursor: pointer; }.preset-avatars button.selected, .preset-avatars button:hover { border-color: #e0bd5b; background: #24324a; }.picker-divider { color: #657c99; font-size: 10px; }.local-avatar-button { display: flex; min-height: 40px; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid #576f92; background: #111f34; color: #c8d7e9; font-size: 10px; cursor: pointer; }.local-avatar-button input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }.local-avatar-button > span { display: grid; width: 19px; height: 19px; place-items: center; border: 1px solid #d2b253; border-radius: 50%; color: #e2c664; font-size: 14px; }.local-avatar-button:hover { border-color: #d2b253; color: #f0dc96; }.local-avatar-button.disabled { opacity: .5; cursor: wait; }.avatar-error { grid-column: 1 / -1; margin: 0; color: #e49ba2; font-size: 10px; text-align: center; }.ledger-section { margin-top: 28px; padding: 22px; border: 1px solid #2b4264; background: #0b1527cc; }.ledger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid #233754; }.ledger-row strong, .ledger-row small { display: block; }.ledger-row strong { font-size: 12px; }.ledger-row small, .ledger-empty { margin: 4px 0 0; color: #91a6c4; font-size: 10px; }.ledger-row b { font-size: 13px; }.income { color: #7cd39d; }.expense { color: #ee9c9f; }
.resource-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }.resource-card { display: flex; align-items: center; gap: 12px; padding: 17px; border: 1px solid #2d4569; background: #0d192d; }.resource-icon { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d6b65b; border-radius: 50%; color: #f6d875; }.energy-icon { border-color: #86a5dc; color: #a9c8ff; }.resource-card small, .resource-card strong { display: block; }.resource-card small { color: #98abc7; font-size: 11px; }.resource-card strong { margin-top: 3px; color: #f6d875; font-size: 22px; }
.progress-section { margin-top: 28px; padding: 22px; border: 1px solid #2b4264; background: #0b1527cc; }.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }.section-heading h2 { margin: 0; font-size: 17px; }.section-heading span { color: #91a6c4; font-size: 11px; }.mode-progress { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 11px; padding: 13px 0; }.mode-progress + .mode-progress { border-top: 1px solid #233754; }.mode-mark { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 7px; font-size: 12px; font-weight: 800; }.normal-mark { background: #b3832e; color: #fff0b0; }.hard-mark { background: #6d3039; color: #ffd0d2; }.progress-copy strong, .progress-copy small { display: block; }.progress-copy strong { font-size: 13px; }.progress-copy small { margin-top: 4px; color: #91a6c4; font-size: 10px; }.progress-copy b { display: none; }.mode-progress > b { color: #d7bb65; font-size: 11px; }.progress-track { height: 5px; overflow: hidden; margin-top: 9px; border-radius: 3px; background: #1d304d; }.progress-track span { display: block; height: 100%; background: #d0ae4d; }.hard-progress .progress-track span { background: #b8545d; }.profile-note { margin: 18px 0 0; color: #7187a6; font-size: 11px; text-align: center; }.logout-player { display: block; min-height: 34px; margin: 22px auto 0; padding: 0 13px; border: 1px solid #754049; background: #21151c; color: #e5aab0; font-size: 11px; cursor: pointer; }.logout-player:hover { border-color: #d1707c; color: #ffd2d7; }
@media (max-width: 560px) { .profile-page { padding: 22px 14px; }.identity-block { margin: 36px 0 26px; }.avatar-ring { width: 76px; height: 76px; flex-basis: 76px; font-size: 34px; }.identity-block h1 { font-size: 24px; }.username-editor, .avatar-picker { grid-template-columns: 1fr; }.username-editor button { width: 100%; }.picker-divider { text-align: center; }.local-avatar-button { justify-content: center; }.progress-section { padding: 17px 14px; } }

/* 玩家主页采用一张可扫读的游戏名片，而不是连续堆叠的数据表格。 */
.profile-page { min-height: 100vh; padding: 28px 24px 38px; background: #071018; color: #eef5fb; }
.profile-shell { width: min(1040px, 100%); margin: 0 auto; }
.profile-header { min-height: 42px; grid-template-columns: 1fr auto 1fr; padding-bottom: 18px; border-bottom: 1px solid #20384c; }
.profile-kicker { color: #e1bc59; font-size: 11px; letter-spacing: 2.4px; }
.back-button { display: inline-flex; min-height: 30px; align-items: center; gap: 7px; padding: 0 4px; border: 0; background: transparent; color: #9db4c4; font-size: 11px; }
.back-button span { font-size: 18px; font-weight: 400; line-height: 1; }.back-button b { font-weight: 600; }.back-button:hover { border: 0; color: #f1cf72; }
.profile-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 28px; margin-top: 24px; padding: 26px 28px; border: 1px solid #2a4b5f; background: #0c1a25; box-shadow: 0 18px 45px #0005; }
.identity-block { justify-content: flex-start; gap: 18px; margin: 0; }.identity-copy { min-width: 0; }.avatar-ring { width: 82px; height: 82px; flex-basis: 82px; border-color: #e4bb54; border-radius: 18px; background: #173248; box-shadow: 5px 5px 0 #a33d43, 0 0 0 5px #e4bb5414; font-size: 38px; }.identity-label { margin-bottom: 5px; color: #8da9ba; font-size: 10px; letter-spacing: 1.6px; }.identity-block h1 { overflow: hidden; margin: 0; font-size: 28px; text-overflow: ellipsis; white-space: nowrap; }.identity-caption { margin-top: 5px; color: #90a7b7; font-size: 12px; }.identity-actions { gap: 6px; margin-top: 11px; }.avatar-edit, .username-edit { min-height: 27px; padding: 0 9px; border-color: #355a71; background: #102433; color: #b7cddd; font-size: 10px; }.avatar-edit:hover, .username-edit:hover { border-color: #e4bb54; background: #1b3140; }
.resource-strip { display: grid; grid-template-columns: repeat(2, minmax(112px, 1fr)); gap: 1px; overflow: hidden; border: 1px solid #2b4a5d; background: #2b4a5d; }.resource-card { min-width: 126px; gap: 9px; padding: 14px 16px; background: #0a1721; }.resource-card + .resource-card { border: 0; }.resource-icon { width: 29px; height: 29px; border: 0; border-radius: 9px; background: #493914; color: #f4d16a; font-size: 17px; }.energy-resource .resource-icon { background: #183851; color: #a8d3ee; }.resource-card small { color: #809caf; font-size: 10px; }.resource-card strong { margin-top: 1px; color: #f5d572; font-size: 20px; }.resource-card strong em { margin-left: 1px; color: #7e99a9; font-size: 12px; font-style: normal; font-weight: 500; }
.username-editor, .avatar-picker { width: min(680px, 100%); margin: 12px auto 0; border-color: #36566a; background: #0b1923; }.username-editor { grid-template-columns: minmax(0, 1fr) auto auto; }.username-editor input { border-color: #45677a; background: #0e202c; }.save-username, .cancel-username { min-height: 34px; border-color: #46687c; background: #152b39; }.save-username { border-color: #c49d41; background: #3d3114; }.avatar-picker { grid-template-columns: auto auto auto; }.preset-avatars button { border-color: #3a5a6c; background: #10212d; }.local-avatar-button { border-color: #476b7c; background: #122531; }
.profile-content { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(310px, .82fr); gap: 18px; margin-top: 18px; align-items: stretch; }.profile-panel { margin: 0; padding: 22px 24px; border: 1px solid #294759; background: #0b1822; }.section-heading { align-items: flex-start; margin-bottom: 6px; }.section-kicker { margin: 0 0 5px; color: #d8ae49; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; }.section-heading h2 { color: #f0f5fa; font-size: 19px; }.section-heading span { align-self: center; padding: 4px 7px; border: 1px solid #304f62; color: #93adbd; font-size: 10px; }.section-description { margin: 0 0 15px; color: #859eae; font-size: 11px; }.mode-progress { grid-template-columns: 36px minmax(0, 1fr) auto; gap: 12px; padding: 14px 0; }.mode-progress + .mode-progress { border-top-color: #234153; }.mode-mark { width: 32px; height: 32px; border-radius: 9px; }.normal-mark { background: #bd8b26; color: #fff2bd; }.hard-mark { background: #873d49; color: #ffe0de; }.progress-copy strong { color: #e9f0f5; font-size: 13px; }.progress-copy small { margin-top: 2px; color: #88a3b4; }.mode-progress > b { align-self: start; padding-top: 1px; color: #edc85d; font-size: 12px; }.progress-track { height: 5px; margin-top: 8px; border-radius: 0; background: #19354b; }.progress-track span { background: #d5ad42; }.hard-progress .progress-track span { background: #d55c65; }
.activity-section { display: flex; min-height: 0; flex-direction: column; }.activity-list { margin-top: 8px; }.ledger-row { gap: 9px; padding: 13px 0; border-top-color: #203a4b; }.ledger-row:first-child { border-top: 0; }.activity-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; }.income-dot { background: #77dba0; box-shadow: 0 0 0 4px #77dba018; }.expense-dot { background: #e67b84; box-shadow: 0 0 0 4px #e67b8418; }.ledger-row > div { min-width: 0; flex: 1; }.ledger-row strong { overflow: hidden; color: #dce8ef; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.ledger-row small { color: #819cac; }.ledger-row b { font-size: 12px; }.ledger-empty { display: grid; min-height: 120px; place-items: center; margin: 8px 0 0; padding: 16px; border: 1px dashed #315164; color: #829cac; font-size: 11px; text-align: center; }.profile-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; padding: 0 3px; color: #718b9c; font-size: 10px; }.logout-player { min-height: 30px; margin: 0; padding: 0 9px; border-color: #6f434b; background: #1f161a; color: #dda3a9; font-size: 10px; }.logout-player:hover { border-color: #cf6873; background: #2a171d; color: #ffd0d4; }
@media (max-width: 760px) { .profile-page { padding: 18px 14px 26px; }.profile-summary { grid-template-columns: 1fr; gap: 20px; padding: 21px 18px; }.resource-strip { width: 100%; }.resource-card { min-width: 0; padding: 13px; }.profile-content { grid-template-columns: 1fr; }.profile-panel { padding: 19px 16px; }.identity-block h1 { font-size: 25px; }.profile-header { padding-bottom: 12px; }.username-editor, .avatar-picker { margin-top: 10px; }.avatar-picker { grid-template-columns: 1fr; } }
@media (max-width: 420px) { .identity-block { align-items: flex-start; }.avatar-ring { width: 67px; height: 67px; flex-basis: 67px; border-radius: 15px; font-size: 31px; }.identity-caption { font-size: 11px; }.identity-actions { gap: 5px; }.avatar-edit, .username-edit { padding: 0 7px; }.section-heading h2 { font-size: 17px; }.mode-progress { grid-template-columns: 31px minmax(0, 1fr) auto; gap: 9px; }.mode-mark { width: 29px; height: 29px; }.profile-footer { margin-top: 14px; } }
</style>
