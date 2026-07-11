import { Image, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatPdfSignedAt } from '@/lib/pdf/format-values'

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1.5,
    borderTopColor: '#D4AF37',
  },
  heading: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#A1A8A2',
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  signatureImage: {
    width: '100%',
    height: 56,
    objectFit: 'contain',
    marginBottom: 8,
  },
  physicalBox: {
    height: 56,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A1A8A2',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  physicalLabel: {
    fontSize: 9,
    color: '#A1A8A2',
  },
  name: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
  },
  role: {
    fontSize: 8,
    color: '#A1A8A2',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 8,
    color: '#0F2C59',
    marginTop: 4,
  },
  empty: {
    fontSize: 9,
    color: '#A1A8A2',
  },
})

export interface SignatureBlockEntry {
  stepOrder: number
  fullName: string
  authorityText: string | null
  signedAt: string | null
  /** Embeddable data URL, or null when missing / physical. */
  imageSrc: string | null
  isPhysical: boolean
  status: string
}

export function SignatureBlock({ entries }: { entries: SignatureBlockEntry[] }) {
  const signed = entries.filter(
    (entry) => entry.status === 'approved' || entry.isPhysical || entry.imageSrc
  )

  if (signed.length === 0) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.heading}>Signatures</Text>
        <Text style={styles.empty}>No signatures captured yet.</Text>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Signatures</Text>
      <View style={styles.grid}>
        {signed.map((entry) => (
          <View key={entry.stepOrder} style={styles.card} wrap={false}>
            {entry.isPhysical || !entry.imageSrc ? (
              <View style={styles.physicalBox}>
                <Text style={styles.physicalLabel}>
                  {entry.isPhysical ? 'APPROVED' : 'Signature unavailable'}
                </Text>
              </View>
            ) : (
              // eslint-disable-next-line jsx-a11y/alt-text -- signature image in PDF output
              <Image src={entry.imageSrc} style={styles.signatureImage} />
            )}
            <Text style={styles.name}>{entry.fullName}</Text>
            {entry.authorityText ? (
              <Text style={styles.role}>{entry.authorityText}</Text>
            ) : null}
            <Text style={styles.timestamp}>
              Signed {formatPdfSignedAt(entry.signedAt)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
