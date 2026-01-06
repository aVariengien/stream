import { getSession } from '@/lib/auth'
import { StreamView } from '@/components/StreamView'

export default async function Home() {
  const session = await getSession()

  return (
    <StreamView 
      initialAuth={!!session} 
      initialUsername={session?.username}
    />
  )
}
