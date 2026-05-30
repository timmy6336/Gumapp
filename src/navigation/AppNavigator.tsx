import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, TouchableOpacity, View } from 'react-native';
import MapScreen from '../screens/MapScreen';
import ReportScreen from '../screens/ReportScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import AdminStatsScreen from '../screens/AdminStatsScreen';
import TrendsScreen from '../screens/TrendsScreen';

const Tab = createBottomTabNavigator();
const ProfileStack = createStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Map: '🗺️',
    Report: '➕',
    Leaderboard: '🏆',
    Trends: '📈',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? label}
    </Text>
  );
}

const headerBase = {
  headerStyle: { backgroundColor: '#0f0f0f' },
  headerTintColor: '#fff' as const,
  headerTitleStyle: { fontWeight: '700' as const },
};

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={headerBase}>
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Profile',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
              <TouchableOpacity onPress={() => navigation.navigate('AdminStats')}>
                <Text style={{ color: '#666', fontSize: 12 }}>Stats</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                <Text style={{ color: '#666', fontSize: 12 }}>Privacy</Text>
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <ProfileStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Privacy Policy' }}
      />
      <ProfileStack.Screen
        name="AdminStats"
        component={AdminStatsScreen}
        options={{ title: 'Admin Stats' }}
      />
    </ProfileStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerBase,
        tabBarStyle: { backgroundColor: '#0f0f0f', borderTopColor: '#222' },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#666',
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 10 },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ title: 'Gum Map' }} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Trends" component={TrendsScreen} options={{ title: 'Nearby Trends' }} />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}
