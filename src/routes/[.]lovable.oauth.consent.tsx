import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/.lovable/oauth/consent')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/.lovable/oauth/consent"!</div>
}
