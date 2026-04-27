import { useEffect, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'

const HUB_URL = '/hubs/notifications'

export function useNotificationSignalR({ onNotification, onConnected, onDisconnected }) {
  const { user } = useAuth()
  const connectionRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { withCredentials: true })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connectionRef.current = connection

    connection.on('NotificationReceived', (notification) => {
      onNotification?.(notification)
    })

    connection.onreconnecting(() => {
      onDisconnected?.()
    })

    connection.onreconnected(() => {
      connection.invoke('JoinUserGroup', user.id.toString()).catch(console.error)
      onConnected?.()
    })

    connection.onclose(() => {
      onDisconnected?.()
    })

    connection.start()
      .then(() => {
        connection.invoke('JoinUserGroup', user.id.toString()).catch(console.error)
        onConnected?.()
      })
      .catch(err => console.error('SignalR connection failed:', err))

    return () => {
      connection.stop().catch(() => {})
    }
  }, [user, onNotification, onConnected, onDisconnected])

  return connectionRef
}
