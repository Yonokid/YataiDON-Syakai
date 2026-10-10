import { createRouter, createWebHistory } from 'vue-router'

import AccessCodeInput from '../components/AccessCodeInput.vue'
import AdminPage from '../components/AdminPage.vue'
import DiffChartPage from '../components/DiffChartPage.vue'
import HomePage from '../components/HomePage.vue'
import LeaderboardPage from '../components/LeaderboardPage.vue'
import PublicUserPage from '../components/PublicUserPage.vue'
import ScoresPage from '../components/ScoresPage.vue'
import SongLeaderboardPage from '../components/SongLeaderboardPage.vue'
import SongPage from '../components/SongPage.vue'
import TitlesPage from '../components/TitlesPage.vue'
import UserPage from '../components/UserPage.vue'
import { accessCode, currentUser, restoreSession } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: AccessCodeInput },
    { path: '/admin', name: 'admin', component: AdminPage },
    { path: '/', name: 'home', component: HomePage },
    { path: '/scores', name: 'scores', component: ScoresPage },
    { path: '/user', name: 'user', component: UserPage },
    { path: '/u/:id', name: 'public-user', component: PublicUserPage },
    { path: '/charts', name: 'charts', component: DiffChartPage },
    { path: '/leaderboard', name: 'leaderboard', component: LeaderboardPage },
    { path: '/songs', name: 'songs', component: SongLeaderboardPage },
    { path: '/songs/:hash', name: 'song', component: SongPage },
    { path: '/titles', name: 'titles', component: TitlesPage },
  ],
})

router.beforeEach(async (to) => {
  if (!(currentUser.value && accessCode.value)) await restoreSession()

  const authenticated = !!(currentUser.value && accessCode.value)
  if (!authenticated && to.name !== 'login' && to.name !== 'admin') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (authenticated && to.name === 'login') return { name: 'home' }
})

export default router
