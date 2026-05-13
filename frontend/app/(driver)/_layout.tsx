import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function DriverLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/role-select" />;
  if (user.role !== "driver") return <Redirect href="/" />;

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
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />, tabBarTestID: "driver-tab-home" }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Feather name="trending-up" size={size} color={color} />, tabBarTestID: "driver-tab-earnings" }}
      />
      <Tabs.Screen
        name="kyc"
        options={{ title: "KYC", tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} />, tabBarTestID: "driver-tab-kyc" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />, tabBarTestID: "driver-tab-profile" }}
      />
      <Tabs.Screen name="ride" options={{ href: null }} />
    </Tabs>
  );
}
