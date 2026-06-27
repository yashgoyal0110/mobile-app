import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function PassengerLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/role-select" />;
  if (user.role !== "passenger") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          tabBarTestID: "passenger-tab-home",
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "My Trips",
          tabBarIcon: ({ color, size }) => <Feather name="bookmark" size={size} color={color} />,
          tabBarTestID: "passenger-tab-trips",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          tabBarTestID: "passenger-tab-profile",
        }}
      />
      {/* Reached through the Home hub, not the tab bar */}
      <Tabs.Screen name="ride" options={{ href: null }} />
      <Tabs.Screen name="stays" options={{ href: null }} />
      <Tabs.Screen name="temples" options={{ href: null }} />
      <Tabs.Screen name="service" options={{ href: null }} />
      <Tabs.Screen name="booking" options={{ href: null }} />
      <Tabs.Screen name="stay" options={{ href: null }} />
      <Tabs.Screen name="temple" options={{ href: null }} />
    </Tabs>
  );
}
