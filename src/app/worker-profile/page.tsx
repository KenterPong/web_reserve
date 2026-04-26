import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { WorkingHours } from '@/types'

interface Props {
  searchParams: { slug?: string }
}

export default async function WorkerProfilePage({ searchParams }: Props) {
  const slug = searchParams.slug

  if (!slug) notFound()

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select(
      'id, display_name, business_name, avatar_url, bio, working_hours, slot_duration, is_active',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!worker) notFound()

  const workingHours = worker.working_hours as unknown as WorkingHours

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const bookingUrl = appUrl
    ? appUrl.replace('www.', `${slug}.`) + '/booking'
    : `/booking?slug=${slug}`

  const dayNames: Record<string, string> = {
    mon: '週一', tue: '週二', wed: '週三',
    thu: '週四', fri: '週五', sat: '週六', sun: '週日',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Profile header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
          {worker.avatar_url ? (
            <img
              src={worker.avatar_url}
              alt={worker.display_name}
              className="w-20 h-20 rounded-full mx-auto object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-3xl text-green-600">
                {(worker.business_name || worker.display_name).charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {worker.business_name || worker.display_name}
            </h1>
          </div>
          {worker.bio && (
            <p className="text-gray-600 text-sm leading-relaxed">{worker.bio}</p>
          )}
        </div>

        {/* Working hours */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">營業時間</h2>
          <div className="space-y-1">
            {Object.entries(workingHours).map(([day, schedule]) => (
              <div key={day} className="flex justify-between text-sm">
                <span className="text-gray-500">{dayNames[day]}</span>
                <span className={schedule.closed ? 'text-gray-300' : 'text-gray-700'}>
                  {schedule.closed ? '公休' : `${schedule.start} ～ ${schedule.end}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <a
          href={bookingUrl}
          className="block w-full bg-green-500 hover:bg-green-600 text-white text-center font-semibold py-4 rounded-2xl transition-colors"
        >
          立即預約
        </a>
      </div>
    </div>
  )
}
