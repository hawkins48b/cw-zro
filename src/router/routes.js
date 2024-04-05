const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [

      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('pages/DashboardPage.vue') },
      {
        path: 'profiles',
        component: () => import('pages/ProfilesPage.vue'),
        children: [
          { path: '', component: () => import('pages/profiles/ListProfilesPage.vue') },
          { path: 'add', component: () => import('pages/profiles/AddProfilePage.vue') },
          { path: 'edit/:profileId', component: () => import('pages/profiles/EditProfilePage.vue') }
        ]
      },
      {
        path: 'calculators',
        component: () => import('pages/CalculatorsPage.vue'),
        children: [
          { path: '', component: () => import('pages/calculators/ListCalculatorsPage.vue') },
          { path: 'ballistic', component: () => import('pages/calculators/ballistic/BallisticPage.vue') },
          { path: 'maximum-point-blank-range', component: () => import('pages/calculators/mpbr/MpbrPage.vue') }
        ]
      },
      {
        path: 'trajectories',
        component: () => import('pages/TrajectoriesPage.vue'),
        children: [
          { path: '', component: () => import('pages/trajectories/ListTrajectoriesPage.vue') }
        ]
      },
      { path: 'settings', component: () => import('pages/SettingsPage.vue') },
      { path: 'about', component: () => import('pages/AboutPage.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
