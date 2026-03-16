export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
}

export function canAccessAdmin(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();

  return adminEmails.includes(normalizedEmail);
}
