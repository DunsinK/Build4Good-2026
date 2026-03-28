import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GameProvider } from '@/context/GameContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <GameProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerShown: false,
            animationEnabled: true,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Home',
            }}
          />
          <Stack.Screen
            name="live-game"
            options={{
              title: 'Live Game',
              animationEnabled: true,
            }}
          />
          <Stack.Screen
            name="history"
            options={{
              title: 'History',
              animationEnabled: true,
            }}
          />
        </Stack>
      </ThemeProvider>
    </GameProvider>
  );
}
