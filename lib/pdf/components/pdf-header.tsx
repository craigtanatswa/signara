import { Text, Image, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { documentRefFromId } from '@/lib/pdf/format-values'

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#D4AF37',
  },
  left: {
    flex: 1,
    paddingRight: 16,
  },
  right: {
    alignItems: 'flex-end',
    maxWidth: 160,
  },
  logo: {
    maxWidth: 140,
    maxHeight: 40,
    objectFit: 'contain',
    marginBottom: 8,
  },
  orgName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
    marginBottom: 4,
  },
  ref: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0F2C59',
    letterSpacing: 0.5,
  },
  generated: {
    fontSize: 8,
    color: '#A1A8A2',
    marginTop: 4,
  },
})

export interface PdfHeaderProps {
  organisationName: string
  logoSrc: string | null
  documentTitle: string
  documentId: string
  generatedAt?: Date
}

export function PdfHeader({
  organisationName,
  logoSrc,
  documentTitle,
  documentId,
  generatedAt = new Date(),
}: PdfHeaderProps) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.left}>
        {logoSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- organisation logo in PDF output
          <Image src={logoSrc} style={styles.logo} />
        ) : (
          <Text style={styles.orgName}>{organisationName}</Text>
        )}
        <Text style={styles.title}>{documentTitle}</Text>
        <Text style={styles.ref}>REF: {documentRefFromId(documentId)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.generated}>{format(generatedAt, 'd MMMM yyyy')}</Text>
      </View>
    </View>
  )
}
