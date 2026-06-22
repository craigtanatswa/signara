'use client'

import { useRouter } from 'next/navigation'
import { InviteUserDialog } from '@/components/users/invite-user-dialog'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types/database'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface TeamClientProps {
  members: User[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TeamClient({ members }: TeamClientProps) {
  const router = useRouter()

  return (
    <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      {/* Table header row */}
      <div className="flex items-center justify-between border-b border-signara-steel/20 px-6 py-4">
        <h3 className="font-semibold text-signara-navy">Members</h3>
        <InviteUserDialog onSuccess={() => router.refresh()} />
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-medium text-signara-navy">No team members yet</p>
          <p className="mt-1 text-sm text-signara-steel">
            Invite your first member using the button above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-signara-steel/20">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-signara-steel/10">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-signara-background/50 transition-colors">
                  {/* User */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signara-navy text-xs font-bold text-white">
                        {getInitials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-signara-navy">
                          {member.full_name}
                        </p>
                        <p className="truncate text-xs text-signara-steel">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <Badge
                      className={
                        member.role === 'admin'
                          ? 'bg-signara-navy/10 text-signara-navy border-signara-navy/20 hover:bg-signara-navy/10'
                          : 'bg-signara-steel/10 text-signara-steel border-signara-steel/20 hover:bg-signara-steel/10'
                      }
                      variant="outline"
                    >
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </td>

                  {/* Department */}
                  <td className="px-6 py-4 text-sm text-signara-navy">
                    {member.department ?? <span className="text-signara-steel">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {member.must_change_password ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" variant="outline">
                        Pending setup
                      </Badge>
                    ) : (
                      <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50" variant="outline">
                        Active
                      </Badge>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-6 py-4 text-sm text-signara-steel">
                    {formatDate(member.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
