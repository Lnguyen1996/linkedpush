export function getProfileAvatarSrc(user) {
  if (!user?.avatar_url) return null
  return `/api/auth/avatar?v=${encodeURIComponent(user.avatar_url)}`
}
