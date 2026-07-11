import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  formatPdfAuditTimestamp,
  truncateUserAgent,
} from '@/lib/pdf/format-values'
import { PdfHeader } from '@/lib/pdf/components/pdf-header'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: '#0F2C59',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: '#A1A8A2',
    marginBottom: 16,
  },
  metaBlock: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A1A8A2',
  },
  metaLine: {
    fontSize: 9,
    marginBottom: 4,
    color: '#0F2C59',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F2C59',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#A1A8A2',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: '#F8F9FA',
  },
  cell: {
    fontSize: 7,
    color: '#0F2C59',
  },
  colStep: { width: '6%' },
  colName: { width: '18%' },
  colRole: { width: '18%' },
  colStatus: { width: '12%' },
  colTime: { width: '16%' },
  colIp: { width: '12%' },
  colDevice: { width: '18%' },
  footer: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D4AF37',
    fontSize: 8,
    color: '#A1A8A2',
    fontStyle: 'italic',
  },
})

export type AuditStepStatus = 'Signed' | 'Rejected' | 'Skipped' | 'Pending' | 'Waiting'

export interface AuditTrailStepRow {
  stepOrder: number
  assigneeName: string
  authorityText: string
  statusLabel: AuditStepStatus
  timestamp: string | null
  ipAddress: string | null
  userAgent: string | null
}

export interface AuditTrailProps {
  organisationName: string
  logoSrc: string | null
  documentTitle: string
  documentId: string
  initiatedByName: string
  initiatedAt: string
  completedAt: string | null
  rejectedAt: string | null
  documentStatus: string
  steps: AuditTrailStepRow[]
}

function statusLabelFromStep(status: string): AuditStepStatus {
  switch (status) {
    case 'approved':
      return 'Signed'
    case 'rejected':
      return 'Rejected'
    case 'skipped':
      return 'Skipped'
    case 'pending':
      return 'Pending'
    default:
      return 'Waiting'
  }
}

export function mapStepStatusToAuditLabel(status: string): AuditStepStatus {
  return statusLabelFromStep(status)
}

export function AuditTrailPage(props: AuditTrailProps) {
  const outcomeLine =
    props.documentStatus === 'completed' && props.completedAt
      ? `Document completed on ${formatPdfAuditTimestamp(props.completedAt)}`
      : props.documentStatus === 'rejected'
        ? `Document rejected on ${formatPdfAuditTimestamp(props.rejectedAt ?? props.completedAt)}`
        : `Document status: ${props.documentStatus.replace(/_/g, ' ')}`

  return (
    <Page size="A4" style={styles.page} wrap>
      <PdfHeader
        organisationName={props.organisationName}
        logoSrc={props.logoSrc}
        documentTitle={props.documentTitle}
        documentId={props.documentId}
      />

      <Text style={styles.title}>Audit Trail</Text>
      <Text style={styles.subtitle}>Complete signing history for this document</Text>

      <View style={styles.metaBlock}>
        <Text style={styles.metaLine}>
          Document initiated by {props.initiatedByName} on{' '}
          {formatPdfAuditTimestamp(props.initiatedAt)}
        </Text>
        <Text style={styles.metaLine}>{outcomeLine}</Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colStep]}>#</Text>
        <Text style={[styles.tableHeaderCell, styles.colName]}>Assignee</Text>
        <Text style={[styles.tableHeaderCell, styles.colRole]}>Authority</Text>
        <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
        <Text style={[styles.tableHeaderCell, styles.colTime]}>Timestamp</Text>
        <Text style={[styles.tableHeaderCell, styles.colIp]}>IP</Text>
        <Text style={[styles.tableHeaderCell, styles.colDevice]}>Device</Text>
      </View>

      {props.steps.map((step, index) => (
        <View
          key={step.stepOrder}
          style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
          wrap={false}
        >
          <Text style={[styles.cell, styles.colStep]}>{step.stepOrder}</Text>
          <Text style={[styles.cell, styles.colName]}>{step.assigneeName}</Text>
          <Text style={[styles.cell, styles.colRole]}>{step.authorityText || '—'}</Text>
          <Text style={[styles.cell, styles.colStatus]}>{step.statusLabel}</Text>
          <Text style={[styles.cell, styles.colTime]}>
            {formatPdfAuditTimestamp(step.timestamp)}
          </Text>
          <Text style={[styles.cell, styles.colIp]}>{step.ipAddress || '—'}</Text>
          <Text style={[styles.cell, styles.colDevice]}>
            {truncateUserAgent(step.userAgent)}
          </Text>
        </View>
      ))}

      <Text style={styles.footer}>
        This audit trail is generated by Signara and reflects the complete signing history of
        this document.
      </Text>
    </Page>
  )
}

/** Standalone audit-trail PDF used when merging onto a pdf-lib stamped document. */
export function AuditTrailDocument(props: AuditTrailProps) {
  return (
    <Document title={`${props.documentTitle} — Audit Trail`}>
      <AuditTrailPage {...props} />
    </Document>
  )
}
