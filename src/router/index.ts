import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, accessCode } from '../stores/auth'
import AccessCodeInput from '../components/AccessCodeInput.vue'
import HomePage from '../components/HomePage.vue'
import UserPage from '../components/UserPage.vue'
import ScoresPage from '../components/ScoresPage.vue'
import PublicUserPage from '../components/PublicUserPage.vue'
import DiffChartPage from '../components/DiffChartPage.vue'
import LeaderboardPage from '../components/LeaderboardPage.vue'
import SongLeaderboardPage from '../components/SongLeaderboardPage.vue'
import SongPage from '../components/SongPage.vue'
import AdminPage from '../components/AdminPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: AccessCodeInput },
    { path: '/admin', name: 'admin', component: AdminPage },
    { path: '/', name: 'home', component: HomePage },
    { path: '/scores', name: 'scores', component: ScoresPage },
    { path: '/user', name: 'user', component: UserPage },
    { path: '/u/:username', name: 'public-user', component: PublicUserPage },
    { path: '/charts', name: 'charts', component: DiffChartPage },
    { path: '/leaderboard', name: 'leaderboard', component: LeaderboardPage },
    { path: '/songs', name: 'songs', component: SongLeaderboardPage },
    { path: '/songs/:hash', name: 'song', component: SongPage },
  ],
})

router.beforeEach((to) => {
  const authenticated = !!(currentUser.value && accessCode.value)
  if (!authenticated && to.name !== 'login' && to.name !== 'admin') return { name: 'login' }
  if (authenticated && to.name === 'login') return { name: 'home' }
})

export default router
