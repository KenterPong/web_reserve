import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const workerId = cookies().get('worker_id')?.value
  if (!workerId) {
    redirect('/api/auth/line-bootstrap')
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('onboarding_completed')
    .eq('id', workerId)
    .single()

  if (worker?.onboarding_completed === true) {
    redirect('/dashboard/appointments')
  }

  return <>{children}</>
}
