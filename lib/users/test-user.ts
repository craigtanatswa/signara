const TEST_USER_EMAIL_DOMAIN = '@test.signara.local'

export function isTestUserEmail(email: string): boolean {
  return email.toLowerCase().endsWith(TEST_USER_EMAIL_DOMAIN)
}
