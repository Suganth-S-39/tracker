import { createBrowserRouter } from 'react-router';
import { Splash } from '@/components/ui/Splash';
import { GuestOnly, RequireAuth, RequireOnboarded } from '@/features/auth/guards';
import { NotFoundPage, RouteErrorPage } from './RouteErrorPage';

// Every screen is its own lazily loaded chunk, so a page only downloads the code it needs.
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    // Shown while the first lazily loaded route downloads.
    hydrateFallbackElement: <Splash />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/sign-in', lazy: () => import('@/features/auth/SignInPage').then((m) => ({ Component: m.SignInPage })) },
          { path: '/sign-up', lazy: () => import('@/features/auth/SignUpPage').then((m) => ({ Component: m.SignUpPage })) },
          {
            path: '/forgot-password',
            lazy: () => import('@/features/auth/ForgotPasswordPage').then((m) => ({ Component: m.ForgotPasswordPage })),
          },
        ],
      },
      {
        path: '/reset-password',
        lazy: () => import('@/features/auth/ResetPasswordPage').then((m) => ({ Component: m.ResetPasswordPage })),
      },
      { path: '/privacy', lazy: () => import('@/features/privacy/PrivacyPage').then((m) => ({ Component: m.PrivacyPage })) },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/welcome',
            lazy: () => import('@/features/onboarding/WelcomePage').then((m) => ({ Component: m.WelcomePage })),
          },
          {
            element: <RequireOnboarded />,
            children: [
              {
                lazy: () => import('@/components/layout/AppShell').then((m) => ({ Component: m.AppShell })),
                children: [
                  { path: '/', lazy: () => import('@/features/home/HomePage').then((m) => ({ Component: m.HomePage })) },
                  {
                    path: '/transactions',
                    lazy: () => import('@/features/transactions/TransactionsPage').then((m) => ({ Component: m.TransactionsPage })),
                  },
                  {
                    path: '/budgets',
                    lazy: () => import('@/features/budgets/BudgetsPage').then((m) => ({ Component: m.BudgetsPage })),
                  },
                  {
                    path: '/reports',
                    lazy: () => import('@/features/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })),
                  },
                  { path: '/ious', lazy: () => import('@/features/ious/IousPage').then((m) => ({ Component: m.IousPage })) },
                  {
                    path: '/ious/:id',
                    lazy: () => import('@/features/ious/IouDetailPage').then((m) => ({ Component: m.IouDetailPage })),
                  },
                  {
                    path: '/settings',
                    lazy: () => import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
                  },
                  {
                    path: '/settings/recurring',
                    lazy: () => import('@/features/recurring/RecurringPage').then((m) => ({ Component: m.RecurringPage })),
                  },
                  {
                    path: '/settings/categories',
                    lazy: () => import('@/features/categories/CategoriesPage').then((m) => ({ Component: m.CategoriesPage })),
                  },
                  { path: '*', Component: NotFoundPage },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
