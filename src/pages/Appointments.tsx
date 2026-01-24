import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AppointmentFilters from '@/components/AppointmentFilters'
import AppointmentsTable from '@/components/AppointmentsTable'
import EditAppointmentDialog from '@/components/EditAppointmentDialog'
import { useAppointments } from '@/hooks/useAppointments'
import type { Database } from '@/integrations/supabase/types'

type Appointment = Database['public']['Tables']['appointments']['Row']

export default function Appointments() {
  const navigate = useNavigate()
  const { appointments, loading, error, updateAppointment, refetch } = useAppointments()

  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editing, setEditing] = useState<Appointment | null>(null)

  // Client-side filtering
  const filtered = (appointments || []).filter((apt) => {
    const matchesSearch =
      !searchQuery ||
      apt.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.mobile_number.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDate = !dateFilter || apt.preferred_date === dateFilter
    const matchesStatus = statusFilter === 'All' || apt.status === statusFilter
    return matchesSearch && matchesDate && matchesStatus
  })

  if (loading) {
    return <div className="p-6">Loading appointments…</div>
  }

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <div className="text-red-600 font-semibold">Error loading appointments</div>
        <div className="text-sm text-muted-foreground">{error}</div>
        <div className="text-xs text-muted-foreground">
          Table: <code className="bg-muted px-1 rounded">appointments</code>
        </div>
        <Button onClick={refetch} className="mt-2">Retry</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/')}>Home</Button>
        </div>
      </div>

      <AppointmentFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      <AppointmentsTable
        appointments={filtered}
        loading={loading}
        onEdit={(apt) => setEditing(apt)}
      />

      <EditAppointmentDialog
        appointment={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSave={async (id, updates) => {
          const ok = await updateAppointment(id, updates)
          return ok
        }}
      />
    </div>
  )
}
