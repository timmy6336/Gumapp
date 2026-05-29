import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(userId: string | null) {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications(userId);

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // notification received in foreground — realtime subscription already handles UI
    });

    return () => { notificationListener.current?.remove(); };
  }, [userId]);
}

async function registerForPushNotifications(userId: string) {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  } catch {
    // EAS project ID not configured — skip push token registration in development
  }
}
