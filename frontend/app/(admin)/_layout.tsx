import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/role-select" />;
  if (user.role !== "admin") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />, tabBarTestID: "admin-tab-dashboard" }} />
      <Tabs.Screen name="drivers" options={{ title: "Drivers", tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />, tabBarTestID: "admin-tab-drivers" }} />
      <Tabs.Screen name="fares" options={{ title: "Fares", tabBarIcon: ({ color, size }) => <Feather name="dollar-sign" size={size} color={color} />, tabBarTestID: "admin-tab-fares" }} />
      <Tabs.Screen name="audit" options={{ title: "Audit", tabBarIcon: ({ color, size }) => <Feather name="file-text" size={size} color={color} />, tabBarTestID: "admin-tab-audit" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />, tabBarTestID: "admin-tab-profile" }} />
    </Tabs>
  );
}
