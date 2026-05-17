import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailScreen } from './src/screens/DetailScreen';

// Cache configuration for the nexus
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

export default function App() {
  // Load custom typography for the nexus
  const [fontsLoaded] = useFonts({
    'SpaceGrotesk': require('./assets/fonts/SpaceGrotesk-Bold.ttf'),
    'BeVietnamPro': require('./assets/fonts/BeVietnamPro-Medium.ttf'),
  });

  const [selectedAnimeId, setSelectedAnimeId] = useState<string | null>(null);

  // Also handle loading errors to prevent the "rotating" hang
  const [error, setError] = useState<Error | null>(null);

  if (!fontsLoaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        {selectedAnimeId ? (
          <DetailScreen 
            id={selectedAnimeId} 
            onBack={() => setSelectedAnimeId(null)} 
          />
        ) : (
          <HomeScreen 
            onAnimePress={(id) => setSelectedAnimeId(id)} 
          />
        )}
      </View>
    </QueryClientProvider>
  );
}
